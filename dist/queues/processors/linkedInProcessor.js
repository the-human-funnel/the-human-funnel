"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkedInProcessor = linkedInProcessor;
const linkedInAnalysisService_1 = require("../../services/linkedInAnalysisService");
const linkedInAnalysisService = new linkedInAnalysisService_1.LinkedInAnalysisService();
const logger_1 = require("../../utils/logger");
async function linkedInProcessor(job) {
    const { candidateId, jobProfileId, batchId } = job.data;
    try {
        logger_1.logger.info(`Processing LinkedIn analysis for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
            jobProfileId,
            batchId,
        });
        await job.progress(10);
        throw new Error('LinkedIn analysis processor needs database integration to fetch candidate data');
        await job.progress(100);
        logger_1.logger.info(`LinkedIn analysis completed for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
        });
        return null;
    }
    catch (error) {
        logger_1.logger.error(`LinkedIn analysis failed for candidate ${candidateId}:`, error, {
            jobId: job.id,
            candidateId,
            jobProfileId,
            batchId,
        });
        throw error;
    }
}
//# sourceMappingURL=linkedInProcessor.js.map