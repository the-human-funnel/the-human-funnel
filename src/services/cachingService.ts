import { redisClient } from '../utils/redis';
import { logger } from '../utils/logger';
import { JobProfile, Candidate, AIAnalysisResult, LinkedInAnalysis, GitHubAnalysis } from '../models/interfaces';

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  prefix: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
}

export class CachingService {
  private readonly defaultTTL = 3600; // 1 hour
  private readonly cacheConfigs: Map<string, CacheConfig> = new Map();
  private stats = {
    hits: 0,
    misses: 0
  };

  constructor() {
    this.initializeCacheConfigs();
  }

  private initializeCacheConfigs(): void {
    // Job profiles - cache for 24 hours (rarely change)
    this.cacheConfigs.set('jobProfile', {
      ttl: 86400,
      prefix: 'jp:'
    });

    // AI analysis results - cache for 7 days (expensive to compute)
    this.cacheConfigs.set('aiAnalysis', {
      ttl: 604800,
      prefix: 'ai:'
    });

    // LinkedIn analysis - cache for 24 hours (profile data changes slowly)
    this.cacheConfigs.set('linkedInAnalysis', {
      ttl: 86400,
      prefix: 'li:'
    });

    // GitHub analysis - cache for 12 hours (repositories update frequently)
    this.cacheConfigs.set('githubAnalysis', {
      ttl: 43200,
      prefix: 'gh:'
    });

    // Candidate data - cache for 6 hours (processing results)
    this.cacheConfigs.set('candidate', {
      ttl: 21600,
      prefix: 'cd:'
    });

    // Resume processing results - cache for 24 hours (text extraction is expensive)
    this.cacheConfigs.set('resumeData', {
      ttl: 86400,
      prefix: 'rd:'
    });

    // External API responses - cache for 1 hour (rate limiting protection)
    this.cacheConfigs.set('externalApi', {
      ttl: 3600,
      prefix: 'api:'
    });

    // Search results - cache for 30 minutes (frequently accessed)
    this.cacheConfigs.set('searchResults', {
      ttl: 1800,
      prefix: 'sr:'
    });

    // Batch processing status - cache for 5 minutes (real-time updates)
    this.cacheConfigs.set('batchStatus', {
      ttl: 300,
      prefix: 'bs:'
    });
  }

  /**
   * Generate cache key with proper prefix
   */
  private generateKey(type: string, identifier: string): string {
    const config = this.cacheConfigs.get(type);
    if (!config) {
      throw new Error(`Unknown cache type: ${type}`);
    }
    return `${config.prefix}${identifier}`;
  }

  /**
   * Set data in cache with appropriate TTL
   */
  async set<T>(type: string, identifier: string, data: T, customTTL?: number): Promise<void> {
    try {
      const config = this.cacheConfigs.get(type);
      if (!config) {
        throw new Error(`Unknown cache type: ${type}`);
      }

      const key = this.generateKey(type, identifier);
      const ttl = customTTL || config.ttl;
      const serializedData = JSON.stringify(data);

      await redisClient.setex(key, ttl, serializedData);
      
      logger.debug(`Cache set: ${key}`, {
        service: 'caching',
        operation: 'set',
        type,
        identifier,
        ttl,
        dataSize: serializedData.length
      });
    } catch (error) {
      logger.error(`Failed to set cache for ${type}:${identifier}`, error);
      // Don't throw error - caching failures shouldn't break the application
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(type: string, identifier: string): Promise<T | null> {
    try {
      const key = this.generateKey(type, identifier);
      const cachedData = await redisClient.get(key);

      if (cachedData) {
        this.stats.hits++;
        const parsedData = JSON.parse(cachedData) as T;
        
        logger.debug(`Cache hit: ${key}`, {
          service: 'caching',
          operation: 'get',
          type,
          identifier,
          hit: true
        });
        
        return parsedData;
      } else {
        this.stats.misses++;
        
        logger.debug(`Cache miss: ${key}`, {
          service: 'caching',
          operation: 'get',
          type,
          identifier,
          hit: false
        });
        
        return null;
      }
    } catch (error) {
      this.stats.misses++;
      logger.error(`Failed to get cache for ${type}:${identifier}`, error);
      return null;
    }
  }

  /**
   * Delete data from cache
   */
  async delete(type: string, identifier: string): Promise<void> {
    try {
      const key = this.generateKey(type, identifier);
      await redisClient.del(key);
      
      logger.debug(`Cache deleted: ${key}`, {
        service: 'caching',
        operation: 'delete',
        type,
        identifier
      });
    } catch (error) {
      logger.error(`Failed to delete cache for ${type}:${identifier}`, error);
    }
  }

  /**
   * Check if data exists in cache
   */
  async exists(type: string, identifier: string): Promise<boolean> {
    try {
      const key = this.generateKey(type, identifier);
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error(`Failed to check cache existence for ${type}:${identifier}`, error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    type: string,
    identifier: string,
    computeFn: () => Promise<T>,
    customTTL?: number
  ): Promise<T> {
    // Try to get from cache first
    const cachedData = await this.get<T>(type, identifier);
    if (cachedData !== null) {
      return cachedData;
    }

    // Compute the data
    const computedData = await computeFn();
    
    // Cache the result
    await this.set(type, identifier, computedData, customTTL);
    
    return computedData;
  }

  /**
   * Batch get multiple items from cache
   */
  async batchGet<T>(type: string, identifiers: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    // Use pipeline for better performance
    const pipeline = redisClient.getClient().multi();
    const keys = identifiers.map(id => this.generateKey(type, id));
    
    keys.forEach(key => pipeline.get(key));
    
    try {
      const responses = await pipeline.exec();
      
      identifiers.forEach((identifier, index) => {
        const response = responses?.[index];
        if (response && Array.isArray(response) && response[1]) {
          try {
            const parsedData = JSON.parse(response[1] as string) as T;
            results.set(identifier, parsedData);
            this.stats.hits++;
          } catch (error) {
            logger.error(`Failed to parse cached data for ${identifier}`, error);
            results.set(identifier, null);
            this.stats.misses++;
          }
        } else {
          results.set(identifier, null);
          this.stats.misses++;
        }
      });
    } catch (error) {
      logger.error('Failed to batch get from cache', error);
      // Return empty results on error
      identifiers.forEach(id => results.set(id, null));
      this.stats.misses += identifiers.length;
    }
    
    return results;
  }

  /**
   * Batch set multiple items to cache
   */
  async batchSet<T>(type: string, items: Map<string, T>, customTTL?: number): Promise<void> {
    const config = this.cacheConfigs.get(type);
    if (!config) {
      throw new Error(`Unknown cache type: ${type}`);
    }

    const ttl = customTTL || config.ttl;
    const pipeline = redisClient.getClient().multi();
    
    for (const [identifier, data] of items) {
      const key = this.generateKey(type, identifier);
      const serializedData = JSON.stringify(data);
      pipeline.setEx(key, ttl, serializedData);
    }
    
    try {
      await pipeline.exec();
      logger.debug(`Batch cache set: ${items.size} items of type ${type}`);
    } catch (error) {
      logger.error(`Failed to batch set cache for type ${type}`, error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const client = redisClient.getClient();
      const keys = await client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const deletedCount = await client.del(keys);
      
      logger.info(`Cache invalidated: ${deletedCount} keys matching pattern ${pattern}`);
      return deletedCount;
    } catch (error) {
      logger.error(`Failed to invalidate cache by pattern ${pattern}`, error);
      return 0;
    }
  }

  /**
   * Invalidate all cache for a specific type
   */
  async invalidateType(type: string): Promise<number> {
    const config = this.cacheConfigs.get(type);
    if (!config) {
      throw new Error(`Unknown cache type: ${type}`);
    }
    
    return await this.invalidateByPattern(`${config.prefix}*`);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const client = redisClient.getClient();
      const info = await client.info('keyspace');
      
      // Parse keyspace info to get total keys
      const keyspaceMatch = info.match(/keys=(\d+)/);
      const totalKeys = keyspaceMatch && keyspaceMatch[1] ? parseInt(keyspaceMatch[1], 10) : 0;
      
      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
      
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: Math.round(hitRate * 100) / 100,
        totalKeys
      };
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        totalKeys: 0
      };
    }
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUpCache(): Promise<void> {
    try {
      logger.info('Starting cache warm-up process');
      
      // This would typically load frequently accessed job profiles, etc.
      // Implementation depends on your specific use case
      
      logger.info('Cache warm-up completed');
    } catch (error) {
      logger.error('Cache warm-up failed', error);
    }
  }

  /**
   * Health check for caching service
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      // Test basic Redis operations
      const testKey = 'health:check';
      const testValue = 'ok';
      
      await redisClient.set(testKey, testValue);
      const retrieved = await redisClient.get(testKey);
      await redisClient.del(testKey);
      
      const healthy = retrieved === testValue;
      const stats = await this.getStats();
      
      return {
        healthy,
        details: {
          redisConnected: redisClient.isClientConnected(),
          cacheStats: stats,
          configuredTypes: Array.from(this.cacheConfigs.keys())
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          redisConnected: redisClient.isClientConnected()
        }
      };
    }
  }
}

// Export singleton instance
export const cachingService = new CachingService();