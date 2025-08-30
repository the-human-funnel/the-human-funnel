interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

const LOG_LEVELS: LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

interface LogContext {
  service?: string;
  operation?: string;
  candidateId?: string;
  jobProfileId?: string;
  batchId?: string;
  userId?: string | undefined;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: any;
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  metadata?: any;
}

interface ErrorMetric {
  service: string;
  operation: string;
  errorType: string;
  errorMessage: string;
  timestamp: Date;
  metadata?: any;
}

class Logger {
  private logLevel: number;
  private performanceMetrics: PerformanceMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private maxMetricsHistory = 1000;

  constructor() {
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    this.logLevel = LOG_LEVELS[envLogLevel as keyof LogLevel] ?? LOG_LEVELS.INFO;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context
    };
    
    // In production, use structured JSON logging
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logEntry);
    }
    
    // In development, use human-readable format
    const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  private shouldLog(level: number): boolean {
    return level <= this.logLevel;
  }

  private addPerformanceMetric(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);
    if (this.performanceMetrics.length > this.maxMetricsHistory) {
      this.performanceMetrics.shift();
    }
  }

  private addErrorMetric(metric: ErrorMetric): void {
    this.errorMetrics.push(metric);
    if (this.errorMetrics.length > this.maxMetricsHistory) {
      this.errorMetrics.shift();
    }
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    
    const errorInfo = error instanceof Error 
      ? { 
          name: error.name, 
          message: error.message, 
          stack: error.stack,
          code: (error as any).code
        }
      : error;
    
    const logContext = { 
      ...context, 
      error: errorInfo,
      severity: 'error'
    };
    
    console.error(this.formatMessage('ERROR', message, logContext));
    
    // Track error metrics
    if (context?.service && context?.operation) {
      this.addErrorMetric({
        service: context.service,
        operation: context.operation,
        errorType: errorInfo?.name || 'UnknownError',
        errorMessage: errorInfo?.message || message,
        timestamp: new Date(),
        metadata: context
      });
    }
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    const logContext = { ...context, severity: 'warning' };
    console.warn(this.formatMessage('WARN', message, logContext));
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    const logContext = { ...context, severity: 'info' };
    console.log(this.formatMessage('INFO', message, logContext));
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    const logContext = { ...context, severity: 'debug' };
    console.log(this.formatMessage('DEBUG', message, logContext));
  }

  // Performance logging methods
  performance(operation: string, duration: number, success: boolean = true, context?: LogContext): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date(),
      success,
      metadata: context
    };
    
    this.addPerformanceMetric(metric);
    
    const logContext = {
      ...context,
      operation,
      duration,
      success,
      performanceMetric: true
    };
    
    if (duration > 5000) { // Log slow operations (>5s)
      this.warn(`Slow operation detected: ${operation}`, logContext);
    } else {
      this.debug(`Performance: ${operation}`, logContext);
    }
  }

  // API request logging
  apiRequest(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void {
    const logContext = {
      ...context,
      method,
      path,
      statusCode,
      duration,
      apiRequest: true
    };
    
    if (statusCode >= 400) {
      this.error(`API Error: ${method} ${path}`, undefined, logContext);
    } else if (duration > 2000) {
      this.warn(`Slow API request: ${method} ${path}`, logContext);
    } else {
      this.info(`API: ${method} ${path}`, logContext);
    }
  }

  // External service logging
  externalService(service: string, operation: string, success: boolean, duration: number, context?: LogContext): void {
    const logContext = {
      ...context,
      service,
      operation,
      success,
      duration,
      externalService: true
    };
    
    if (!success) {
      this.error(`External service failure: ${service}.${operation}`, undefined, logContext);
    } else if (duration > 10000) {
      this.warn(`Slow external service: ${service}.${operation}`, logContext);
    } else {
      this.debug(`External service: ${service}.${operation}`, logContext);
    }
  }

  // Rate limit logging
  rateLimitHit(service: string, operation: string, remaining: number, resetTime: Date, context?: LogContext): void {
    const logContext = {
      ...context,
      service,
      operation,
      remaining,
      resetTime: resetTime.toISOString(),
      rateLimitHit: true
    };
    
    if (remaining === 0) {
      this.error(`Rate limit exceeded: ${service}.${operation}`, undefined, logContext);
    } else if (remaining < 10) {
      this.warn(`Rate limit warning: ${service}.${operation} - ${remaining} requests remaining`, logContext);
    } else {
      this.debug(`Rate limit status: ${service}.${operation} - ${remaining} requests remaining`, logContext);
    }
  }

  // Security event logging
  securityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext): void {
    const logContext = {
      ...context,
      securityEvent: event,
      severity,
      timestamp: new Date().toISOString()
    };
    
    switch (severity) {
      case 'critical':
      case 'high':
        this.error(`Security event: ${event}`, undefined, logContext);
        break;
      case 'medium':
        this.warn(`Security event: ${event}`, logContext);
        break;
      case 'low':
        this.info(`Security event: ${event}`, logContext);
        break;
    }
  }

  // Business metrics logging
  businessMetric(metric: string, value: number, unit?: string, context?: LogContext): void {
    const logContext = {
      ...context,
      businessMetric: metric,
      value,
      unit,
      timestamp: new Date().toISOString()
    };
    
    this.info(`Business metric: ${metric} = ${value}${unit ? ` ${unit}` : ''}`, logContext);
  }

  // Queue operation logging
  queueOperation(queue: string, operation: string, jobId?: string, context?: LogContext): void {
    const logContext = {
      ...context,
      queue,
      operation,
      jobId,
      queueOperation: true
    };
    
    this.info(`Queue: ${queue}.${operation}`, logContext);
  }

  // Get metrics for monitoring
  getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  getErrorMetrics(): ErrorMetric[] {
    return [...this.errorMetrics];
  }

  // Clear metrics (useful for testing)
  clearMetrics(): void {
    this.performanceMetrics = [];
    this.errorMetrics = [];
  }

  setLogLevel(level: keyof LogLevel): void {
    this.logLevel = LOG_LEVELS[level];
  }
}

// Create singleton instance
export const logger = new Logger();
export default logger;