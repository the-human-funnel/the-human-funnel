"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUE_NAMES = exports.queueManager = exports.QueueManager = void 0;
const bull_1 = __importDefault(require("bull"));
const redis_1 = require("../utils/redis");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const resumeProcessor_1 = require("./processors/resumeProcessor");
const aiAnalysisProcessor_1 = require("./processors/aiAnalysisProcessor");
const linkedInProcessor_1 = require("./processors/linkedInProcessor");
const githubProcessor_1 = require("./processors/githubProcessor");
const interviewProcessor_1 = require("./processors/interviewProcessor");
const scoringProcessor_1 = require("./processors/scoringProcessor");
class QueueManager {
    constructor() {
        this.queues = new Map();
        this.isInitialized = false;
    }
    async initialize() {
        try {
            if (!redis_1.redisClient.isClientConnected()) {
                await redis_1.redisClient.connect();
            }
            const queueConfigs = [
                { name: 'resume-processing', processor: resumeProcessor_1.resumeProcessor, concurrency: 5 },
                { name: 'ai-analysis', processor: aiAnalysisProcessor_1.aiAnalysisProcessor, concurrency: 3 },
                { name: 'linkedin-analysis', processor: linkedInProcessor_1.linkedInProcessor, concurrency: 2 },
                { name: 'github-analysis', processor: githubProcessor_1.githubProcessor, concurrency: 3 },
                { name: 'interview-processing', processor: interviewProcessor_1.interviewProcessor, concurrency: 1 },
                { name: 'scoring', processor: scoringProcessor_1.scoringProcessor, concurrency: 5 },
            ];
            for (const queueConfig of queueConfigs) {
                const queue = new bull_1.default(queueConfig.name, {
                    redis: {
                        host: config_1.config.redis.host,
                        port: config_1.config.redis.port,
                        ...(config_1.config.redis.password && { password: config_1.config.redis.password }),
                    },
                    defaultJobOptions: {
                        removeOnComplete: 100,
                        removeOnFail: 50,
                        attempts: config_1.config.processing.maxRetries,
                        backoff: {
                            type: 'exponential',
                            delay: 2000,
                        },
                    },
                });
                queue.process(queueConfig.concurrency, queueConfig.processor);
                this.setupQueueEventListeners(queue);
                this.queues.set(queueConfig.name, queue);
                logger_1.logger.info(`Queue ${queueConfig.name} initialized with concurrency ${queueConfig.concurrency}`);
            }
            this.isInitialized = true;
            logger_1.logger.info('Queue Manager initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Queue Manager:', error);
            throw error;
        }
    }
    setupQueueEventListeners(queue) {
        queue.on('completed', (job, result) => {
            logger_1.logger.info(`Job ${job.id} completed in queue ${queue.name}`, {
                jobId: job.id,
                queue: queue.name,
                duration: Date.now() - job.processedOn,
            });
        });
        queue.on('failed', (job, err) => {
            logger_1.logger.error(`Job ${job.id} failed in queue ${queue.name}:`, err, {
                jobId: job.id,
                queue: queue.name,
                attempts: job.attemptsMade,
                data: job.data,
            });
        });
        queue.on('progress', (job, progress) => {
            logger_1.logger.debug(`Job ${job.id} progress: ${progress}%`, {
                jobId: job.id,
                queue: queue.name,
                progress,
            });
        });
        queue.on('stalled', (job) => {
            logger_1.logger.warn(`Job ${job.id} stalled in queue ${queue.name}`, {
                jobId: job.id,
                queue: queue.name,
            });
        });
        queue.on('error', (error) => {
            logger_1.logger.error(`Queue ${queue.name} error:`, error);
        });
    }
    async addJob(queueName, jobData, options) {
        if (!this.isInitialized) {
            throw new Error('Queue Manager not initialized');
        }
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        const jobOptions = {
            priority: jobData.priority || 0,
            delay: options?.delay || 0,
            ...options,
        };
        const job = await queue.add(jobData, jobOptions);
        logger_1.logger.info(`Job added to queue ${queueName}`, {
            jobId: job.id,
            candidateId: jobData.candidateId,
            stage: jobData.stage,
        });
        return job;
    }
    async addBatchJobs(jobs) {
        const addedJobs = [];
        for (const jobConfig of jobs) {
            try {
                const job = await this.addJob(jobConfig.queueName, jobConfig.jobData, jobConfig.options);
                addedJobs.push(job);
            }
            catch (error) {
                logger_1.logger.error(`Failed to add job to queue ${jobConfig.queueName}:`, error);
                throw error;
            }
        }
        return addedJobs;
    }
    async getJobProgress(queueName, jobId) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            return null;
        }
        const job = await queue.getJob(jobId);
        if (!job) {
            return null;
        }
        const jobProgress = {
            jobId: job.id.toString(),
            candidateId: job.data.candidateId,
            stage: job.data.stage,
            progress: job.progress(),
            status: (await job.getState()),
        };
        if (job.processedOn) {
            jobProgress.startedAt = new Date(job.processedOn);
        }
        if (job.finishedOn) {
            jobProgress.completedAt = new Date(job.finishedOn);
        }
        if (job.failedReason) {
            jobProgress.error = job.failedReason;
        }
        if (job.returnvalue) {
            jobProgress.result = job.returnvalue;
        }
        return jobProgress;
    }
    async getBatchProgress(batchId) {
        try {
            const batchJobs = [];
            for (const [queueName, queue] of this.queues) {
                const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed', 'paused']);
                const batchSpecificJobs = jobs.filter(job => job.data.batchId === batchId);
                batchJobs.push(...batchSpecificJobs);
            }
            if (batchJobs.length === 0) {
                return null;
            }
            const totalJobs = batchJobs.length;
            let completedJobs = 0;
            let failedJobs = 0;
            let activeJobs = 0;
            const stages = {};
            for (const job of batchJobs) {
                const state = await job.getState();
                const stage = job.data.stage;
                if (!stages[stage]) {
                    stages[stage] = { total: 0, completed: 0, failed: 0, progress: 0 };
                }
                stages[stage].total++;
                switch (state) {
                    case 'completed':
                        completedJobs++;
                        stages[stage].completed++;
                        break;
                    case 'failed':
                        failedJobs++;
                        stages[stage].failed++;
                        break;
                    case 'active':
                        activeJobs++;
                        break;
                }
            }
            for (const stage in stages) {
                const stageData = stages[stage];
                if (stageData) {
                    stageData.progress = Math.round(((stageData.completed + stageData.failed) / stageData.total) * 100);
                }
            }
            const progress = Math.round(((completedJobs + failedJobs) / totalJobs) * 100);
            return {
                batchId,
                totalJobs,
                completedJobs,
                failedJobs,
                activeJobs,
                progress,
                stages,
            };
        }
        catch (error) {
            logger_1.logger.error(`Failed to get batch progress for ${batchId}:`, error);
            return null;
        }
    }
    async getQueueStats(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            return null;
        }
        const waiting = await queue.getWaiting();
        const active = await queue.getActive();
        const completed = await queue.getCompleted();
        const failed = await queue.getFailed();
        const delayed = await queue.getDelayed();
        const paused = await queue.getJobs(['paused']);
        return {
            queueName,
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
            paused: paused.length,
        };
    }
    async getAllQueueStats() {
        const stats = [];
        for (const queueName of this.queues.keys()) {
            const queueStats = await this.getQueueStats(queueName);
            if (queueStats) {
                stats.push(queueStats);
            }
        }
        return stats;
    }
    async pauseQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        await queue.pause();
        logger_1.logger.info(`Queue ${queueName} paused`);
    }
    async resumeQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        await queue.resume();
        logger_1.logger.info(`Queue ${queueName} resumed`);
    }
    async retryFailedJobs(queueName) {
        if (queueName) {
            const queue = this.queues.get(queueName);
            if (!queue) {
                throw new Error(`Queue ${queueName} not found`);
            }
            const failedJobs = await queue.getFailed();
            let retriedCount = 0;
            for (const job of failedJobs) {
                try {
                    await job.retry();
                    retriedCount++;
                }
                catch (error) {
                    logger_1.logger.error(`Failed to retry job ${job.id}:`, error);
                }
            }
            logger_1.logger.info(`Retried ${retriedCount} failed jobs in queue ${queueName}`);
            return retriedCount;
        }
        else {
            const results = {};
            for (const [name, queue] of this.queues) {
                const failedJobs = await queue.getFailed();
                let retriedCount = 0;
                for (const job of failedJobs) {
                    try {
                        await job.retry();
                        retriedCount++;
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to retry job ${job.id}:`, error);
                    }
                }
                results[name] = retriedCount;
                logger_1.logger.info(`Retried ${retriedCount} failed jobs in queue ${name}`);
            }
            return results;
        }
    }
    async restartStalledJobs() {
        const results = {};
        for (const [queueName, queue] of this.queues) {
            try {
                const stalledJobs = await queue.getJobs(['active']);
                let restartedCount = 0;
                for (const job of stalledJobs) {
                    try {
                        await job.retry();
                        restartedCount++;
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to restart stalled job ${job.id}:`, error);
                    }
                }
                results[queueName] = restartedCount;
                logger_1.logger.info(`Restarted ${restartedCount} stalled jobs in queue ${queueName}`);
            }
            catch (error) {
                logger_1.logger.error(`Error restarting stalled jobs in queue ${queueName}:`, error);
                results[queueName] = 0;
            }
        }
        return results;
    }
    async getHealthStatus() {
        try {
            const queueStats = await this.getAllQueueStats();
            const totalFailed = queueStats.reduce((sum, stats) => sum + stats.failed, 0);
            const totalActive = queueStats.reduce((sum, stats) => sum + stats.active, 0);
            const totalWaiting = queueStats.reduce((sum, stats) => sum + stats.waiting, 0);
            const healthy = totalFailed < 100 && (totalActive > 0 || totalWaiting === 0);
            return {
                healthy,
                details: {
                    totalQueues: this.queues.size,
                    totalFailed,
                    totalActive,
                    totalWaiting,
                    queueStats,
                    isInitialized: this.isInitialized
                }
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get queue health status:', error);
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    isInitialized: this.isInitialized
                }
            };
        }
    }
    async getAggregatedQueueStats() {
        try {
            const allStats = await this.getAllQueueStats();
            return {
                waiting: allStats.reduce((sum, stats) => sum + stats.waiting, 0),
                active: allStats.reduce((sum, stats) => sum + stats.active, 0),
                completed: allStats.reduce((sum, stats) => sum + stats.completed, 0),
                failed: allStats.reduce((sum, stats) => sum + stats.failed, 0),
                delayed: allStats.reduce((sum, stats) => sum + stats.delayed, 0)
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get aggregated queue stats:', error);
            return {
                waiting: 0,
                active: 0,
                completed: 0,
                failed: 0,
                delayed: 0
            };
        }
    }
    async cleanQueue(queueName, grace = 5000) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        await queue.clean(grace, 'completed');
        await queue.clean(grace, 'failed');
        logger_1.logger.info(`Cleaned queue ${queueName}`);
    }
    async shutdown() {
        logger_1.logger.info('Shutting down Queue Manager...');
        for (const [queueName, queue] of this.queues) {
            try {
                await queue.close();
                logger_1.logger.info(`Queue ${queueName} closed`);
            }
            catch (error) {
                logger_1.logger.error(`Error closing queue ${queueName}:`, error);
            }
        }
        this.queues.clear();
        this.isInitialized = false;
        logger_1.logger.info('Queue Manager shutdown complete');
    }
    getQueue(queueName) {
        return this.queues.get(queueName);
    }
    getAllQueues() {
        return new Map(this.queues);
    }
    isReady() {
        return this.isInitialized;
    }
}
exports.QueueManager = QueueManager;
exports.queueManager = new QueueManager();
exports.QUEUE_NAMES = {
    RESUME_PROCESSING: 'resume-processing',
    AI_ANALYSIS: 'ai-analysis',
    LINKEDIN_ANALYSIS: 'linkedin-analysis',
    GITHUB_ANALYSIS: 'github-analysis',
    INTERVIEW_PROCESSING: 'interview-processing',
    SCORING: 'scoring',
};
//# sourceMappingURL=index.js.map