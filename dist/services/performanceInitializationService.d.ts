export interface PerformanceConfig {
    enableCaching: boolean;
    enableConnectionPooling: boolean;
    enableMemoryManagement: boolean;
    enableOptimizedFileProcessing: boolean;
    enableDatabaseOptimizations: boolean;
}
export declare class PerformanceInitializationService {
    private isInitialized;
    private performanceConfig;
    constructor();
    initialize(): Promise<void>;
    private initializeDatabaseOptimizations;
    private initializeCaching;
    private initializeConnectionPooling;
    private initializeMemoryManagement;
    private initializeOptimizedFileProcessing;
    getHealthStatus(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    getPerformanceStats(): Promise<any>;
    updateConfig(config: Partial<PerformanceConfig>): void;
    shutdown(): Promise<void>;
    isReady(): boolean;
}
export declare const performanceInitializationService: PerformanceInitializationService;
//# sourceMappingURL=performanceInitializationService.d.ts.map