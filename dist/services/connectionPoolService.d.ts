import { AxiosRequestConfig, AxiosResponse } from 'axios';
export interface PoolConfig {
    maxConnections: number;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
    keepAlive: boolean;
    maxIdleTime: number;
}
export interface ApiEndpoint {
    name: string;
    baseURL: string;
    headers?: Record<string, string>;
    rateLimit?: {
        requests: number;
        windowMs: number;
    };
}
export interface RequestStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    lastRequestTime: Date | null;
}
export declare class ConnectionPoolService {
    private pools;
    private rateLimiters;
    private stats;
    private requestTimings;
    private defaultConfig;
    constructor();
    initializePool(endpoint: ApiEndpoint, config?: Partial<PoolConfig>): void;
    private createHttpAgent;
    private createHttpsAgent;
    request<T = any>(endpointName: string, config: AxiosRequestConfig, cacheOptions?: {
        enabled: boolean;
        ttl?: number;
        key?: string;
    }): Promise<AxiosResponse<T>>;
    private executeWithRetry;
    private shouldRetry;
    private checkRateLimit;
    private updateStats;
    private generateCacheKey;
    getStats(endpointName?: string): Map<string, RequestStats> | RequestStats | null;
    getPoolNames(): string[];
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    resetStats(endpointName?: string): void;
    cleanup(): Promise<void>;
}
export declare const connectionPoolService: ConnectionPoolService;
//# sourceMappingURL=connectionPoolService.d.ts.map