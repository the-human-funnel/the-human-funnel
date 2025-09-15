export interface FileProcessingOptions {
    maxConcurrentFiles: number;
    chunkSize: number;
    useStreaming: boolean;
    enableCaching: boolean;
    tempDirectory: string;
}
export interface ProcessingResult {
    fileName: string;
    success: boolean;
    extractedText?: string;
    contactInfo?: {
        phone?: string;
        email?: string;
        linkedInUrl?: string;
        githubUrl?: string;
        projectUrls: string[];
    };
    fileSize: number;
    processingTime: number;
    error?: string;
}
export interface BatchProcessingStats {
    totalFiles: number;
    processedFiles: number;
    successfulFiles: number;
    failedFiles: number;
    totalSize: number;
    averageProcessingTime: number;
    startTime: Date;
    endTime?: Date;
}
export declare class OptimizedFileProcessingService {
    private readonly options;
    private readonly contactRegexes;
    private processingQueue;
    private activeProcessing;
    constructor(options?: Partial<FileProcessingOptions>);
    private ensureTempDirectory;
    processBatch(files: Array<{
        name: string;
        buffer: Buffer;
    }>): Promise<{
        results: ProcessingResult[];
        stats: BatchProcessingStats;
    }>;
    private processChunk;
    processFile(fileName: string, buffer: Buffer): Promise<ProcessingResult>;
    private processFileStreaming;
    private processFileInMemory;
    private extractContactInformation;
    private generateCacheKey;
    private waitForMemoryAvailability;
    processBatchFromPaths(filePaths: string[]): Promise<{
        results: ProcessingResult[];
        stats: BatchProcessingStats;
    }>;
    getProcessingOptions(): FileProcessingOptions;
    updateProcessingOptions(options: Partial<FileProcessingOptions>): void;
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    cleanup(): Promise<void>;
}
export declare const optimizedFileProcessingService: OptimizedFileProcessingService;
//# sourceMappingURL=optimizedFileProcessingService.d.ts.map