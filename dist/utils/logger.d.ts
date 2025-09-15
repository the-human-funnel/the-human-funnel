interface LogLevel {
    ERROR: 0;
    WARN: 1;
    INFO: 2;
    DEBUG: 3;
}
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
declare class Logger {
    private logLevel;
    private performanceMetrics;
    private errorMetrics;
    private maxMetricsHistory;
    constructor();
    private formatMessage;
    private shouldLog;
    private addPerformanceMetric;
    private addErrorMetric;
    error(message: string, error?: Error | any, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    performance(operation: string, duration: number, success?: boolean, context?: LogContext): void;
    apiRequest(method: string, path: string, statusCode: number, duration: number, context?: LogContext): void;
    externalService(service: string, operation: string, success: boolean, duration: number, context?: LogContext): void;
    rateLimitHit(service: string, operation: string, remaining: number, resetTime: Date, context?: LogContext): void;
    securityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext): void;
    businessMetric(metric: string, value: number, unit?: string, context?: LogContext): void;
    queueOperation(queue: string, operation: string, jobId?: string, context?: LogContext): void;
    getPerformanceMetrics(): PerformanceMetric[];
    getErrorMetrics(): ErrorMetric[];
    clearMetrics(): void;
    setLogLevel(level: keyof LogLevel): void;
}
export declare const logger: Logger;
export default logger;
//# sourceMappingURL=logger.d.ts.map