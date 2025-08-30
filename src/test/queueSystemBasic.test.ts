import { queueManager, QUEUE_NAMES } from '../queues';
import { redisClient } from '../utils/redis';

describe('Queue System Basic Tests', () => {
  beforeAll(async () => {
    // Skip Redis connection for basic compilation test
    // In a real environment, Redis would be connected
  });

  afterAll(async () => {
    // Skip cleanup for basic compilation test
  });

  describe('Queue Manager Initialization', () => {
    test('should have correct queue names defined', () => {
      expect(QUEUE_NAMES.RESUME_PROCESSING).toBe('resume-processing');
      expect(QUEUE_NAMES.AI_ANALYSIS).toBe('ai-analysis');
      expect(QUEUE_NAMES.LINKEDIN_ANALYSIS).toBe('linkedin-analysis');
      expect(QUEUE_NAMES.GITHUB_ANALYSIS).toBe('github-analysis');
      expect(QUEUE_NAMES.INTERVIEW_PROCESSING).toBe('interview-processing');
      expect(QUEUE_NAMES.SCORING).toBe('scoring');
    });

    test('should have queue manager instance', () => {
      expect(queueManager).toBeDefined();
      expect(typeof queueManager.initialize).toBe('function');
      expect(typeof queueManager.addJob).toBe('function');
      expect(typeof queueManager.getQueueStats).toBe('function');
    });
  });

  describe('Redis Client', () => {
    test('should have redis client instance', () => {
      expect(redisClient).toBeDefined();
      expect(typeof redisClient.connect).toBe('function');
      expect(typeof redisClient.disconnect).toBe('function');
      expect(typeof redisClient.healthCheck).toBe('function');
    });
  });
});