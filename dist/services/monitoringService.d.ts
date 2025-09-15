export interface ApiUsageMetric {
    service: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTime: number;
    timestamp: Date;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
}
export interface RateLimitStatus {
    service: string;
    remaining: number;
    limit: number;
    resetTime: Date;
    isNearLimit: boolean;
    isExceeded: boolean;
}
export interface SystemMetrics {
    timestamp: Date;
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    uptime: number;
    activeConnections: number;
    queueStats: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
    };
    apiUsage: {
        totalRequests: number;
        successRate: number;
        averageResponseTime: number;
        rateLimitViolations: number;
    };
}
export interface Alert {
    id: string;
    type: 'error' | 'warning' | 'info';
    service: string;
    message: string;
    timestamp: Date;
    metadata?: any;
    resolved?: boolean;
    resolvedAt?: Date;
}
declare class MonitoringService {
    private apiMetrics;
    private rateLimits;
    private alerts;
    private maxMetricsHistory;
    private maxAlertsHistory;
    private systemStartTime;
    constructor();
    recordApiUsage(metric: Omit<ApiUsageMetric, 'timestamp'>): void;
    private getServiceRateLimit;
    private getServiceRateLimitThreshold;
    updateRateLimitStatus(service: string, status: RateLimitStatus): void;
    getRateLimitStatus(service?: string): RateLimitStatus[];
    createAlert(type: Alert['type'], service: string, message: string, metadata?: any): string;
    resolveAlert(alertId: string): boolean;
    getAlerts(service?: string, resolved?: boolean): Alert[];
    private checkSystemHealth;
    getSystemMetrics(): Promise<SystemMetrics>;
    recordBusinessMetric(metric: string, value: number, unit?: string, metadata?: any): void;
    recordSystemPerformance(): void;
    private cleanupOldMetrics;
    private persistMetrics;
    getApiMetrics(service?: string, hours?: number): ApiUsageMetric[];
    clearMetrics(): void;
    getMonitoringStatus(): {
        metricsCount: number;
        alertsCount: number;
        rateLimitsCount: number;
        unresolvedAlerts: number;
    };
}
export declare const monitoringService: MonitoringService;
export {};
//# sourceMappingURL=monitoringService.d.ts.map