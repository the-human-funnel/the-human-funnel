import { queueManager, QUEUE_NAMES } from '../queues';
import { JobData, ProcessingBatch, Candidate } from '../models/interfaces';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class QueueOrchestrator {
  async processCandidateBatch(
    candidateIds: string[],
    jobProfileId: string
  ): Promise<ProcessingBatch> {
    const batchId = uuidv4();
    
    try {
      logger.info(`Starting batch processing for ${candidateIds.length} candidates`, {
        batchId,
        jobProfileId,
        candidateCount: candidateIds.length,
      });

      // Create processing batch record
      const batch: ProcessingBatch = {
        id: batchId,
        jobProfileId,
        totalCandidates: candidateIds.length,
        processedCandidates: 0,
        failedCandidates: 0,
        status: 'processing',
        startedAt: new Date(),
        candidateIds,
      };

      // Schedule jobs for each candidate through the processing pipeline
      const jobs = [];

      for (const candidateId of candidateIds) {
        // Create jobs for each stage of the pipeline
        const stageJobs = this.createPipelineJobs(candidateId, jobProfileId, batchId);
        jobs.push(...stageJobs);
      }

      // Add all jobs to their respective queues
      await queueManager.addBatchJobs(jobs);

      logger.info(`Batch processing initiated with ${jobs.length} total jobs`, {
        batchId,
        totalJobs: jobs.length,
        candidateCount: candidateIds.length,
      });

      return batch;
    } catch (error) {
      logger.error(`Failed to start batch processing:`, error, {
        batchId,
        jobProfileId,
        candidateCount: candidateIds.length,
      });
      throw error;
    }
  }

  private createPipelineJobs(
    candidateId: string,
    jobProfileId: string,
    batchId: string
  ): Array<{ queueName: string; jobData: JobData; options?: any }> {
    const baseJobData = {
      candidateId,
      jobProfileId,
      batchId,
    };

    // Define the processing pipeline with dependencies
    return [
      {
        queueName: QUEUE_NAMES.RESUME_PROCESSING,
        jobData: { ...baseJobData, stage: 'resume' as const, priority: 10 },
        options: { delay: 0 },
      },
      {
        queueName: QUEUE_NAMES.AI_ANALYSIS,
        jobData: { ...baseJobData, stage: 'ai-analysis' as const, priority: 8 },
        options: { delay: 5000 }, // Wait 5 seconds after resume processing
      },
      {
        queueName: QUEUE_NAMES.LINKEDIN_ANALYSIS,
        jobData: { ...baseJobData, stage: 'linkedin' as const, priority: 6 },
        options: { delay: 10000 }, // Wait 10 seconds
      },
      {
        queueName: QUEUE_NAMES.GITHUB_ANALYSIS,
        jobData: { ...baseJobData, stage: 'github' as const, priority: 6 },
        options: { delay: 10000 }, // Wait 10 seconds (parallel with LinkedIn)
      },
      {
        queueName: QUEUE_NAMES.INTERVIEW_PROCESSING,
        jobData: { ...baseJobData, stage: 'interview' as const, priority: 4 },
        options: { delay: 30000 }, // Wait 30 seconds for other analyses to complete
      },
      {
        queueName: QUEUE_NAMES.SCORING,
        jobData: { ...baseJobData, stage: 'scoring' as const, priority: 2 },
        options: { delay: 60000 }, // Wait 1 minute for all analyses to complete
      },
    ];
  }

  async processIndividualCandidate(
    candidateId: string,
    jobProfileId: string,
    startFromStage: 'resume' | 'ai-analysis' | 'linkedin' | 'github' | 'interview' | 'scoring' = 'resume'
  ): Promise<string> {
    const batchId = uuidv4();
    
    try {
      logger.info(`Starting individual candidate processing`, {
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

      await queueManager.addBatchJobs(jobs);

      logger.info(`Individual candidate processing initiated`, {
        candidateId,
        jobProfileId,
        stagesCount: jobs.length,
        batchId,
      });

      return batchId;
    } catch (error) {
      logger.error(`Failed to start individual candidate processing:`, error, {
        candidateId,
        jobProfileId,
        startFromStage,
      });
      throw error;
    }
  }

  async retryFailedCandidateStage(
    candidateId: string,
    jobProfileId: string,
    stage: 'resume' | 'ai-analysis' | 'linkedin' | 'github' | 'interview' | 'scoring'
  ): Promise<string> {
    const batchId = uuidv4();
    
    try {
      logger.info(`Retrying failed stage for candidate`, {
        candidateId,
        jobProfileId,
        stage,
        batchId,
      });

      const queueName = this.getQueueNameForStage(stage);
      const jobData: JobData = {
        candidateId,
        jobProfileId,
        batchId,
        stage,
        priority: 10, // High priority for retries
      };

      await queueManager.addJob(queueName, jobData);

      logger.info(`Retry job scheduled for candidate stage`, {
        candidateId,
        stage,
        batchId,
      });

      return batchId;
    } catch (error) {
      logger.error(`Failed to retry candidate stage:`, error, {
        candidateId,
        jobProfileId,
        stage,
      });
      throw error;
    }
  }

  private getQueueNameForStage(stage: string): string {
    const stageToQueue: { [key: string]: string } = {
      'resume': QUEUE_NAMES.RESUME_PROCESSING,
      'ai-analysis': QUEUE_NAMES.AI_ANALYSIS,
      'linkedin': QUEUE_NAMES.LINKEDIN_ANALYSIS,
      'github': QUEUE_NAMES.GITHUB_ANALYSIS,
      'interview': QUEUE_NAMES.INTERVIEW_PROCESSING,
      'scoring': QUEUE_NAMES.SCORING,
    };

    const queueName = stageToQueue[stage];
    if (!queueName) {
      throw new Error(`Unknown stage: ${stage}`);
    }

    return queueName;
  }

  async pauseProcessing(): Promise<void> {
    logger.info('Pausing all queue processing');
    
    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        await queueManager.pauseQueue(queueName);
      } catch (error) {
        logger.error(`Failed to pause queue ${queueName}:`, error);
      }
    }
  }

  async resumeProcessing(): Promise<void> {
    logger.info('Resuming all queue processing');
    
    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        await queueManager.resumeQueue(queueName);
      } catch (error) {
        logger.error(`Failed to resume queue ${queueName}:`, error);
      }
    }
  }

  async retryAllFailedJobs(): Promise<{ [queueName: string]: number }> {
    logger.info('Retrying all failed jobs across queues');
    
    const results: { [queueName: string]: number } = {};
    
    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        const retriedCount = await queueManager.retryFailedJobs(queueName);
        results[queueName] = retriedCount;
      } catch (error) {
        logger.error(`Failed to retry jobs in queue ${queueName}:`, error);
        results[queueName] = 0;
      }
    }

    return results;
  }

  async cleanupOldJobs(gracePeriodMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    logger.info(`Cleaning up jobs older than ${gracePeriodMs}ms`);
    
    for (const queueName of Object.values(QUEUE_NAMES)) {
      try {
        await queueManager.cleanQueue(queueName, gracePeriodMs);
      } catch (error) {
        logger.error(`Failed to clean queue ${queueName}:`, error);
      }
    }
  }

  async getSystemStatus(): Promise<{
    queues: any[];
    totalJobs: { waiting: number; active: number; completed: number; failed: number };
  }> {
    const queueStats = await queueManager.getAllQueueStats();
    
    const totalJobs = queueStats.reduce(
      (acc, stats) => ({
        waiting: acc.waiting + stats.waiting,
        active: acc.active + stats.active,
        completed: acc.completed + stats.completed,
        failed: acc.failed + stats.failed,
      }),
      { waiting: 0, active: 0, completed: 0, failed: 0 }
    );

    return {
      queues: queueStats,
      totalJobs,
    };
  }
}

// Create singleton instance
export const queueOrchestrator = new QueueOrchestrator();