export declare class QueueMonitor {
    private monitoringInterval;
    private isMonitoring;
    startMonitoring(intervalMs?: number): void;
    stopMonitoring(): void;
    private performHealthCheck;
    getDetailedQueueMetrics(): Promise<{
        [queueName: string]: {
            stats: any;
            recentJobs: {
                completed: any[];
                failed: any[];
                active: any[];
            };
        };
    }>;
    generateHealthReport(): Promise<{
        timestamp: Date;
        redis: {
            connected: boolean;
            healthy: boolean;
        };
        queues: {
            [queueName: string]: {
                healthy: boolean;
                stats: any;
                issues: string[];
            };
        };
        summary: {
            totalQueues: number;
            healthyQueues: number;
            totalJobs: {
                waiting: number;
                active: number;
                completed: number;
                failed: number;
            };
            overallHealth: 'healthy' | 'warning' | 'critical';
        };
    }>;
    isMonitoringActive(): boolean;
}
export declare const queueMonitor: QueueMonitor;
//# sourceMappingURL=queueMonitor.d.ts.map