"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchProcessingService = void 0;
const resumeProcessingService_1 = require("./resumeProcessingService");
const uuid_1 = require("uuid");
const events_1 = require("events");
class BatchProcessingService extends events_1.EventEmitter {
    constructor() {
        super();
        this.resumeProcessor = new resumeProcessingService_1.ResumeProcessingService();
        this.activeBatches = new Map();
    }
    async processBatch(files, jobProfileId, batchId) {
        const batch = {
            id: batchId || (0, uuid_1.v4)(),
            jobProfileId,
            totalCandidates: files.length,
            processedCandidates: 0,
            failedCandidates: 0,
            status: 'processing',
            startedAt: new Date(),
            candidateIds: []
        };
        const progress = {
            batchId: batch.id,
            totalFiles: files.length,
            processedFiles: 0,
            failedFiles: 0,
            progress: 0,
            status: 'processing'
        };
        this.activeBatches.set(batch.id, progress);
        try {
            const processedCandidates = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file)
                    continue;
                progress.currentFile = file.fileName;
                this.emit('progress', { ...progress });
                try {
                    const resumeData = await this.resumeProcessor.processSingleResume(file.buffer, file.fileName);
                    const candidate = {
                        id: (0, uuid_1.v4)(),
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
                }
                catch (error) {
                    batch.failedCandidates++;
                    progress.failedFiles++;
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    const failedCandidate = {
                        id: (0, uuid_1.v4)(),
                        resumeData: {
                            id: (0, uuid_1.v4)(),
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
                progress.processedFiles++;
                progress.progress = Math.round((progress.processedFiles / progress.totalFiles) * 100);
                this.emit('progress', { ...progress });
            }
            batch.status = 'completed';
            batch.completedAt = new Date();
            progress.status = 'completed';
            delete progress.currentFile;
            this.emit('completed', { batch, candidates: processedCandidates });
            this.activeBatches.delete(batch.id);
            return batch;
        }
        catch (error) {
            batch.status = 'failed';
            batch.completedAt = new Date();
            progress.status = 'failed';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.emit('error', { batch, error: errorMessage });
            this.activeBatches.delete(batch.id);
            throw error;
        }
    }
    getBatchProgress(batchId) {
        return this.activeBatches.get(batchId) || null;
    }
    getActiveBatches() {
        return Array.from(this.activeBatches.values());
    }
    cancelBatch(batchId) {
        const progress = this.activeBatches.get(batchId);
        if (progress && progress.status === 'processing') {
            progress.status = 'failed';
            this.activeBatches.delete(batchId);
            this.emit('cancelled', { batchId });
            return true;
        }
        return false;
    }
    generateBatchSummary(batch) {
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
        const result = {
            summary,
            successRate
        };
        if (processingTime !== undefined) {
            result.processingTime = processingTime;
        }
        return result;
    }
}
exports.BatchProcessingService = BatchProcessingService;
//# sourceMappingURL=batchProcessingService.js.map