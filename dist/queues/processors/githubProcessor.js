"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubProcessor = githubProcessor;
const githubAnalysisService_1 = require("../../services/githubAnalysisService");
const githubAnalysisService = new githubAnalysisService_1.GitHubAnalysisService();
const logger_1 = require("../../utils/logger");
async function githubProcessor(job) {
    const { candidateId, jobProfileId, batchId } = job.data;
    try {
        logger_1.logger.info(`Processing GitHub analysis for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
            jobProfileId,
            batchId,
        });
        await job.progress(10);
        throw new Error('GitHub analysis processor needs database integration to fetch candidate data');
        await job.progress(100);
        logger_1.logger.info(`GitHub analysis completed for candidate ${candidateId}`, {
            jobId: job.id,
            candidateId,
        });
        return null;
    }
    catch (error) {
        logger_1.logger.error(`GitHub analysis failed for candidate ${candidateId}:`, error, {
            jobId: job.id,
            candidateId,
            jobProfileId,
            batchId,
        });
        throw error;
    }
}
//# sourceMappingURL=githubProcessor.js.map