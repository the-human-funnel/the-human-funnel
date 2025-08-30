import { logger } from '../utils/logger';
import { database } from '../utils/database';
import { redisClient } from '../utils/redis';
import { queueManager } from '../queues';
import { config } from '../utils/config';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    queues: ServiceHealth;
    externalApis: {
      gemini: ServiceHealth;
      openai: ServiceHealth;
      claude: ServiceHealth;
      linkedin: ServiceHealth;
      github: ServiceHealth;
      vapi: ServiceHealth;
    };
  };
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections: number;
    queueStats: QueueStats;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastChecked: Date;
  error?: string;
  details?: any;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

class HealthCheckService {
  private startTime: Date;
  private activeConnections: number = 0;

  constructor() {
    this.startTime = new Date();
  }

  incrementConnections(): void {
    this.activeConnections++;
  }

  decrementConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const result = await database.healthCheck();
      const responseTime = Date.now() - startTime;
      
      return {
        status: result.connected ? 'healthy' : 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        details: result
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Database health check failed', error, {
        service: 'healthCheck',
        operation: 'checkDatabase'
      });
      
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkRedis(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      await redisClient.ping();
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        lastChecked: new Date()
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Redis health check failed', error, {
        service: 'healthCheck',
        operation: 'checkRedis'
      });
      
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkQueues(): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const queueHealth = await queueManager.getHealthStatus();
      const responseTime = Date.now() - startTime;
      
      return {
        status: queueHealth.healthy ? 'healthy' : 'degraded',
        responseTime,
        lastChecked: new Date(),
        details: queueHealth
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Queue health check failed', error, {
        service: 'healthCheck',
        operation: 'checkQueues'
      });
      
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkExternalApi(name: string, url: string, timeout: number = 5000): Promise<ServiceHealth> {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'HealthCheck/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      return {
        status: response.ok ? 'healthy' : 'degraded',
        responseTime,
        lastChecked: new Date(),
        details: {
          statusCode: response.status,
          statusText: response.statusText,
          headers: {
            'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
            'x-ratelimit-reset': response.headers.get('x-ratelimit-reset')
          }
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.warn(`External API health check failed: ${name}`, {
        service: 'healthCheck',
        operation: 'checkExternalApi',
        apiName: name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async checkAiProviders(): Promise<{ [provider: string]: ServiceHealth }> {
    const providers = {
      gemini: 'https://generativelanguage.googleapis.com',
      openai: 'https://api.openai.com',
      claude: 'https://api.anthropic.com'
    };

    const results: { [provider: string]: ServiceHealth } = {};
    
    for (const [provider, url] of Object.entries(providers)) {
      results[provider] = await this.checkExternalApi(provider, url, 10000);
    }
    
    return results;
  }

  async checkServiceConnectivity(): Promise<{
    database: ServiceHealth;
    redis: ServiceHealth;
    queues: ServiceHealth;
    aiProviders: { [provider: string]: ServiceHealth };
    externalServices: { [service: string]: ServiceHealth };
  }> {
    const [
      databaseHealth,
      redisHealth,
      queueHealth,
      aiProviders
    ] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
      this.checkAiProviders()
    ]);

    const externalServices = await Promise.allSettled([
      this.checkExternalApi('linkedin', 'https://www.linkedin.com'),
      this.checkExternalApi('github', 'https://api.github.com'),
      this.checkExternalApi('vapi', 'https://api.vapi.ai')
    ]);

    return {
      database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : 
        { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' },
      redis: redisHealth.status === 'fulfilled' ? redisHealth.value : 
        { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' },
      queues: queueHealth.status === 'fulfilled' ? queueHealth.value : 
        { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' },
      aiProviders: aiProviders.status === 'fulfilled' ? aiProviders.value : {},
      externalServices: {
        linkedin: externalServices[0]?.status === 'fulfilled' ? externalServices[0].value : 
          { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' },
        github: externalServices[1]?.status === 'fulfilled' ? externalServices[1].value : 
          { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' },
        vapi: externalServices[2]?.status === 'fulfilled' ? externalServices[2].value : 
          { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }
      }
    };
  }

  async getQueueStats(): Promise<QueueStats> {
    try {
      const stats = await queueManager.getAggregatedQueueStats();
      return {
        waiting: stats.waiting || 0,
        active: stats.active || 0,
        completed: stats.completed || 0,
        failed: stats.failed || 0,
        delayed: stats.delayed || 0
      };
    } catch (error) {
      logger.error('Failed to get queue stats', error, {
        service: 'healthCheck',
        operation: 'getQueueStats'
      });
      
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0
      };
    }
  }

  async getFullHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Run health checks in parallel for better performance
      const [
        databaseHealth,
        redisHealth,
        queueHealth,
        queueStats,
        geminiHealth,
        openaiHealth,
        claudeHealth,
        linkedinHealth,
        githubHealth,
        vapiHealth
      ] = await Promise.allSettled([
        this.checkDatabase(),
        this.checkRedis(),
        this.checkQueues(),
        this.getQueueStats(),
        this.checkExternalApi('gemini', 'https://generativelanguage.googleapis.com'),
        this.checkExternalApi('openai', 'https://api.openai.com'),
        this.checkExternalApi('claude', 'https://api.anthropic.com'),
        this.checkExternalApi('linkedin', 'https://www.linkedin.com'),
        this.checkExternalApi('github', 'https://api.github.com'),
        this.checkExternalApi('vapi', 'https://api.vapi.ai')
      ]);

      // Extract results from settled promises
      const getResult = <T>(result: PromiseSettledResult<T>, fallback: T): T => {
        return result.status === 'fulfilled' ? result.value : fallback;
      };

      const services = {
        database: getResult(databaseHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' }),
        redis: getResult(redisHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' }),
        queues: getResult(queueHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' }),
        externalApis: {
          gemini: getResult(geminiHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' }),
          openai: getResult(openaiHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' }),
          claude: getResult(claudeHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' }),
          linkedin: getResult(linkedinHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' }),
          github: getResult(githubHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' }),
          vapi: getResult(vapiHealth, { status: 'unhealthy' as const, lastChecked: new Date(), error: 'Health check failed' })
        }
      };

      // Determine overall system status
      const coreServices = [services.database, services.redis, services.queues];
      const hasUnhealthyCore = coreServices.some(service => service.status === 'unhealthy');
      const hasDegradedCore = coreServices.some(service => service.status === 'degraded');
      
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      if (hasUnhealthyCore) {
        overallStatus = 'unhealthy';
      } else if (hasDegradedCore) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }

      const healthStatus: HealthStatus = {
        status: overallStatus,
        timestamp: new Date(),
        uptime: Date.now() - this.startTime.getTime(),
        version: process.env.npm_package_version || '1.0.0',
        services,
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          activeConnections: this.activeConnections,
          queueStats: getResult(queueStats, { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 })
        }
      };

      const checkDuration = Date.now() - startTime;
      logger.performance('fullHealthCheck', checkDuration, true, {
        service: 'healthCheck',
        operation: 'getFullHealthStatus',
        overallStatus
      });

      return healthStatus;
    } catch (error) {
      const checkDuration = Date.now() - startTime;
      logger.error('Health check failed', error, {
        service: 'healthCheck',
        operation: 'getFullHealthStatus'
      });
      
      logger.performance('fullHealthCheck', checkDuration, false, {
        service: 'healthCheck',
        operation: 'getFullHealthStatus'
      });

      // Return minimal health status on error
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        uptime: Date.now() - this.startTime.getTime(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' },
          redis: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' },
          queues: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' },
          externalApis: {
            gemini: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' },
            openai: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' },
            claude: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' },
            linkedin: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' },
            github: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' },
            vapi: { status: 'unhealthy', lastChecked: new Date(), error: 'Health check system failure' }
          }
        },
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          activeConnections: this.activeConnections,
          queueStats: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }
        }
      };
    }
  }

  // Quick health check for load balancer
  async getBasicHealthStatus(): Promise<{ status: string; timestamp: Date }> {
    try {
      // Just check core services quickly
      const [dbResult, redisResult] = await Promise.allSettled([
        database.healthCheck(),
        redisClient.ping()
      ]);

      const dbHealthy = dbResult.status === 'fulfilled' && dbResult.value.connected;
      const redisHealthy = redisResult.status === 'fulfilled';

      return {
        status: (dbHealthy && redisHealthy) ? 'healthy' : 'unhealthy',
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Basic health check failed', error, {
        service: 'healthCheck',
        operation: 'getBasicHealthStatus'
      });
      
      return {
        status: 'unhealthy',
        timestamp: new Date()
      };
    }
  }
}

export const healthCheckService = new HealthCheckService();