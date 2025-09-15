"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringProcessor = scoringProcessor;
const scoringService_1 = require("../../services/scoringService");
const scoringService = new scoringService_1.ScoringService();
const logger_1 = require("../../utils/logger");
async function scoringProcessor(job) {
    const { candidateId, jobProfileId, batchId } = job.data;
    try {
        logger_1.logger.info(`Processing scoring for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
            jobProfileId,
            batchId,
        });
        await job.progress(10);
        throw new Error('Scoring processor needs database integration to fetch analysis results');
        await job.progress(100);
        logger_1.logger.info(`Scoring completed for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
        });
        return null;
    }
    catch (error) {
        logger_1.logger.error(`Scoring failed for candidate ${candidateId}:`, error, {
            jobId: job.id,
            candidateId,
            jobProfileId,
            batchId,
        });
        throw error;
    }
}
//# sourceMappingURL=scoringProcessor.js.map