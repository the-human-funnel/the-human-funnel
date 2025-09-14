import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { cachingService } from './cachingService';

export interface PoolConfig {
  maxConnections: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  keepAlive: boolean;
  maxIdleTime: number;
}

export interface ApiEndpoint {
  name: string;
  baseURL: string;
  headers?: Record<string, string>;
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: Date | null;
}

export class ConnectionPoolService {
  private pools: Map<string, AxiosInstance> = new Map();
  private rateLimiters: Map<string, { requests: number[]; limit: number; windowMs: number }> = new Map();
  private stats: Map<string, RequestStats> = new Map();
  private requestTimings: WeakMap<any, number> = new WeakMap();
  private defaultConfig: PoolConfig;

  constructor() {
    this.defaultConfig = {
      maxConnections: 10,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      keepAlive: true,
      maxIdleTime: 60000
    };
  }

  /**
   * Initialize connection pool for an API endpoint
   */
  initializePool(endpoint: ApiEndpoint, config?: Partial<PoolConfig>): void {
    const poolConfig = { ...this.defaultConfig, ...config };
    
    const axiosInstance = axios.create({
      baseURL: endpoint.baseURL,
      timeout: poolConfig.timeout,
      headers: {
        'Connection': poolConfig.keepAlive ? 'keep-alive' : 'close',
        'Keep-Alive': `timeout=${Math.floor(poolConfig.maxIdleTime / 1000)}`,
        ...endpoint.headers
      },
      // Configure connection pooling
      httpAgent: this.createHttpAgent(poolConfig),
      httpsAgent: this.createHttpsAgent(poolConfig)
    });

    // Add request interceptor for rate limiting and caching
    axiosInstance.interceptors.request.use(
      async (config) => {
        // Check rate limits
        if (endpoint.rateLimit) {
          await this.checkRateLimit(endpoint.name, endpoint.rateLimit);
        }
        
        // Add request timing using a WeakMap to avoid modifying the config
        this.requestTimings.set(config, Date.now());
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for stats and caching
    axiosInstance.interceptors.response.use(
      (response) => {
        this.updateStats(endpoint.name, response, true);
        return response;
      },
      (error) => {
        this.updateStats(endpoint.name, error.response, false);
        return Promise.reject(error);
      }
    );

    this.pools.set(endpoint.name, axiosInstance);
    
    // Initialize rate limiter if configured
    if (endpoint.rateLimit) {
      this.rateLimiters.set(endpoint.name, {
        requests: [],
        limit: endpoint.rateLimit.requests,
        windowMs: endpoint.rateLimit.windowMs
      });
    }

    // Initialize stats
    this.stats.set(endpoint.name, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      lastRequestTime: null
    });

    logger.info(`Connection pool initialized for ${endpoint.name}`, {
      service: 'connectionPool',
      endpoint: endpoint.name,
      baseURL: endpoint.baseURL,
      maxConnections: poolConfig.maxConnections,
      timeout: poolConfig.timeout
    });
  }

  private createHttpAgent(config: PoolConfig): any {
    const http = require('http');
    return new http.Agent({
      keepAlive: config.keepAlive,
      maxSockets: config.maxConnections,
      maxFreeSockets: Math.floor(config.maxConnections / 2),
      timeout: config.maxIdleTime,
      freeSocketTimeout: config.maxIdleTime
    });
  }

  private createHttpsAgent(config: PoolConfig): any {
    const https = require('https');
    return new https.Agent({
      keepAlive: config.keepAlive,
      maxSockets: config.maxConnections,
      maxFreeSockets: Math.floor(config.maxConnections / 2),
      timeout: config.maxIdleTime,
      freeSocketTimeout: config.maxIdleTime
    });
  }

  /**
   * Make a cached HTTP request with connection pooling
   */
  async request<T = any>(
    endpointName: string,
    config: AxiosRequestConfig,
    cacheOptions?: {
      enabled: boolean;
      ttl?: number;
      key?: string;
    }
  ): Promise<AxiosResponse<T>> {
    const pool = this.pools.get(endpointName);
    if (!pool) {
      throw new Error(`Connection pool not found for endpoint: ${endpointName}`);
    }

    // Generate cache key if caching is enabled
    let cacheKey: string | null = null;
    if (cacheOptions?.enabled) {
      cacheKey = cacheOptions.key || this.generateCacheKey(endpointName, config);
      
      // Try to get from cache first
      const cachedResponse = await cachingService.get<AxiosResponse<T>>('externalApi', cacheKey);
      if (cachedResponse) {
        logger.debug(`Cache hit for API request: ${cacheKey}`);
        return cachedResponse;
      }
    }

    try {
      const response = await this.executeWithRetry(pool, config);
      
      // Cache successful responses
      if (cacheOptions?.enabled && cacheKey && response.status >= 200 && response.status < 300) {
        await cachingService.set('externalApi', cacheKey, response, cacheOptions.ttl);
      }
      
      return response as AxiosResponse<T>;
    } catch (error) {
      logger.error(`API request failed for ${endpointName}`, {
        service: 'connectionPool',
        endpoint: endpointName,
        url: config.url,
        method: config.method,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetry<T>(
    pool: AxiosInstance,
    config: AxiosRequestConfig,
    attempt: number = 1
  ): Promise<AxiosResponse<T>> {
    try {
      return await pool.request<T>(config);
    } catch (error: any) {
      if (attempt < this.defaultConfig.retryAttempts && this.shouldRetry(error)) {
        const delay = this.defaultConfig.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        
        logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${this.defaultConfig.retryAttempts})`, {
          service: 'connectionPool',
          url: config.url,
          method: config.method,
          attempt,
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(pool, config, attempt + 1);
      }
      
      throw error;
    }
  }

  /**
   * Determine if request should be retried
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx status codes
    if (!error.response) {
      return true; // Network error
    }
    
    const status = error.response.status;
    return status >= 500 || status === 429; // Server errors or rate limiting
  }

  /**
   * Check rate limits before making request
   */
  private async checkRateLimit(endpointName: string, rateLimit: { requests: number; windowMs: number }): Promise<void> {
    const limiter = this.rateLimiters.get(endpointName);
    if (!limiter) {
      return;
    }

    const now = Date.now();
    const windowStart = now - rateLimit.windowMs;
    
    // Remove old requests outside the window
    limiter.requests = limiter.requests.filter(time => time > windowStart);
    
    // Check if we're at the limit
    if (limiter.requests.length >= rateLimit.requests) {
      const oldestRequest = Math.min(...limiter.requests);
      const waitTime = oldestRequest + rateLimit.windowMs - now;
      
      if (waitTime > 0) {
        logger.warn(`Rate limit reached for ${endpointName}, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Add current request
    limiter.requests.push(now);
  }

  /**
   * Update request statistics
   */
  private updateStats(endpointName: string, response: AxiosResponse | undefined, success: boolean): void {
    const stats = this.stats.get(endpointName);
    if (!stats) {
      return;
    }

    stats.totalRequests++;
    stats.lastRequestTime = new Date();
    
    if (success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }

    // Update average response time
    if (response?.config) {
      const startTime = this.requestTimings.get(response.config);
      if (startTime) {
        const responseTime = Date.now() - startTime;
        stats.averageResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
        this.requestTimings.delete(response.config); // Clean up
      }
    }
  }

  /**
   * Generate cache key for API request
   */
  private generateCacheKey(endpointName: string, config: AxiosRequestConfig): string {
    const keyParts = [
      endpointName,
      config.method || 'GET',
      config.url || '',
      JSON.stringify(config.params || {}),
      JSON.stringify(config.data || {})
    ];
    
    return Buffer.from(keyParts.join('|')).toString('base64');
  }

  /**
   * Get connection pool statistics
   */
  getStats(endpointName?: string): Map<string, RequestStats> | RequestStats | null {
    if (endpointName) {
      return this.stats.get(endpointName) || null;
    }
    return new Map(this.stats);
  }

  /**
   * Get all pool names
   */
  getPoolNames(): string[] {
    return Array.from(this.pools.keys());
  }

  /**
   * Health check for connection pools
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    const poolHealth: Record<string, any> = {};
    let overallHealthy = true;

    for (const [name, pool] of this.pools) {
      try {
        // Simple health check - make a HEAD request to base URL
        const response = await pool.head('/', { timeout: 5000 });
        poolHealth[name] = {
          healthy: response.status < 400,
          status: response.status,
          stats: this.stats.get(name)
        };
      } catch (error) {
        poolHealth[name] = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          stats: this.stats.get(name)
        };
        overallHealthy = false;
      }
    }

    return {
      healthy: overallHealthy,
      details: {
        pools: poolHealth,
        totalPools: this.pools.size
      }
    };
  }

  /**
   * Reset statistics for all or specific endpoint
   */
  resetStats(endpointName?: string): void {
    if (endpointName) {
      const stats = this.stats.get(endpointName);
      if (stats) {
        stats.totalRequests = 0;
        stats.successfulRequests = 0;
        stats.failedRequests = 0;
        stats.averageResponseTime = 0;
        stats.lastRequestTime = null;
      }
    } else {
      for (const stats of this.stats.values()) {
        stats.totalRequests = 0;
        stats.successfulRequests = 0;
        stats.failedRequests = 0;
        stats.averageResponseTime = 0;
        stats.lastRequestTime = null;
      }
    }
  }

  /**
   * Cleanup and close all connection pools
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up connection pools');
    
    for (const [name, pool] of this.pools) {
      try {
        // Cancel any pending requests
        // Note: Axios doesn't have a direct way to close pools, 
        // but we can clear the instances
        logger.info(`Cleaned up connection pool: ${name}`);
      } catch (error) {
        logger.error(`Error cleaning up pool ${name}:`, error);
      }
    }
    
    this.pools.clear();
    this.rateLimiters.clear();
    this.stats.clear();
  }
}

// Export singleton instance
export const connectionPoolService = new ConnectionPoolService();