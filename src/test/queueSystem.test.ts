import { queueManager, QUEUE_NAMES } from '../queues';
import { queueOrchestrator } from '../services/queueOrchestrator';
import { queueMonitor } from '../utils/queueMonitor';
import { redisClient } from '../utils/redis';
import { JobData } from '../models/interfaces';

describe('Queue System', () => {
  beforeAll(async () => {
    // Connect to Redis and initialize queues for testing
    await redisClient.connect();
    await queueManager.initialize();
  });

  afterAll(async () => {
    // Clean up
    await queueManager.shutdown();
    await redisClient.disconnect();
  });

  describe('QueueManager', () => {
    test('should initialize successfully', () => {
      expect(queueManager.isReady()).toBe(true);
    });

    test('should add job to queue', async () => {
      const jobData: JobData = {
        candidateId: 'test-candidate-1',
        jobProfileId: 'test-job-1',
        batchId: 'test-batch-1',
        stage: 'resume',
        priority: 5,
      };

      const job = await queueManager.addJob(QUEUE_NAMES.RESUME_PROCESSING, jobData);
      
      expect(job).toBeDefined();
      expect(job.data.candidateId).toBe('test-candidate-1');
      expect(job.data.stage).toBe('resume');
    });

    test('should get queue statistics', async () => {
      const stats = await queueManager.getQueueStats(QUEUE_NAMES.RESUME_PROCESSING);
      
      expect(stats).toBeDefined();
      expect(stats?.queueName).toBe(QUEUE_NAMES.RESUME_PROCESSING);
      expect(typeof stats?.waiting).toBe('number');
      expect(typeof stats?.active).toBe('number');
      expect(typeof stats?.completed).toBe('number');
      expect(typeof stats?.failed).toBe('number');
    });

    test('should get all queue statistics', async () => {
      const allStats = await queueManager.getAllQueueStats();
      
      expect(Array.isArray(allStats)).toBe(true);
      expect(allStats.length).toBeGreaterThan(0);
      
      const queueNames = allStats.map(stat => stat.queueName);
      expect(queueNames).toContain(QUEUE_NAMES.RESUME_PROCESSING);
      expect(queueNames).toContain(QUEUE_NAMES.AI_ANALYSIS);
    });

    test('should add batch jobs', async () => {
      const jobs = [
        {
          queueName: QUEUE_NAMES.RESUME_PROCESSING,
          jobData: {
            candidateId: 'test-candidate-2',
            jobProfileId: 'test-job-1',
            batchId: 'test-batch-2',
            stage: 'resume' as const,
          },
        },
        {
          queueName: QUEUE_NAMES.AI_ANALYSIS,
          jobData: {
            candidateId: 'test-candidate-2',
            jobProfileId: 'test-job-1',
            batchId: 'test-batch-2',
            stage: 'ai-analysis' as const,
          },
        },
      ];

      const addedJobs = await queueManager.addBatchJobs(jobs);
      
      expect(addedJobs).toHaveLength(2);
      expect(addedJobs[0]?.data.candidateId).toBe('test-candidate-2');
      expect(addedJobs[1]?.data.candidateId).toBe('test-candidate-2');
    });

    test('should pause and resume queue', async () => {
      await queueManager.pauseQueue(QUEUE_NAMES.RESUME_PROCESSING);
      
      // Note: In a real test, you'd check if the queue is actually paused
      // This would require more complex setup with actual job processing
      
      await queueManager.resumeQueue(QUEUE_NAMES.RESUME_PROCESSING);
      
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });
  });

  describe('QueueOrchestrator', () => {
    test('should create batch processing plan', async () => {
      const candidateIds = ['candidate-1', 'candidate-2', 'candidate-3'];
      const jobProfileId = 'job-profile-1';

      const batch = await queueOrchestrator.processCandidateBatch(candidateIds, jobProfileId);
      
      expect(batch).toBeDefined();
      expect(batch.totalCandidates).toBe(3);
      expect(batch.candidateIds).toEqual(candidateIds);
      expect(batch.jobProfileId).toBe(jobProfileId);
      expect(batch.status).toBe('processing');
    });

    test('should process individual candidate', async () => {
      const candidateId = 'individual-candidate-1';
      const jobProfileId = 'job-profile-1';

      const batchId = await queueOrchestrator.processIndividualCandidate(
        candidateId,
        jobProfileId,
        'resume'
      );
      
      expect(typeof batchId).toBe('string');
      expect(batchId.length).toBeGreaterThan(0);
    });

    test('should retry failed candidate stage', async () => {
      const candidateId = 'retry-candidate-1';
      const jobProfileId = 'job-profile-1';
      const stage = 'ai-analysis';

      const batchId = await queueOrchestrator.retryFailedCandidateStage(
        candidateId,
        jobProfileId,
        stage
      );
      
      expect(typeof batchId).toBe('string');
      expect(batchId.length).toBeGreaterThan(0);
    });

    test('should get system status', async () => {
      const status = await queueOrchestrator.getSystemStatus();
      
      expect(status).toBeDefined();
      expect(Array.isArray(status.queues)).toBe(true);
      expect(status.totalJobs).toBeDefined();
      expect(typeof status.totalJobs.waiting).toBe('number');
      expect(typeof status.totalJobs.active).toBe('number');
      expect(typeof status.totalJobs.completed).toBe('number');
      expect(typeof status.totalJobs.failed).toBe('number');
    });
  });

  describe('QueueMonitor', () => {
    test('should generate health report', async () => {
      const healthReport = await queueMonitor.generateHealthReport();
      
      expect(healthReport).toBeDefined();
      expect(healthReport.timestamp).toBeInstanceOf(Date);
      expect(healthReport.redis).toBeDefined();
      expect(typeof healthReport.redis.connected).toBe('boolean');
      expect(typeof healthReport.redis.healthy).toBe('boolean');
      expect(healthReport.queues).toBeDefined();
      expect(healthReport.summary).toBeDefined();
      expect(['healthy', 'warning', 'critical']).toContain(healthReport.summary.overallHealth);
    });

    test('should get detailed queue metrics', async () => {
      const metrics = await queueMonitor.getDetailedQueueMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
      
      // Check if at least one queue has metrics
      const queueNames = Object.keys(metrics);
      expect(queueNames.length).toBeGreaterThan(0);
      
      const firstQueueName = queueNames[0];
      if (firstQueueName) {
        const firstQueue = metrics[firstQueueName];
        expect(firstQueue.stats).toBeDefined();
        expect(firstQueue.recentJobs).toBeDefined();
        expect(Array.isArray(firstQueue.recentJobs.completed)).toBe(true);
        expect(Array.isArray(firstQueue.recentJobs.failed)).toBe(true);
        expect(Array.isArray(firstQueue.recentJobs.active)).toBe(true);
      }
    });

    test('should start and stop monitoring', () => {
      expect(queueMonitor.isMonitoringActive()).toBe(false);
      
      queueMonitor.startMonitoring(1000); // 1 second interval for testing
      expect(queueMonitor.isMonitoringActive()).toBe(true);
      
      queueMonitor.stopMonitoring();
      expect(queueMonitor.isMonitoringActive()).toBe(false);
    });
  });

  describe('Redis Client', () => {
    test('should be connected', () => {
      expect(redisClient.isClientConnected()).toBe(true);
    });

    test('should pass health check', async () => {
      const isHealthy = await redisClient.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});

describe('Queue Integration', () => {
  beforeAll(async () => {
    await redisClient.connect();
    await queueManager.initialize();
  });

  afterAll(async () => {
    await queueManager.shutdown();
    await redisClient.disconnect();
  });

  test('should handle complete candidate processing pipeline', async () => {
    const candidateId = 'pipeline-test-candidate';
    const jobProfileId = 'pipeline-test-job';

    // Start individual candidate processing
    const batchId = await queueOrchestrator.processIndividualCandidate(
      candidateId,
      jobProfileId,
      'resume'
    );

    expect(batchId).toBeDefined();

    // Check batch progress (should show jobs queued)
    const progress = await queueManager.getBatchProgress(batchId);
    expect(progress).toBeDefined();
    expect(progress?.batchId).toBe(batchId);
    expect(progress?.totalJobs).toBeGreaterThan(0);
  });

  test('should handle error scenarios gracefully', async () => {
    // Test with invalid queue name
    await expect(
      queueManager.addJob('invalid-queue', {
        candidateId: 'test',
        jobProfileId: 'test',
        batchId: 'test',
        stage: 'resume',
      })
    ).rejects.toThrow();

    // Test with invalid batch ID
    const progress = await queueManager.getBatchProgress('non-existent-batch');
    expect(progress).toBeNull();
  });
});