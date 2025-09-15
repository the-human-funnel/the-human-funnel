"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeProcessor = resumeProcessor;
const resumeProcessingService_1 = require("../../services/resumeProcessingService");
const resumeProcessingService = new resumeProcessingService_1.ResumeProcessingService();
const logger_1 = require("../../utils/logger");
async function resumeProcessor(job) {
    const { candidateId, jobProfileId, batchId } = job.data;
    try {
        logger_1.logger.info(`Processing resume for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
            batchId,
        });
        await job.progress(10);
        throw new Error('Resume processor needs database integration to fetch resume file');
        await job.progress(100);
        logger_1.logger.info(`Resume processing completed for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
            success: true,
        });
        return null;
    }
    catch (error) {
        logger_1.logger.error(`Resume processing failed for candidate ${candidateId}:`, error, {
            jobId: job.id,
            candidateId,
            batchId,
        });
        throw error;
    }
}
//# sourceMappingURL=resumeProcessor.js.map