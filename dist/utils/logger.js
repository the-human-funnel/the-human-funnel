"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
};
class Logger {
    constructor() {
        this.performanceMetrics = [];
        this.errorMetrics = [];
        this.maxMetricsHistory = 1000;
        const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
        this.logLevel = LOG_LEVELS[envLogLevel] ?? LOG_LEVELS.INFO;
    }
    formatMessage(level, message, context) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...context
        };
        if (process.env.NODE_ENV === 'production') {
            return JSON.stringify(logEntry);
        }
        const contextStr = context ? ` ${JSON.stringify(context, null, 2)}` : '';
        return `[${timestamp}] ${level}: ${message}${contextStr}`;
    }
    shouldLog(level) {
        return level <= this.logLevel;
    }
    addPerformanceMetric(metric) {
        this.performanceMetrics.push(metric);
        if (this.performanceMetrics.length > this.maxMetricsHistory) {
            this.performanceMetrics.shift();
        }
    }
    addErrorMetric(metric) {
        this.errorMetrics.push(metric);
        if (this.errorMetrics.length > this.maxMetricsHistory) {
            this.errorMetrics.shift();
        }
    }
    error(message, error, context) {
        if (!this.shouldLog(LOG_LEVELS.ERROR))
            return;
        const errorInfo = error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
                code: error.code
            }
            : error;
        const logContext = {
            ...context,
            error: errorInfo,
            severity: 'error'
        };
        console.error(this.formatMessage('ERROR', message, logContext));
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
    warn(message, context) {
        if (!this.shouldLog(LOG_LEVELS.WARN))
            return;
        const logContext = { ...context, severity: 'warning' };
        console.warn(this.formatMessage('WARN', message, logContext));
    }
    info(message, context) {
        if (!this.shouldLog(LOG_LEVELS.INFO))
            return;
        const logContext = { ...context, severity: 'info' };
        console.log(this.formatMessage('INFO', message, logContext));
    }
    debug(message, context) {
        if (!this.shouldLog(LOG_LEVELS.DEBUG))
            return;
        const logContext = { ...context, severity: 'debug' };
        console.log(this.formatMessage('DEBUG', message, logContext));
    }
    performance(operation, duration, success = true, context) {
        const metric = {
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
        if (duration > 5000) {
            this.warn(`Slow operation detected: ${operation}`, logContext);
        }
        else {
            this.debug(`Performance: ${operation}`, logContext);
        }
    }
    apiRequest(method, path, statusCode, duration, context) {
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
        }
        else if (duration > 2000) {
            this.warn(`Slow API request: ${method} ${path}`, logContext);
        }
        else {
            this.info(`API: ${method} ${path}`, logContext);
        }
    }
    externalService(service, operation, success, duration, context) {
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
        }
        else if (duration > 10000) {
            this.warn(`Slow external service: ${service}.${operation}`, logContext);
        }
        else {
            this.debug(`External service: ${service}.${operation}`, logContext);
        }
    }
    rateLimitHit(service, operation, remaining, resetTime, context) {
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
        }
        else if (remaining < 10) {
            this.warn(`Rate limit warning: ${service}.${operation} - ${remaining} requests remaining`, logContext);
        }
        else {
            this.debug(`Rate limit status: ${service}.${operation} - ${remaining} requests remaining`, logContext);
        }
    }
    securityEvent(event, severity, context) {
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
    businessMetric(metric, value, unit, context) {
        const logContext = {
            ...context,
            businessMetric: metric,
            value,
            unit,
            timestamp: new Date().toISOString()
        };
        this.info(`Business metric: ${metric} = ${value}${unit ? ` ${unit}` : ''}`, logContext);
    }
    queueOperation(queue, operation, jobId, context) {
        const logContext = {
            ...context,
            queue,
            operation,
            jobId,
            queueOperation: true
        };
        this.info(`Queue: ${queue}.${operation}`, logContext);
    }
    getPerformanceMetrics() {
        return [...this.performanceMetrics];
    }
    getErrorMetrics() {
        return [...this.errorMetrics];
    }
    clearMetrics() {
        this.performanceMetrics = [];
        this.errorMetrics = [];
    }
    setLogLevel(level) {
        this.logLevel = LOG_LEVELS[level];
    }
}
exports.logger = new Logger();
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map