import { logger } from '../utils/logger';
import { database } from '../utils/database';
import { redisClient } from '../utils/redis';
import { cachingService } from './cachingService';
import { connectionPoolService, ApiEndpoint } from './connectionPoolService';
import { memoryManagementService } from './memoryManagementService';
import { optimizedFileProcessingService } from './optimizedFileProcessingService';
import { config } from '../config';

export interface PerformanceConfig {
  enableCaching: boolean;
  enableConnectionPooling: boolean;
  enableMemoryManagement: boolean;
  enableOptimizedFileProcessing: boolean;
  enableDatabaseOptimizations: boolean;
}

export class PerformanceInitializationService {
  private isInitialized = false;
  private performanceConfig: PerformanceConfig;

  constructor() {
    this.performanceConfig = {
      enableCaching: true,
      enableConnectionPooling: true,
      enableMemoryManagement: true,
      enableOptimizedFileProcessing: true,
      enableDatabaseOptimizations: true
    };
  }

  /**
   * Initialize all performance optimizations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Performance optimizations already initialized');
      return;
    }

    logger.info('Initializing performance optimizations...');

    try {
      // Initialize database optimizations
      if (this.performanceConfig.enableDatabaseOptimizations) {
        await this.initializeDatabaseOptimizations();
      }

      // Initialize Redis and caching
      if (this.performanceConfig.enableCaching) {
        await this.initializeCaching();
      }

      // Initialize connection pooling for external APIs
      if (this.performanceConfig.enableConnectionPooling) {
        await this.initializeConnectionPooling();
      }

      // Initialize memory management
      if (this.performanceConfig.enableMemoryManagement) {
        await this.initializeMemoryManagement();
      }

      // Initialize optimized file processing
      if (this.performanceConfig.enableOptimizedFileProcessing) {
        await this.initializeOptimizedFileProcessing();
      }

      this.isInitialized = true;
      logger.info('Performance optimizations initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize performance optimizations:', error);
      throw error;
    }
  }

  /**
   * Initialize database optimizations
   */
  private async initializeDatabaseOptimizations(): Promise<void> {
    try {
      logger.info('Initializing database optimizations...');

      // Ensure database connection is established
      if (!database.isDbConnected()) {
        await database.connect();
      }

      // Create optimized indexes
      await database.createIndexes();

      // Optimize connection settings
      await database.optimizeConnection();

      logger.info('Database optimizations initialized');
    } catch (error) {
      logger.error('Failed to initialize database optimizations:', error);
      throw error;
    }
  }

  /**
   * Initialize caching service
   */
  private async initializeCaching(): Promise<void> {
    try {
      logger.info('Initializing caching service...');

      // Ensure Redis connection is established
      if (!redisClient.isClientConnected()) {
        await redisClient.connect();
      }

      // Perform cache health check
      const cacheHealth = await cachingService.healthCheck();
      if (!cacheHealth.healthy) {
        throw new Error(`Cache health check failed: ${JSON.stringify(cacheHealth.details)}`);
      }

      // Warm up cache with frequently accessed data
      await cachingService.warmUpCache();

      logger.info('Caching service initialized');
    } catch (error) {
      logger.error('Failed to initialize caching service:', error);
      throw error;
    }
  }

  /**
   * Initialize connection pooling for external APIs
   */
  private async initializeConnectionPooling(): Promise<void> {
    try {
      logger.info('Initializing connection pooling...');

      const secrets = config.getSecretsConfig();

      // Initialize pools for external APIs
      const apiEndpoints: ApiEndpoint[] = [
        {
          name: 'gemini',
          baseURL: 'https://generativelanguage.googleapis.com',
          headers: secrets.geminiApiKey ? {
            'Authorization': `Bearer ${secrets.geminiApiKey}`,
            'Content-Type': 'application/json'
          } : undefined,
          rateLimit: {
            requests: 60,
            windowMs: 60000 // 60 requests per minute
          }
        },
        {
          name: 'openai',
          baseURL: 'https://api.openai.com',
          headers: secrets.openaiApiKey ? {
            'Authorization': `Bearer ${secrets.openaiApiKey}`,
            'Content-Type': 'application/json'
          } : undefined,
          rateLimit: {
            requests: 100,
            windowMs: 60000 // 100 requests per minute
          }
        },
        {
          name: 'claude',
          baseURL: 'https://api.anthropic.com',
          headers: secrets.claudeApiKey ? {
            'Authorization': `Bearer ${secrets.claudeApiKey}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          } : undefined,
          rateLimit: {
            requests: 50,
            windowMs: 60000 // 50 requests per minute
          }
        },
        {
          name: 'github',
          baseURL: 'https://api.github.com',
          headers: secrets.githubToken ? {
            'Authorization': `token ${secrets.githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          } : undefined,
          rateLimit: {
            requests: 5000,
            windowMs: 3600000 // 5000 requests per hour
          }
        },
        {
          name: 'linkedin-scraper',
          baseURL: secrets.linkedinScraperBaseUrl || 'https://api.linkedin.com',
          headers: secrets.linkedinScraperApiKey ? {
            'Authorization': `Bearer ${secrets.linkedinScraperApiKey}`,
            'Content-Type': 'application/json'
          } : undefined,
          rateLimit: {
            requests: 100,
            windowMs: 60000 // 100 requests per minute
          }
        },
        {
          name: 'vapi',
          baseURL: secrets.vapiBaseUrl || 'https://api.vapi.ai',
          headers: secrets.vapiApiKey ? {
            'Authorization': `Bearer ${secrets.vapiApiKey}`,
            'Content-Type': 'application/json'
          } : undefined,
          rateLimit: {
            requests: 200,
            windowMs: 60000 // 200 requests per minute
          }
        }
      ];

      // Initialize connection pools
      for (const endpoint of apiEndpoints) {
        connectionPoolService.initializePool(endpoint, {
          maxConnections: 10,
          timeout: 30000,
          retryAttempts: 3,
          retryDelay: 1000,
          keepAlive: true,
          maxIdleTime: 60000
        });
      }

      // Perform health check
      const poolHealth = await connectionPoolService.healthCheck();
      if (!poolHealth.healthy) {
        logger.warn('Some connection pools failed health check:', poolHealth.details);
      }

      logger.info('Connection pooling initialized');
    } catch (error) {
      logger.error('Failed to initialize connection pooling:', error);
      throw error;
    }
  }

  /**
   * Initialize memory management
   */
  private async initializeMemoryManagement(): Promise<void> {
    try {
      logger.info('Initializing memory management...');

      // Register cleanup callbacks for various services
      memoryManagementService.registerCleanupCallback(async () => {
        logger.info('Executing cache cleanup...');
        await cachingService.invalidateByPattern('temp:*');
      });

      memoryManagementService.registerCleanupCallback(async () => {
        logger.info('Executing file processing cleanup...');
        await optimizedFileProcessingService.cleanup();
      });

      memoryManagementService.registerCleanupCallback(async () => {
        logger.info('Executing connection pool cleanup...');
        await connectionPoolService.cleanup();
      });

      // Set up memory monitoring event listeners
      memoryManagementService.on('memoryWarning', (stats) => {
        logger.warn('Memory usage warning triggered', {
          service: 'performanceInitialization',
          memoryPercentage: stats.percentage,
          heapUsed: stats.heapUsed
        });
      });

      memoryManagementService.on('memoryHigh', (stats) => {
        logger.error('High memory usage detected', {
          service: 'performanceInitialization',
          memoryPercentage: stats.percentage,
          heapUsed: stats.heapUsed
        });
      });

      memoryManagementService.on('memoryCritical', (stats) => {
        logger.error('Critical memory usage - emergency cleanup triggered', {
          service: 'performanceInitialization',
          memoryPercentage: stats.percentage,
          heapUsed: stats.heapUsed
        });
      });

      // Perform health check
      const memoryHealth = await memoryManagementService.healthCheck();
      if (!memoryHealth.healthy) {
        logger.warn('Memory management health check failed:', memoryHealth.details);
      }

      logger.info('Memory management initialized');
    } catch (error) {
      logger.error('Failed to initialize memory management:', error);
      throw error;
    }
  }

  /**
   * Initialize optimized file processing
   */
  private async initializeOptimizedFileProcessing(): Promise<void> {
    try {
      logger.info('Initializing optimized file processing...');

      // Configure file processing options based on available memory
      const memoryStats = memoryManagementService.getMemoryStats();
      const processingLimits = memoryManagementService.getProcessingLimits();

      optimizedFileProcessingService.updateProcessingOptions({
        maxConcurrentFiles: processingLimits.maxConcurrentJobs,
        chunkSize: 1024 * 1024, // 1MB chunks
        useStreaming: true,
        enableCaching: true,
        tempDirectory: './temp'
      });

      // Perform health check
      const fileProcessingHealth = await optimizedFileProcessingService.healthCheck();
      if (!fileProcessingHealth.healthy) {
        logger.warn('File processing health check failed:', fileProcessingHealth.details);
      }

      logger.info('Optimized file processing initialized');
    } catch (error) {
      logger.error('Failed to initialize optimized file processing:', error);
      throw error;
    }
  }

  /**
   * Get performance health status
   */
  async getHealthStatus(): Promise<{ healthy: boolean; details: any }> {
    if (!this.isInitialized) {
      return {
        healthy: false,
        details: { error: 'Performance optimizations not initialized' }
      };
    }

    try {
      const healthChecks = await Promise.allSettled([
        database.healthCheck(),
        cachingService.healthCheck(),
        connectionPoolService.healthCheck(),
        memoryManagementService.healthCheck(),
        optimizedFileProcessingService.healthCheck()
      ]);

      const results = {
        database: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { healthy: false, details: { error: 'Health check failed' } },
        caching: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { healthy: false, details: { error: 'Health check failed' } },
        connectionPooling: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { healthy: false, details: { error: 'Health check failed' } },
        memoryManagement: healthChecks[3].status === 'fulfilled' ? healthChecks[3].value : { healthy: false, details: { error: 'Health check failed' } },
        fileProcessing: healthChecks[4].status === 'fulfilled' ? healthChecks[4].value : { healthy: false, details: { error: 'Health check failed' } }
      };

      const overallHealthy = Object.values(results).every(result => 
        typeof result === 'object' && result !== null && 'healthy' in result && result.healthy
      );

      return {
        healthy: overallHealthy,
        details: {
          initialized: this.isInitialized,
          config: this.performanceConfig,
          services: results
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          initialized: this.isInitialized
        }
      };
    }
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats(): Promise<any> {
    if (!this.isInitialized) {
      return { error: 'Performance optimizations not initialized' };
    }

    try {
      const [
        dbStats,
        cacheStats,
        connectionStats,
        memoryStats
      ] = await Promise.allSettled([
        database.getPerformanceStats(),
        cachingService.getStats(),
        connectionPoolService.getStats(),
        memoryManagementService.getMemoryStats()
      ]);

      return {
        database: dbStats.status === 'fulfilled' ? dbStats.value : null,
        cache: cacheStats.status === 'fulfilled' ? cacheStats.value : null,
        connections: connectionStats.status === 'fulfilled' ? connectionStats.value : null,
        memory: memoryStats.status === 'fulfilled' ? memoryStats.value : null,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get performance stats:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update performance configuration
   */
  updateConfig(config: Partial<PerformanceConfig>): void {
    Object.assign(this.performanceConfig, config);
    logger.info('Performance configuration updated', {
      service: 'performanceInitialization',
      config: this.performanceConfig
    });
  }

  /**
   * Shutdown all performance services
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down performance services...');

    try {
      await Promise.allSettled([
        memoryManagementService.shutdown(),
        optimizedFileProcessingService.cleanup(),
        connectionPoolService.cleanup(),
        redisClient.disconnect(),
        database.disconnect()
      ]);

      this.isInitialized = false;
      logger.info('Performance services shutdown completed');
    } catch (error) {
      logger.error('Error during performance services shutdown:', error);
    }
  }

  /**
   * Check if performance optimizations are initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const performanceInitializationService = new PerformanceInitializationService();