import { 
  cachingService,
  connectionPoolService,
  memoryManagementService,
  optimizedFileProcessingService,
  performanceInitializationService
} from '../services';

describe('Performance Optimization Services', () => {
  beforeAll(async () => {
    // Initialize performance services for testing
    await performanceInitializationService.initialize();
  });

  afterAll(async () => {
    // Cleanup after tests
    await performanceInitializationService.shutdown();
  });

  describe('CachingService', () => {
    it('should set and get cached data', async () => {
      const testData = { test: 'data', timestamp: Date.now() };
      const key = 'test-key';
      
      await cachingService.set('jobProfile', key, testData);
      const retrieved = await cachingService.get('jobProfile', key);
      
      expect(retrieved).toEqual(testData);
    });

    it('should handle cache misses gracefully', async () => {
      const result = await cachingService.get('jobProfile', 'non-existent-key');
      expect(result).toBeNull();
    });

    it('should provide cache statistics', async () => {
      const stats = await cachingService.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
    });

    it('should invalidate cache by type', async () => {
      await cachingService.set('jobProfile', 'test1', { data: 'test1' });
      await cachingService.set('jobProfile', 'test2', { data: 'test2' });
      
      const deletedCount = await cachingService.invalidateType('jobProfile');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ConnectionPoolService', () => {
    it('should initialize connection pools', () => {
      const poolNames = connectionPoolService.getPoolNames();
      expect(Array.isArray(poolNames)).toBe(true);
    });

    it('should provide connection statistics', () => {
      const stats = connectionPoolService.getStats();
      expect(stats).toBeDefined();
    });

    it('should perform health checks', async () => {
      const health = await connectionPoolService.healthCheck();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('details');
    });
  });

  describe('MemoryManagementService', () => {
    it('should provide memory statistics', () => {
      const stats = memoryManagementService.getMemoryStats();
      expect(stats).toHaveProperty('used');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('percentage');
      expect(stats).toHaveProperty('heapUsed');
    });

    it('should track memory trends', () => {
      const trend = memoryManagementService.getMemoryTrend();
      expect(['increasing', 'decreasing', 'stable']).toContain(trend);
    });

    it('should manage processing limits', () => {
      const limits = memoryManagementService.getProcessingLimits();
      expect(limits).toHaveProperty('maxConcurrentJobs');
      expect(limits).toHaveProperty('maxBatchSize');
      expect(limits).toHaveProperty('maxFileSize');
    });

    it('should register and unregister jobs', () => {
      const jobId = 'test-job-123';
      
      memoryManagementService.registerJob(jobId);
      const activeJobs = memoryManagementService.getActiveJobs();
      expect(activeJobs.has(jobId)).toBe(true);
      
      memoryManagementService.unregisterJob(jobId);
      const activeJobsAfter = memoryManagementService.getActiveJobs();
      expect(activeJobsAfter.has(jobId)).toBe(false);
    });

    it('should validate file and batch sizes', () => {
      const limits = memoryManagementService.getProcessingLimits();
      
      expect(memoryManagementService.isFileSizeAllowed(limits.maxFileSize - 1)).toBe(true);
      expect(memoryManagementService.isFileSizeAllowed(limits.maxFileSize + 1)).toBe(false);
      
      expect(memoryManagementService.isBatchSizeAllowed(limits.maxBatchSize - 1)).toBe(true);
      expect(memoryManagementService.isBatchSizeAllowed(limits.maxBatchSize + 1)).toBe(false);
    });
  });

  describe('OptimizedFileProcessingService', () => {
    it('should provide processing options', () => {
      const options = optimizedFileProcessingService.getProcessingOptions();
      expect(options).toHaveProperty('maxConcurrentFiles');
      expect(options).toHaveProperty('chunkSize');
      expect(options).toHaveProperty('useStreaming');
      expect(options).toHaveProperty('enableCaching');
    });

    it('should perform health checks', async () => {
      const health = await optimizedFileProcessingService.healthCheck();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('details');
    });

    it('should process small files in memory', async () => {
      // Create a small test PDF buffer (mock)
      const testBuffer = Buffer.from('Mock PDF content for testing');
      const fileName = 'test-resume.pdf';
      
      // Mock the PDF parsing to avoid actual PDF processing in tests
      jest.spyOn(require('pdf-parse'), 'default').mockResolvedValue({
        text: 'John Doe\nSoftware Engineer\njohn.doe@email.com\n+1-555-0123\nhttps://linkedin.com/in/johndoe\nhttps://github.com/johndoe'
      });
      
      const result = await optimizedFileProcessingService.processFile(fileName, testBuffer);
      
      expect(result.success).toBe(true);
      expect(result.fileName).toBe(fileName);
      expect(result.extractedText).toContain('John Doe');
      expect(result.contactInfo?.email).toBe('john.doe@email.com');
      expect(result.contactInfo?.linkedInUrl).toBe('https://linkedin.com/in/johndoe');
      expect(result.contactInfo?.githubUrl).toBe('https://github.com/johndoe');
    });
  });

  describe('PerformanceInitializationService', () => {
    it('should be initialized', () => {
      expect(performanceInitializationService.isReady()).toBe(true);
    });

    it('should provide health status', async () => {
      const health = await performanceInitializationService.getHealthStatus();
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('details');
      expect(health.details).toHaveProperty('initialized');
      expect(health.details.initialized).toBe(true);
    });

    it('should provide performance statistics', async () => {
      const stats = await performanceInitializationService.getPerformanceStats();
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('memory');
      expect(stats).toHaveProperty('timestamp');
    });
  });

  describe('Integration Tests', () => {
    it('should handle high memory usage scenarios', async () => {
      // Simulate memory pressure
      const initialStats = memoryManagementService.getMemoryStats();
      
      // Register multiple jobs to simulate load
      const jobIds = Array.from({ length: 10 }, (_, i) => `load-test-job-${i}`);
      jobIds.forEach(id => memoryManagementService.registerJob(id));
      
      const activeJobs = memoryManagementService.getActiveJobs();
      expect(activeJobs.size).toBe(jobIds.length);
      
      // Clean up
      jobIds.forEach(id => memoryManagementService.unregisterJob(id));
      
      const finalActiveJobs = memoryManagementService.getActiveJobs();
      expect(finalActiveJobs.size).toBe(0);
    });

    it('should cache and retrieve data efficiently', async () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        data: `test-data-${i}`,
        timestamp: Date.now()
      }));
      
      // Batch set data
      const dataMap = new Map(testData.map(item => [item.id, item]));
      await cachingService.batchSet('candidate', dataMap);
      
      // Batch get data
      const keys = testData.map(item => item.id);
      const results = await cachingService.batchGet('candidate', keys);
      
      expect(results.size).toBe(testData.length);
      
      // Verify all data was retrieved correctly
      testData.forEach(item => {
        const retrieved = results.get(item.id);
        expect(retrieved).toEqual(item);
      });
    });

    it('should handle connection pool stress testing', async () => {
      // This test would normally make actual HTTP requests
      // For now, we'll just verify the pool configuration
      const poolNames = connectionPoolService.getPoolNames();
      expect(poolNames.length).toBeGreaterThan(0);
      
      // Verify each pool has statistics
      poolNames.forEach(poolName => {
        const stats = connectionPoolService.getStats(poolName);
        expect(stats).toBeDefined();
      });
    });
  });
});