import { EventEmitter } from 'events';
export interface MemoryStats {
    used: number;
    total: number;
    free: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
}
export interface MemoryThresholds {
    warning: number;
    critical: number;
    cleanup: number;
}
export interface ProcessingLimits {
    maxConcurrentJobs: number;
    maxBatchSize: number;
    maxFileSize: number;
    maxMemoryPerJob: number;
}
export declare class MemoryManagementService extends EventEmitter {
    private readonly thresholds;
    private readonly limits;
    private monitoringInterval;
    private readonly monitoringIntervalMs;
    private memoryHistory;
    private readonly maxHistorySize;
    private activeJobs;
    private cleanupCallbacks;
    constructor();
    private calculateMaxConcurrentJobs;
    private calculateMaxBatchSize;
    private getTotalSystemMemory;
    private startMonitoring;
    private stopMonitoring;
    private setupProcessHandlers;
    getMemoryStats(): MemoryStats;
    private checkMemoryUsage;
    private handleWarningMemory;
    private handleHighMemory;
    private handleCriticalMemory;
    private forceGarbageCollection;
    private executeCleanupCallbacks;
    registerCleanupCallback(callback: () => Promise<void>): void;
    unregisterCleanupCallback(callback: () => Promise<void>): void;
    canStartNewJob(): boolean;
    registerJob(jobId: string): void;
    unregisterJob(jobId: string): void;
    getProcessingLimits(): ProcessingLimits;
    updateProcessingLimits(limits: Partial<ProcessingLimits>): void;
    getMemoryHistory(): MemoryStats[];
    getActiveJobs(): Map<string, {
        startTime: Date;
        memoryAtStart: number;
    }>;
    isFileSizeAllowed(fileSize: number): boolean;
    isBatchSizeAllowed(batchSize: number): boolean;
    getMemoryTrend(): 'increasing' | 'decreasing' | 'stable';
    private handleUncaughtException;
    private handleUnhandledRejection;
    private handleShutdown;
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    shutdown(): Promise<void>;
}
export declare const memoryManagementService: MemoryManagementService;
//# sourceMappingURL=memoryManagementService.d.ts.map