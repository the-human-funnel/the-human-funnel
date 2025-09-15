import { ProcessingBatch } from '../models/interfaces';
import { EventEmitter } from 'events';
export interface BatchProcessingProgress {
    batchId: string;
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    currentFile?: string;
    progress: number;
    status: 'processing' | 'completed' | 'failed';
}
export interface ResumeFile {
    buffer: Buffer;
    fileName: string;
}
export declare class BatchProcessingService extends EventEmitter {
    private resumeProcessor;
    private activeBatches;
    constructor();
    processBatch(files: ResumeFile[], jobProfileId: string, batchId?: string): Promise<ProcessingBatch>;
    getBatchProgress(batchId: string): BatchProcessingProgress | null;
    getActiveBatches(): BatchProcessingProgress[];
    cancelBatch(batchId: string): boolean;
    generateBatchSummary(batch: ProcessingBatch): {
        summary: string;
        successRate: number;
        processingTime?: number;
    };
}
//# sourceMappingURL=batchProcessingService.d.ts.map