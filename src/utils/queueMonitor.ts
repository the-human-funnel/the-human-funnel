import { queueManager } from '../queues';
import { logger } from './logger';
import { redisClient } from './redis';

export class QueueMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn('Queue monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info(`Starting queue monitoring with ${intervalMs}ms interval`);

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Queue monitoring health check failed:', error);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    logger.info('Queue monitoring stopped');
  }

  private async performHealthCheck(): Promise<void> {
    // Check Redis connection
    const redisHealthy = await redisClient.healthCheck();
    if (!redisHealthy) {
      logger.error('Redis health check failed - attempting reconnection');
      try {
        await redisClient.connect();
      } catch (error) {
        logger.error('Failed to reconnect to Redis:', error);
      }
    }

    // Check queue stats and log warnings for concerning metrics
    const queueStats = await queueManager.getAllQueueStats();
    
    for (const stats of queueStats) {
      // Log warnings for high failure rates
      const totalProcessed = stats.completed + stats.failed;
      if (totalProcessed > 0) {
        const failureRate = (stats.failed / totalProcessed) * 100;
        if (failureRate > 10) {
          logger.warn(`High failure rate in queue ${stats.queueName}: ${failureRate.toFixed(2)}%`, {
            queueName: stats.queueName,
            failed: stats.failed,
            completed: stats.completed,
            failureRate,
          });
        }
      }

      // Log warnings for large backlogs
      if (stats.waiting > 100) {
        logger.warn(`Large backlog in queue ${stats.queueName}: ${stats.waiting} waiting jobs`, {
          queueName: stats.queueName,
          waiting: stats.waiting,
          active: stats.active,
        });
      }

      // Log info for active processing
      if (stats.active > 0) {
        logger.debug(`Queue ${stats.queueName} processing ${stats.active} jobs`, {
          queueName: stats.queueName,
          active: stats.active,
          waiting: stats.waiting,
        });
      }
    }
  }

  async getDetailedQueueMetrics(): Promise<{
    [queueName: string]: {
      stats: any;
      recentJobs: {
        completed: any[];
        failed: any[];
        active: any[];
      };
    };
  }> {
    const metrics: any = {};
    
    for (const [queueName, queue] of queueManager.getAllQueues()) {
      try {
        const stats = await queueManager.getQueueStats(queueName);
        
        // Get recent jobs for analysis
        const completed = await queue.getCompleted(0, 9); // Last 10 completed
        const failed = await queue.getFailed(0, 9); // Last 10 failed
        const active = await queue.getActive(0, 4); // Current 5 active

        metrics[queueName] = {
          stats,
          recentJobs: {
            completed: completed.map(job => ({
              id: job.id,
              data: job.data,
              processedOn: job.processedOn,
              finishedOn: job.finishedOn,
              duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : null,
            })),
            failed: failed.map(job => ({
              id: job.id,
              data: job.data,
              failedReason: job.failedReason,
              attemptsMade: job.attemptsMade,
              processedOn: job.processedOn,
            })),
            active: active.map(job => ({
              id: job.id,
              data: job.data,
              processedOn: job.processedOn,
              progress: job.progress(),
            })),
          },
        };
      } catch (error) {
        logger.error(`Failed to get metrics for queue ${queueName}:`, error);
        metrics[queueName] = {
          stats: null,
          recentJobs: { completed: [], failed: [], active: [] },
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return metrics;
  }

  async generateHealthReport(): Promise<{
    timestamp: Date;
    redis: { connected: boolean; healthy: boolean };
    queues: {
      [queueName: string]: {
        healthy: boolean;
        stats: any;
        issues: string[];
      };
    };
    summary: {
      totalQueues: number;
      healthyQueues: number;
      totalJobs: { waiting: number; active: number; completed: number; failed: number };
      overallHealth: 'healthy' | 'warning' | 'critical';
    };
  }> {
    const report = {
      timestamp: new Date(),
      redis: {
        connected: redisClient.isClientConnected(),
        healthy: await redisClient.healthCheck(),
      },
      queues: {} as any,
      summary: {
        totalQueues: 0,
        healthyQueues: 0,
        totalJobs: { waiting: 0, active: 0, completed: 0, failed: 0 },
        overallHealth: 'healthy' as 'healthy' | 'warning' | 'critical',
      },
    };

    const queueStats = await queueManager.getAllQueueStats();
    
    for (const stats of queueStats) {
      const issues: string[] = [];
      let healthy = true;

      // Check for issues
      const totalProcessed = stats.completed + stats.failed;
      if (totalProcessed > 0) {
        const failureRate = (stats.failed / totalProcessed) * 100;
        if (failureRate > 20) {
          issues.push(`High failure rate: ${failureRate.toFixed(2)}%`);
          healthy = false;
        } else if (failureRate > 10) {
          issues.push(`Elevated failure rate: ${failureRate.toFixed(2)}%`);
        }
      }

      if (stats.waiting > 200) {
        issues.push(`Large backlog: ${stats.waiting} waiting jobs`);
        healthy = false;
      } else if (stats.waiting > 100) {
        issues.push(`Moderate backlog: ${stats.waiting} waiting jobs`);
      }

      report.queues[stats.queueName] = {
        healthy,
        stats,
        issues,
      };

      // Update summary
      report.summary.totalQueues++;
      if (healthy) {
        report.summary.healthyQueues++;
      }

      report.summary.totalJobs.waiting += stats.waiting;
      report.summary.totalJobs.active += stats.active;
      report.summary.totalJobs.completed += stats.completed;
      report.summary.totalJobs.failed += stats.failed;
    }

    // Determine overall health
    if (!report.redis.healthy) {
      report.summary.overallHealth = 'critical';
    } else if (report.summary.healthyQueues < report.summary.totalQueues) {
      const healthyRatio = report.summary.healthyQueues / report.summary.totalQueues;
      report.summary.overallHealth = healthyRatio < 0.5 ? 'critical' : 'warning';
    }

    return report;
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

// Create singleton instance
export const queueMonitor = new QueueMonitor();