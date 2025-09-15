export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    uptime: number;
    version: string;
    services: {
        database: ServiceHealth;
        redis: ServiceHealth;
        queues: ServiceHealth;
        externalApis: {
            gemini: ServiceHealth;
            openai: ServiceHealth;
            claude: ServiceHealth;
            linkedin: ServiceHealth;
            github: ServiceHealth;
            vapi: ServiceHealth;
        };
    };
    metrics: {
        memoryUsage: NodeJS.MemoryUsage;
        cpuUsage: NodeJS.CpuUsage;
        activeConnections: number;
        queueStats: QueueStats;
    };
}
export interface ServiceHealth {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime?: number;
    lastChecked: Date;
    error?: string;
    details?: any;
}
export interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}
declare class HealthCheckService {
    private startTime;
    private activeConnections;
    constructor();
    incrementConnections(): void;
    decrementConnections(): void;
    checkDatabase(): Promise<ServiceHealth>;
    checkRedis(): Promise<ServiceHealth>;
    checkQueues(): Promise<ServiceHealth>;
    checkExternalApi(name: string, url: string, timeout?: number): Promise<ServiceHealth>;
    checkAiProviders(): Promise<{
        [provider: string]: ServiceHealth;
    }>;
    checkServiceConnectivity(): Promise<{
        database: ServiceHealth;
        redis: ServiceHealth;
        queues: ServiceHealth;
        aiProviders: {
            [provider: string]: ServiceHealth;
        };
        externalServices: {
            [service: string]: ServiceHealth;
        };
    }>;
    getQueueStats(): Promise<QueueStats>;
    getFullHealthStatus(): Promise<HealthStatus>;
    getBasicHealthStatus(): Promise<{
        status: string;
        timestamp: Date;
    }>;
}
export declare const healthCheckService: HealthCheckService;
export {};
//# sourceMappingURL=healthCheckService.d.ts.map