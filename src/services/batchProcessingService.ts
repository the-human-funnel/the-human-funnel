import { ResumeProcessingService } from './resumeProcessingService';
import { ProcessingBatch, ResumeData, Candidate } from '../models/interfaces';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface BatchProcessingProgress {
  batchId: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  currentFile?: string;
  progress: number; // 0-100
  status: 'processing' | 'completed' | 'failed';
}

export interface ResumeFile {
  buffer: Buffer;
  fileName: string;
}

export class BatchProcessingService extends EventEmitter {
  private resumeProcessor: ResumeProcessingService;
  private activeBatches: Map<string, BatchProcessingProgress>;

  constructor() {
    super();
    this.resumeProcessor = new ResumeProcessingService();
    this.activeBatches = new Map();
  }

  /**
   * Process multiple resume files in batch
   */
  async processBatch(
    files: ResumeFile[],
    jobProfileId: string,
    batchId?: string
  ): Promise<ProcessingBatch> {
    const batch: ProcessingBatch = {
      id: batchId || uuidv4(),
      jobProfileId,
      totalCandidates: files.length,
      processedCandidates: 0,
      failedCandidates: 0,
      status: 'processing',
      startedAt: new Date(),
      candidateIds: []
    };

    // Initialize progress tracking
    const progress: BatchProcessingProgress = {
      batchId: batch.id,
      totalFiles: files.length,
      processedFiles: 0,
      failedFiles: 0,
      progress: 0,
      status: 'processing'
    };

    this.activeBatches.set(batch.id, progress);

    try {
      const processedCandidates: Candidate[] = [];

      // Process files sequentially to avoid overwhelming the system
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!file) continue;
        
        // Update progress
        progress.currentFile = file.fileName;
        this.emit('progress', { ...progress });

        try {
          // Process the resume
          const resumeData = await this.resumeProcessor.processSingleResume(
            file.buffer,
            file.fileName
          );

          // Create candidate record
          const candidate: Candidate = {
            id: uuidv4(),
            resumeData,
            processingStage: 'resume',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          processedCandidates.push(candidate);
          batch.candidateIds.push(candidate.id);
          batch.processedCandidates++;

          if (resumeData.processingStatus === 'failed') {
            batch.failedCandidates++;
            progress.failedFiles++;
          }

        } catch (error) {
          batch.failedCandidates++;
          progress.failedFiles++;
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Create failed candidate record
          const failedCandidate: Candidate = {
            id: uuidv4(),
            resumeData: {
              id: uuidv4(),
              fileName: file.fileName,
              extractedText: '',
              contactInfo: { projectUrls: [] },
              processingStatus: 'failed',
              extractionErrors: [errorMessage]
            },
            processingStage: 'resume',
            createdAt: new Date(),
            updatedAt: new Date()
          };

          processedCandidates.push(failedCandidate);
          batch.candidateIds.push(failedCandidate.id);
        }

        // Update progress
        progress.processedFiles++;
        progress.progress = Math.round((progress.processedFiles / progress.totalFiles) * 100);
        this.emit('progress', { ...progress });
      }

      // Complete the batch
      batch.status = 'completed';
      batch.completedAt = new Date();
      progress.status = 'completed';
      delete progress.currentFile;

      this.emit('completed', { batch, candidates: processedCandidates });
      this.activeBatches.delete(batch.id);

      return batch;

    } catch (error) {
      batch.status = 'failed';
      batch.completedAt = new Date();
      progress.status = 'failed';

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { batch, error: errorMessage });
      this.activeBatches.delete(batch.id);

      throw error;
    }
  }

  /**
   * Get progress for a specific batch
   */
  getBatchProgress(batchId: string): BatchProcessingProgress | null {
    return this.activeBatches.get(batchId) || null;
  }

  /**
   * Get all active batches
   */
  getActiveBatches(): BatchProcessingProgress[] {
    return Array.from(this.activeBatches.values());
  }

  /**
   * Cancel a batch processing (if possible)
   */
  cancelBatch(batchId: string): boolean {
    const progress = this.activeBatches.get(batchId);
    if (progress && progress.status === 'processing') {
      progress.status = 'failed';
      this.activeBatches.delete(batchId);
      this.emit('cancelled', { batchId });
      return true;
    }
    return false;
  }

  /**
   * Generate batch summary report
   */
  generateBatchSummary(batch: ProcessingBatch): {
    summary: string;
    successRate: number;
    processingTime?: number;
  } {
    const successRate = batch.totalCandidates > 0 
      ? ((batch.processedCandidates - batch.failedCandidates) / batch.totalCandidates) * 100 
      : 0;

    const processingTime = batch.completedAt && batch.startedAt
      ? batch.completedAt.getTime() - batch.startedAt.getTime()
      : undefined;

    const summary = `
Batch Processing Summary:
- Total Files: ${batch.totalCandidates}
- Successfully Processed: ${batch.processedCandidates - batch.failedCandidates}
- Failed: ${batch.failedCandidates}
- Success Rate: ${successRate.toFixed(1)}%
- Status: ${batch.status}
${processingTime ? `- Processing Time: ${Math.round(processingTime / 1000)}s` : ''}
    `.trim();

    const result: {
      summary: string;
      successRate: number;
      processingTime?: number;
    } = {
      summary,
      successRate
    };

    if (processingTime !== undefined) {
      result.processingTime = processingTime;
    }

    return result;
  }
}