"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueOrchestrator = exports.QueueOrchestrator = void 0;
const queues_1 = require("../queues");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
class QueueOrchestrator {
    async processCandidateBatch(candidateIds, jobProfileId) {
        const batchId = (0, uuid_1.v4)();
        try {
            logger_1.logger.info(`Starting batch processing for ${candidateIds.length} candidates`, {
                batchId,
                jobProfileId,
                candidateCount: candidateIds.length,
            });
            const batch = {
                id: batchId,
                jobProfileId,
                totalCandidates: candidateIds.length,
                processedCandidates: 0,
                failedCandidates: 0,
                status: 'processing',
                startedAt: new Date(),
                candidateIds,
            };
            const jobs = [];
            for (const candidateId of candidateIds) {
                const stageJobs = this.createPipelineJobs(candidateId, jobProfileId, batchId);
                jobs.push(...stageJobs);
            }
            await queues_1.queueManager.addBatchJobs(jobs);
            logger_1.logger.info(`Batch processing initiated with ${jobs.length} total jobs`, {
                batchId,
                totalJobs: jobs.length,
                candidateCount: candidateIds.length,
            });
            return batch;
        }
        catch (error) {
            logger_1.logger.error(`Failed to start batch processing:`, error, {
                batchId,
                jobProfileId,
                candidateCount: candidateIds.length,
            });
            throw error;
        }
    }
    createPipelineJobs(candidateId, jobProfileId, batchId) {
        const baseJobData = {
            candidateId,
            jobProfileId,
            batchId,
        };
        return [
            {
                queueName: queues_1.QUEUE_NAMES.RESUME_PROCESSING,
                jobData: { ...baseJobData, stage: 'resume', priority: 10 },
                options: { delay: 0 },
            },
            {
                queueName: queues_1.QUEUE_NAMES.AI_ANALYSIS,
                jobData: { ...baseJobData, stage: 'ai-analysis', priority: 8 },
                options: { delay: 5000 },
            },
            {
                queueName: queues_1.QUEUE_NAMES.LINKEDIN_ANALYSIS,
                jobData: { ...baseJobData, stage: 'linkedin', priority: 6 },
                options: { delay: 10000 },
            },
            {
                queueName: queues_1.QUEUE_NAMES.GITHUB_ANALYSIS,
                jobData: { ...baseJobData, stage: 'github', priority: 6 },
                options: { delay: 10000 },
            },
            {
                queueName: queues_1.QUEUE_NAMES.INTERVIEW_PROCESSING,
                jobData: { ...baseJobData, stage: 'interview', priority: 4 },
                options: { delay: 30000 },
            },
            {
                queueName: queues_1.QUEUE_NAMES.SCORING,
                jobData: { ...baseJobData, stage: 'scoring', priority: 2 },
                options: { delay: 60000 },
            },
        ];
    }
    async processIndividualCandidate(candidateId, jobProfileId, startFromStage = 'resume') {
        const batchId = (0, uuid_1.v4)();
        try {
            logger_1.logger.info(`Starting individual candidate processing`, {
                candidateId,
                jobProfileId,
                startFromStage,
                batchId,
            });
            const allStages = ['resume', 'ai-analysis', 'linkedin', 'github', 'interview', 'scoring'];
            const startIndex = allStages.indexOf(startFromStage);
            if (startIndex === -1) {
                throw new Error(`Invalid start stage: ${startFromStage}`);
            }
            const stagesToProcess = allStages.slice(startIndex);
            const jobs = this.createPipelineJobs(candidateId, jobProfileId, batchId)
                .filter(job => stagesToProcess.includes(job.jobData.stage));
            await queues_1.queueManager.addBatchJobs(jobs);
            logger_1.logger.info(`Individual candidate processing initiated`, {
                candidateId,
                jobProfileId,
                stagesCount: jobs.length,
                batchId,
            });
            return batchId;
        }
        catch (error) {
            logger_1.logger.error(`Failed to start individual candidate processing:`, error, {
                candidateId,
                jobProfileId,
                startFromStage,
            });
            throw error;
        }
    }
    async retryFailedCandidateStage(candidateId, jobProfileId, stage) {
        const batchId = (0, uuid_1.v4)();
        try {
            logger_1.logger.info(`Retrying failed stage for candidate`, {
                candidateId,
                jobProfileId,
                stage,
                batchId,
            });
            const queueName = this.getQueueNameForStage(stage);
            const jobData = {
                candidateId,
                jobProfileId,
                batchId,
                stage,
                priority: 10,
            };
            await queues_1.queueManager.addJob(queueName, jobData);
            logger_1.logger.info(`Retry job scheduled for candidate stage`, {
                candidateId,
                stage,
                batchId,
            });
            return batchId;
        }
        catch (error) {
            logger_1.logger.error(`Failed to retry candidate stage:`, error, {
                candidateId,
                jobProfileId,
                stage,
            });
            throw error;
        }
    }
    getQueueNameForStage(stage) {
        const stageToQueue = {
            'resume': queues_1.QUEUE_NAMES.RESUME_PROCESSING,
            'ai-analysis': queues_1.QUEUE_NAMES.AI_ANALYSIS,
            'linkedin': queues_1.QUEUE_NAMES.LINKEDIN_ANALYSIS,
            'github': queues_1.QUEUE_NAMES.GITHUB_ANALYSIS,
            'interview': queues_1.QUEUE_NAMES.INTERVIEW_PROCESSING,
            'scoring': queues_1.QUEUE_NAMES.SCORING,
        };
        const queueName = stageToQueue[stage];
        if (!queueName) {
            throw new Error(`Unknown stage: ${stage}`);
        }
        return queueName;
    }
    async pauseProcessing() {
        logger_1.logger.info('Pausing all queue processing');
        for (const queueName of Object.values(queues_1.QUEUE_NAMES)) {
            try {
                await queues_1.queueManager.pauseQueue(queueName);
            }
            catch (error) {
                logger_1.logger.error(`Failed to pause queue ${queueName}:`, error);
            }
        }
    }
    async resumeProcessing() {
        logger_1.logger.info('Resuming all queue processing');
        for (const queueName of Object.values(queues_1.QUEUE_NAMES)) {
            try {
                await queues_1.queueManager.resumeQueue(queueName);
            }
            catch (error) {
                logger_1.logger.error(`Failed to resume queue ${queueName}:`, error);
            }
        }
    }
    async retryAllFailedJobs() {
        logger_1.logger.info('Retrying all failed jobs across queues');
        const results = {};
        for (const queueName of Object.values(queues_1.QUEUE_NAMES)) {
            try {
                const retriedCount = await queues_1.queueManager.retryFailedJobs(queueName);
                results[queueName] = typeof retriedCount === 'number' ? retriedCount : 0;
            }
            catch (error) {
                logger_1.logger.error(`Failed to retry jobs in queue ${queueName}:`, error);
                results[queueName] = 0;
            }
        }
        return results;
    }
    async cleanupOldJobs(gracePeriodMs = 24 * 60 * 60 * 1000) {
        logger_1.logger.info(`Cleaning up jobs older than ${gracePeriodMs}ms`);
        for (const queueName of Object.values(queues_1.QUEUE_NAMES)) {
            try {
                await queues_1.queueManager.cleanQueue(queueName, gracePeriodMs);
            }
            catch (error) {
                logger_1.logger.error(`Failed to clean queue ${queueName}:`, error);
            }
        }
    }
    async getSystemStatus() {
        const queueStats = await queues_1.queueManager.getAllQueueStats();
        const totalJobs = queueStats.reduce((acc, stats) => ({
            waiting: acc.waiting + stats.waiting,
            active: acc.active + stats.active,
            completed: acc.completed + stats.completed,
            failed: acc.failed + stats.failed,
        }), { waiting: 0, active: 0, completed: 0, failed: 0 });
        return {
            queues: queueStats,
            totalJobs,
        };
    }
}
exports.QueueOrchestrator = QueueOrchestrator;
exports.queueOrchestrator = new QueueOrchestrator();
//# sourceMappingURL=queueOrchestrator.js.map