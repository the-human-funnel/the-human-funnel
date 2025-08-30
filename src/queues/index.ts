import Bull, { Queue, Job, JobOptions } from 'bull';
import { redisClient } from '../utils/redis';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { JobData, JobProgress, QueueStats, BatchProgress } from '../models/interfaces';

// Import processors
import { resumeProcessor } from './processors/resumeProcessor';
import { aiAnalysisProcessor } from './processors/aiAnalysisProcessor';
import { linkedInProcessor } from './processors/linkedInProcessor';
import { githubProcessor } from './processors/githubProcessor';
import { interviewProcessor } from './processors/interviewProcessor';
import { scoringProcessor } from './processors/scoringProcessor';

export class QueueManager {
  private queues: Map<string, Queue> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      // Ensure Redis is connected
      if (!redisClient.isClientConnected()) {
        await redisClient.connect();
      }

      // Create queues for each processing stage
      const queueConfigs = [
        { name: 'resume-processing', processor: resumeProcessor, concurrency: 5 },
        { name: 'ai-analysis', processor: aiAnalysisProcessor, concurrency: 3 },
        { name: 'linkedin-analysis', processor: linkedInProcessor, concurrency: 2 },
        { name: 'github-analysis', processor: githubProcessor, concurrency: 3 },
        { name: 'interview-processing', processor: interviewProcessor, concurrency: 1 },
        { name: 'scoring', processor: scoringProcessor, concurrency: 5 },
      ];

      for (const queueConfig of queueConfigs) {
        const queue = new Bull(queueConfig.name, {
          redis: {
            host: config.redis.host,
            port: config.redis.port,
            ...(config.redis.password && { password: config.redis.password }),
          },
          defaultJobOptions: {
            removeOnComplete: 100, // Keep last 100 completed jobs
            removeOnFail: 50, // Keep last 50 failed jobs
            attempts: config.processing.maxRetries,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        });

        // Set up processor
        queue.process(queueConfig.concurrency, queueConfig.processor);

        // Set up event listeners
        this.setupQueueEventListeners(queue);

        this.queues.set(queueConfig.name, queue);
        logger.info(`Queue ${queueConfig.name} initialized with concurrency ${queueConfig.concurrency}`);
      }

      this.isInitialized = true;
      logger.info('Queue Manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Queue Manager:', error);
      throw error;
    }
  }

  private setupQueueEventListeners(queue: Queue): void {
    queue.on('completed', (job: Job, result: any) => {
      logger.info(`Job ${job.id} completed in queue ${queue.name}`, {
        jobId: job.id,
        queue: queue.name,
        duration: Date.now() - job.processedOn!,
      });
    });

    queue.on('failed', (job: Job, err: Error) => {
      logger.error(`Job ${job.id} failed in queue ${queue.name}:`, err, {
        jobId: job.id,
        queue: queue.name,
        attempts: job.attemptsMade,
        data: job.data,
      });
    });

    queue.on('progress', (job: Job, progress: number) => {
      logger.debug(`Job ${job.id} progress: ${progress}%`, {
        jobId: job.id,
        queue: queue.name,
        progress,
      });
    });

    queue.on('stalled', (job: Job) => {
      logger.warn(`Job ${job.id} stalled in queue ${queue.name}`, {
        jobId: job.id,
        queue: queue.name,
      });
    });

    queue.on('error', (error: Error) => {
      logger.error(`Queue ${queue.name} error:`, error);
    });
  }

  async addJob(queueName: string, jobData: JobData, options?: JobOptions): Promise<Job> {
    if (!this.isInitialized) {
      throw new Error('Queue Manager not initialized');
    }

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobOptions: JobOptions = {
      priority: jobData.priority || 0,
      delay: options?.delay || 0,
      ...options,
    };

    const job = await queue.add(jobData, jobOptions);
    logger.info(`Job added to queue ${queueName}`, {
      jobId: job.id,
      candidateId: jobData.candidateId,
      stage: jobData.stage,
    });

    return job;
  }

  async addBatchJobs(jobs: Array<{ queueName: string; jobData: JobData; options?: JobOptions }>): Promise<Job[]> {
    const addedJobs: Job[] = [];

    for (const jobConfig of jobs) {
      try {
        const job = await this.addJob(jobConfig.queueName, jobConfig.jobData, jobConfig.options);
        addedJobs.push(job);
      } catch (error) {
        logger.error(`Failed to add job to queue ${jobConfig.queueName}:`, error);
        throw error;
      }
    }

    return addedJobs;
  }

  async getJobProgress(queueName: string, jobId: string): Promise<JobProgress | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const jobProgress: JobProgress = {
      jobId: job.id!.toString(),
      candidateId: job.data.candidateId,
      stage: job.data.stage,
      progress: job.progress(),
      status: (await job.getState()) as 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused',
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

  async getBatchProgress(batchId: string): Promise<BatchProgress | null> {
    try {
      const batchJobs: Job[] = [];
      
      // Collect all jobs for this batch across all queues
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

      const stages: { [stage: string]: { total: number; completed: number; failed: number; progress: number } } = {};

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

      // Calculate stage progress
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
    } catch (error) {
      logger.error(`Failed to get batch progress for ${batchId}:`, error);
      return null;
    }
  }

  async getQueueStats(queueName: string): Promise<QueueStats | null> {
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

  async getAllQueueStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];
    
    for (const queueName of this.queues.keys()) {
      const queueStats = await this.getQueueStats(queueName);
      if (queueStats) {
        stats.push(queueStats);
      }
    }

    return stats;
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }

  async retryFailedJobs(queueName: string): Promise<number> {
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
      } catch (error) {
        logger.error(`Failed to retry job ${job.id}:`, error);
      }
    }

    logger.info(`Retried ${retriedCount} failed jobs in queue ${queueName}`);
    return retriedCount;
  }

  async cleanQueue(queueName: string, grace: number = 5000): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    logger.info(`Cleaned queue ${queueName}`);
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down Queue Manager...');

    for (const [queueName, queue] of this.queues) {
      try {
        await queue.close();
        logger.info(`Queue ${queueName} closed`);
      } catch (error) {
        logger.error(`Error closing queue ${queueName}:`, error);
      }
    }

    this.queues.clear();
    this.isInitialized = false;
    logger.info('Queue Manager shutdown complete');
  }

  getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }

  getAllQueues(): Map<string, Queue> {
    return new Map(this.queues);
  }

  isReady(): boolean {
    return this.isInitialized;
  }
}

// Create singleton instance
export const queueManager = new QueueManager();

// Export queue names as constants
export const QUEUE_NAMES = {
  RESUME_PROCESSING: 'resume-processing',
  AI_ANALYSIS: 'ai-analysis',
  LINKEDIN_ANALYSIS: 'linkedin-analysis',
  GITHUB_ANALYSIS: 'github-analysis',
  INTERVIEW_PROCESSING: 'interview-processing',
  SCORING: 'scoring',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];