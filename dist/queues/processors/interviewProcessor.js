"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewProcessor = interviewProcessor;
const vapiInterviewService_1 = require("../../services/vapiInterviewService");
const interviewAnalysisService_1 = require("../../services/interviewAnalysisService");
const vapiInterviewService = new vapiInterviewService_1.VAPIInterviewService();
const interviewAnalysisService = new interviewAnalysisService_1.InterviewAnalysisService();
const logger_1 = require("../../utils/logger");
async function interviewProcessor(job) {
    const { candidateId, jobProfileId, batchId } = job.data;
    try {
        logger_1.logger.info(`Processing interview for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
            jobProfileId,
            batchId,
        });
        await job.progress(10);
        throw new Error('Interview processor needs database integration and proper method signatures');
        await job.progress(100);
        logger_1.logger.info(`Interview processing completed for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
        });
        return null;
    }
    catch (error) {
        logger_1.logger.error(`Interview processing failed for candidate ${candidateId}:`, error, {
            jobId: job.id,
            candidateId,
            jobProfileId,
            batchId,
        });
        throw error;
    }
}
//# sourceMappingURL=interviewProcessor.js.map