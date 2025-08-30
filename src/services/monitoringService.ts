import { logger } from '../utils/logger';
import { redisClient } from '../utils/redis';

export interface ApiUsageMetric {
  service: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

export interface RateLimitStatus {
  service: string;
  remaining: number;
  limit: number;
  resetTime: Date;
  isNearLimit: boolean;
  isExceeded: boolean;
}

export interface SystemMetrics {
  timestamp: Date;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  uptime: number;
  activeConnections: number;
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  apiUsage: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    rateLimitViolations: number;
  };
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  service: string;
  message: string;
  timestamp: Date;
  metadata?: any;
  resolved?: boolean;
  resolvedAt?: Date;
}

class MonitoringService {
  private apiMetrics: ApiUsageMetric[] = [];
  private rateLimits: Map<string, RateLimitStatus> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private maxMetricsHistory = 10000;
  private maxAlertsHistory = 1000;
  private systemStartTime: Date;

  constructor() {
    this.systemStartTime = new Date();
    
    // Clean up old metrics every 10 minutes
    setInterval(() => this.cleanupOldMetrics(), 10 * 60 * 1000);
    
    // Check system health every minute
    setInterval(() => this.checkSystemHealth(), 60 * 1000);
    
    // Persist metrics to Redis every 5 minutes
    setInterval(() => this.persistMetrics(), 5 * 60 * 1000);
    
    // Record system performance every 30 seconds
    setInterval(() => this.recordSystemPerformance(), 30 * 1000);
  }

  // API Usage Monitoring
  recordApiUsage(metric: Omit<ApiUsageMetric, 'timestamp'>): void {
    const fullMetric: ApiUsageMetric = {
      ...metric,
      timestamp: new Date()
    };
    
    this.apiMetrics.push(fullMetric);
    
    // Trim old metrics
    if (this.apiMetrics.length > this.maxMetricsHistory) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetricsHistory);
    }
    
    // Update rate limit status if provided
    if (metric.rateLimitRemaining !== undefined && metric.rateLimitReset) {
      this.updateRateLimitStatus(metric.service, {
        service: metric.service,
        remaining: metric.rateLimitRemaining,
        limit: this.getServiceRateLimit(metric.service),
        resetTime: metric.rateLimitReset,
        isNearLimit: metric.rateLimitRemaining < this.getServiceRateLimitThreshold(metric.service),
        isExceeded: metric.rateLimitRemaining === 0
      });
      
      // Log rate limit status
      logger.rateLimitHit(
        metric.service,
        `${metric.method} ${metric.endpoint}`,
        metric.rateLimitRemaining,
        metric.rateLimitReset,
        {
          statusCode: metric.statusCode,
          responseTime: metric.responseTime
        }
      );
    }
    
    // Log slow requests
    if (metric.responseTime > 5000) {
      this.createAlert('warning', metric.service, `Slow API response: ${metric.responseTime}ms`, {
        endpoint: metric.endpoint,
        method: metric.method,
        responseTime: metric.responseTime
      });
    }
    
    // Log API errors
    if (metric.statusCode >= 400) {
      const alertType = metric.statusCode >= 500 ? 'error' : 'warning';
      this.createAlert(alertType, metric.service, `API error: ${metric.statusCode}`, {
        endpoint: metric.endpoint,
        method: metric.method,
        statusCode: metric.statusCode
      });
    }
    
    logger.externalService(
      metric.service,
      `${metric.method} ${metric.endpoint}`,
      metric.statusCode < 400,
      metric.responseTime,
      {
        statusCode: metric.statusCode,
        rateLimitRemaining: metric.rateLimitRemaining
      }
    );
  }

  private getServiceRateLimit(service: string): number {
    const rateLimits: Record<string, number> = {
      'gemini': 60, // 60 requests per minute
      'openai': 3000, // 3000 requests per minute
      'claude': 1000, // 1000 requests per minute
      'linkedin': 100, // 100 requests per hour
      'github': 5000, // 5000 requests per hour
      'vapi': 1000, // 1000 requests per hour
      'api': 100 // Internal API rate limit per minute
    };
    return rateLimits[service] || 1000;
  }

  private getServiceRateLimitThreshold(service: string): number {
    const limit = this.getServiceRateLimit(service);
    return Math.max(10, Math.floor(limit * 0.1)); // 10% of limit or minimum 10
  }

  // Rate Limit Monitoring
  updateRateLimitStatus(service: string, status: RateLimitStatus): void {
    this.rateLimits.set(service, status);
    
    // Create alerts for rate limit issues
    if (status.isExceeded) {
      this.createAlert('error', service, 'Rate limit exceeded', {
        remaining: status.remaining,
        resetTime: status.resetTime
      });
    } else if (status.isNearLimit) {
      this.createAlert('warning', service, 'Approaching rate limit', {
        remaining: status.remaining,
        limit: status.limit,
        resetTime: status.resetTime
      });
    }
  }

  getRateLimitStatus(service?: string): RateLimitStatus[] {
    if (service) {
      const status = this.rateLimits.get(service);
      return status ? [status] : [];
    }
    return Array.from(this.rateLimits.values());
  }

  // Alert Management
  createAlert(type: Alert['type'], service: string, message: string, metadata?: any): string {
    const alertId = `${service}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: Alert = {
      id: alertId,
      type,
      service,
      message,
      timestamp: new Date(),
      metadata,
      resolved: false
    };
    
    this.alerts.set(alertId, alert);
    
    // Trim old alerts
    if (this.alerts.size > this.maxAlertsHistory) {
      const sortedAlerts = Array.from(this.alerts.entries())
        .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());
      
      this.alerts.clear();
      sortedAlerts.slice(0, this.maxAlertsHistory).forEach(([id, alert]) => {
        this.alerts.set(id, alert);
      });
    }
    
    // Log the alert
    const logLevel = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
    logger[logLevel](`Alert: ${message}`, {
      service: 'monitoring',
      operation: 'createAlert',
      alertId,
      alertType: type,
      targetService: service,
      metadata
    });
    
    return alertId;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      logger.info(`Alert resolved: ${alert.message}`, {
        service: 'monitoring',
        operation: 'resolveAlert',
        alertId,
        alertType: alert.type,
        targetService: alert.service
      });
      
      return true;
    }
    return false;
  }

  getAlerts(service?: string, resolved?: boolean): Alert[] {
    let alerts = Array.from(this.alerts.values());
    
    if (service) {
      alerts = alerts.filter(alert => alert.service === service);
    }
    
    if (resolved !== undefined) {
      alerts = alerts.filter(alert => alert.resolved === resolved);
    }
    
    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // System Health Monitoring
  private async checkSystemHealth(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      
      // Check memory usage
      const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
      if (memoryUsagePercent > 90) {
        this.createAlert('error', 'system', `High memory usage: ${memoryUsagePercent.toFixed(1)}%`, {
          memoryUsage: metrics.memory
        });
      } else if (memoryUsagePercent > 80) {
        this.createAlert('warning', 'system', `Elevated memory usage: ${memoryUsagePercent.toFixed(1)}%`, {
          memoryUsage: metrics.memory
        });
      }
      
      // Check API success rate
      if (metrics.apiUsage.successRate < 0.95) {
        this.createAlert('warning', 'system', `Low API success rate: ${(metrics.apiUsage.successRate * 100).toFixed(1)}%`, {
          successRate: metrics.apiUsage.successRate,
          totalRequests: metrics.apiUsage.totalRequests
        });
      }
      
      // Check average response time
      if (metrics.apiUsage.averageResponseTime > 5000) {
        this.createAlert('warning', 'system', `High average response time: ${metrics.apiUsage.averageResponseTime}ms`, {
          averageResponseTime: metrics.apiUsage.averageResponseTime
        });
      }
      
      // Check queue health
      const totalQueueJobs = metrics.queueStats.waiting + metrics.queueStats.active;
      if (totalQueueJobs > 1000) {
        this.createAlert('warning', 'queue', `High queue backlog: ${totalQueueJobs} jobs`, {
          queueStats: metrics.queueStats
        });
      }
      
      if (metrics.queueStats.failed > 100) {
        this.createAlert('error', 'queue', `High number of failed jobs: ${metrics.queueStats.failed}`, {
          queueStats: metrics.queueStats
        });
      }
      
    } catch (error) {
      logger.error('System health check failed', error, {
        service: 'monitoring',
        operation: 'checkSystemHealth'
      });
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Filter recent API metrics
    const recentMetrics = this.apiMetrics.filter(m => m.timestamp >= oneHourAgo);
    
    // Calculate API usage statistics
    const totalRequests = recentMetrics.length;
    const successfulRequests = recentMetrics.filter(m => m.statusCode < 400).length;
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 1;
    const averageResponseTime = totalRequests > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests 
      : 0;
    const rateLimitViolations = recentMetrics.filter(m => m.statusCode === 429).length;
    
    // Get queue stats from queue manager
    let queueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0
    };
    
    try {
      // Import queueManager dynamically to avoid circular dependency
      const { queueManager } = await import('../queues');
      if (queueManager.isReady()) {
        const actualStats = await queueManager.getAggregatedQueueStats();
        queueStats = {
          waiting: actualStats.waiting,
          active: actualStats.active,
          completed: actualStats.completed,
          failed: actualStats.failed
        };
      }
    } catch (error) {
      logger.warn('Failed to get queue stats for monitoring', {
        service: 'monitoring',
        operation: 'getSystemMetrics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return {
      timestamp: now,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: Date.now() - this.systemStartTime.getTime(),
      activeConnections: 0, // This would be tracked by the health check service
      queueStats,
      apiUsage: {
        totalRequests,
        successRate,
        averageResponseTime,
        rateLimitViolations
      }
    };
  }

  // Business metrics tracking
  recordBusinessMetric(metric: string, value: number, unit?: string, metadata?: any): void {
    logger.businessMetric(metric, value, unit, {
      service: 'monitoring',
      operation: 'recordBusinessMetric',
      metadata
    });
    
    // Store business metrics for trending analysis
    const key = `business:${metric}:${new Date().toISOString().split('T')[0]}`;
    redisClient.lpush(key, JSON.stringify({
      value,
      unit,
      timestamp: new Date(),
      metadata
    })).catch((error: Error) => {
      logger.error('Failed to store business metric', error, {
        service: 'monitoring',
        operation: 'recordBusinessMetric',
        metric
      });
    });
  }

  // System performance tracking
  recordSystemPerformance(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Record memory usage percentage
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.recordBusinessMetric('system.memory.usage', memoryUsagePercent, '%');
    
    // Record CPU usage (this is cumulative, so we need to track deltas)
    this.recordBusinessMetric('system.cpu.user', cpuUsage.user, 'microseconds');
    this.recordBusinessMetric('system.cpu.system', cpuUsage.system, 'microseconds');
    
    // Record uptime
    const uptimeHours = (Date.now() - this.systemStartTime.getTime()) / (1000 * 60 * 60);
    this.recordBusinessMetric('system.uptime', uptimeHours, 'hours');
  }

  // Metrics Management
  private cleanupOldMetrics(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean up API metrics
    this.apiMetrics = this.apiMetrics.filter(m => m.timestamp >= cutoffTime);
    
    // Clean up old alerts
    const oldAlerts = Array.from(this.alerts.entries())
      .filter(([, alert]) => alert.timestamp < cutoffTime && alert.resolved);
    
    oldAlerts.forEach(([id]) => this.alerts.delete(id));
    
    logger.debug('Cleaned up old monitoring data', {
      service: 'monitoring',
      operation: 'cleanupOldMetrics',
      remainingMetrics: this.apiMetrics.length,
      remainingAlerts: this.alerts.size
    });
  }

  private async persistMetrics(): Promise<void> {
    try {
      const metrics = await this.getSystemMetrics();
      const key = `monitoring:metrics:${Date.now()}`;
      
      await redisClient.setex(key, 24 * 60 * 60, JSON.stringify(metrics)); // 24 hour TTL
      
      logger.debug('Persisted system metrics to Redis', {
        service: 'monitoring',
        operation: 'persistMetrics',
        key
      });
    } catch (error) {
      logger.error('Failed to persist metrics to Redis', error, {
        service: 'monitoring',
        operation: 'persistMetrics'
      });
    }
  }

  // Export methods for external use
  getApiMetrics(service?: string, hours: number = 1): ApiUsageMetric[] {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    let metrics = this.apiMetrics.filter(m => m.timestamp >= cutoffTime);
    
    if (service) {
      metrics = metrics.filter(m => m.service === service);
    }
    
    return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  clearMetrics(): void {
    this.apiMetrics = [];
    this.alerts.clear();
    this.rateLimits.clear();
    
    logger.info('Monitoring metrics cleared', {
      service: 'monitoring',
      operation: 'clearMetrics'
    });
  }

  getMonitoringStatus(): {
    metricsCount: number;
    alertsCount: number;
    rateLimitsCount: number;
    unresolvedAlerts: number;
  } {
    return {
      metricsCount: this.apiMetrics.length,
      alertsCount: this.alerts.size,
      rateLimitsCount: this.rateLimits.size,
      unresolvedAlerts: this.getAlerts(undefined, false).length
    };
  }
}

export const monitoringService = new MonitoringService();