"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.monitoringService = void 0;
const logger_1 = require("../utils/logger");
const redis_1 = require("../utils/redis");
class MonitoringService {
    constructor() {
        this.apiMetrics = [];
        this.rateLimits = new Map();
        this.alerts = new Map();
        this.maxMetricsHistory = 10000;
        this.maxAlertsHistory = 1000;
        this.systemStartTime = new Date();
        setInterval(() => this.cleanupOldMetrics(), 10 * 60 * 1000);
        setInterval(() => this.checkSystemHealth(), 60 * 1000);
        setInterval(() => this.persistMetrics(), 5 * 60 * 1000);
        setInterval(() => this.recordSystemPerformance(), 30 * 1000);
    }
    recordApiUsage(metric) {
        const fullMetric = {
            ...metric,
            timestamp: new Date()
        };
        this.apiMetrics.push(fullMetric);
        if (this.apiMetrics.length > this.maxMetricsHistory) {
            this.apiMetrics = this.apiMetrics.slice(-this.maxMetricsHistory);
        }
        if (metric.rateLimitRemaining !== undefined && metric.rateLimitReset) {
            this.updateRateLimitStatus(metric.service, {
                service: metric.service,
                remaining: metric.rateLimitRemaining,
                limit: this.getServiceRateLimit(metric.service),
                resetTime: metric.rateLimitReset,
                isNearLimit: metric.rateLimitRemaining < this.getServiceRateLimitThreshold(metric.service),
                isExceeded: metric.rateLimitRemaining === 0
            });
            logger_1.logger.rateLimitHit(metric.service, `${metric.method} ${metric.endpoint}`, metric.rateLimitRemaining, metric.rateLimitReset, {
                statusCode: metric.statusCode,
                responseTime: metric.responseTime
            });
        }
        if (metric.responseTime > 5000) {
            this.createAlert('warning', metric.service, `Slow API response: ${metric.responseTime}ms`, {
                endpoint: metric.endpoint,
                method: metric.method,
                responseTime: metric.responseTime
            });
        }
        if (metric.statusCode >= 400) {
            const alertType = metric.statusCode >= 500 ? 'error' : 'warning';
            this.createAlert(alertType, metric.service, `API error: ${metric.statusCode}`, {
                endpoint: metric.endpoint,
                method: metric.method,
                statusCode: metric.statusCode
            });
        }
        logger_1.logger.externalService(metric.service, `${metric.method} ${metric.endpoint}`, metric.statusCode < 400, metric.responseTime, {
            statusCode: metric.statusCode,
            rateLimitRemaining: metric.rateLimitRemaining
        });
    }
    getServiceRateLimit(service) {
        const rateLimits = {
            'gemini': 60,
            'openai': 3000,
            'claude': 1000,
            'linkedin': 100,
            'github': 5000,
            'vapi': 1000,
            'api': 100
        };
        return rateLimits[service] || 1000;
    }
    getServiceRateLimitThreshold(service) {
        const limit = this.getServiceRateLimit(service);
        return Math.max(10, Math.floor(limit * 0.1));
    }
    updateRateLimitStatus(service, status) {
        this.rateLimits.set(service, status);
        if (status.isExceeded) {
            this.createAlert('error', service, 'Rate limit exceeded', {
                remaining: status.remaining,
                resetTime: status.resetTime
            });
        }
        else if (status.isNearLimit) {
            this.createAlert('warning', service, 'Approaching rate limit', {
                remaining: status.remaining,
                limit: status.limit,
                resetTime: status.resetTime
            });
        }
    }
    getRateLimitStatus(service) {
        if (service) {
            const status = this.rateLimits.get(service);
            return status ? [status] : [];
        }
        return Array.from(this.rateLimits.values());
    }
    createAlert(type, service, message, metadata) {
        const alertId = `${service}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const alert = {
            id: alertId,
            type,
            service,
            message,
            timestamp: new Date(),
            metadata,
            resolved: false
        };
        this.alerts.set(alertId, alert);
        if (this.alerts.size > this.maxAlertsHistory) {
            const sortedAlerts = Array.from(this.alerts.entries())
                .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());
            this.alerts.clear();
            sortedAlerts.slice(0, this.maxAlertsHistory).forEach(([id, alert]) => {
                this.alerts.set(id, alert);
            });
        }
        const logLevel = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
        logger_1.logger[logLevel](`Alert: ${message}`, {
            service: 'monitoring',
            operation: 'createAlert',
            alertId,
            alertType: type,
            targetService: service,
            metadata
        });
        return alertId;
    }
    resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert && !alert.resolved) {
            alert.resolved = true;
            alert.resolvedAt = new Date();
            logger_1.logger.info(`Alert resolved: ${alert.message}`, {
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
    getAlerts(service, resolved) {
        let alerts = Array.from(this.alerts.values());
        if (service) {
            alerts = alerts.filter(alert => alert.service === service);
        }
        if (resolved !== undefined) {
            alerts = alerts.filter(alert => alert.resolved === resolved);
        }
        return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    async checkSystemHealth() {
        try {
            const metrics = await this.getSystemMetrics();
            const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
            if (memoryUsagePercent > 90) {
                this.createAlert('error', 'system', `High memory usage: ${memoryUsagePercent.toFixed(1)}%`, {
                    memoryUsage: metrics.memory
                });
            }
            else if (memoryUsagePercent > 80) {
                this.createAlert('warning', 'system', `Elevated memory usage: ${memoryUsagePercent.toFixed(1)}%`, {
                    memoryUsage: metrics.memory
                });
            }
            if (metrics.apiUsage.successRate < 0.95) {
                this.createAlert('warning', 'system', `Low API success rate: ${(metrics.apiUsage.successRate * 100).toFixed(1)}%`, {
                    successRate: metrics.apiUsage.successRate,
                    totalRequests: metrics.apiUsage.totalRequests
                });
            }
            if (metrics.apiUsage.averageResponseTime > 5000) {
                this.createAlert('warning', 'system', `High average response time: ${metrics.apiUsage.averageResponseTime}ms`, {
                    averageResponseTime: metrics.apiUsage.averageResponseTime
                });
            }
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
        }
        catch (error) {
            logger_1.logger.error('System health check failed', error, {
                service: 'monitoring',
                operation: 'checkSystemHealth'
            });
        }
    }
    async getSystemMetrics() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const recentMetrics = this.apiMetrics.filter(m => m.timestamp >= oneHourAgo);
        const totalRequests = recentMetrics.length;
        const successfulRequests = recentMetrics.filter(m => m.statusCode < 400).length;
        const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 1;
        const averageResponseTime = totalRequests > 0
            ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests
            : 0;
        const rateLimitViolations = recentMetrics.filter(m => m.statusCode === 429).length;
        let queueStats = {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0
        };
        try {
            const { queueManager } = await Promise.resolve().then(() => __importStar(require('../queues')));
            if (queueManager.isReady()) {
                const actualStats = await queueManager.getAggregatedQueueStats();
                queueStats = {
                    waiting: actualStats.waiting,
                    active: actualStats.active,
                    completed: actualStats.completed,
                    failed: actualStats.failed
                };
            }
        }
        catch (error) {
            logger_1.logger.warn('Failed to get queue stats for monitoring', {
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
            activeConnections: 0,
            queueStats,
            apiUsage: {
                totalRequests,
                successRate,
                averageResponseTime,
                rateLimitViolations
            }
        };
    }
    recordBusinessMetric(metric, value, unit, metadata) {
        logger_1.logger.businessMetric(metric, value, unit, {
            service: 'monitoring',
            operation: 'recordBusinessMetric',
            metadata
        });
        const key = `business:${metric}:${new Date().toISOString().split('T')[0]}`;
        redis_1.redisClient.lpush(key, JSON.stringify({
            value,
            unit,
            timestamp: new Date(),
            metadata
        })).catch((error) => {
            logger_1.logger.error('Failed to store business metric', error, {
                service: 'monitoring',
                operation: 'recordBusinessMetric',
                metric
            });
        });
    }
    recordSystemPerformance() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        this.recordBusinessMetric('system.memory.usage', memoryUsagePercent, '%');
        this.recordBusinessMetric('system.cpu.user', cpuUsage.user, 'microseconds');
        this.recordBusinessMetric('system.cpu.system', cpuUsage.system, 'microseconds');
        const uptimeHours = (Date.now() - this.systemStartTime.getTime()) / (1000 * 60 * 60);
        this.recordBusinessMetric('system.uptime', uptimeHours, 'hours');
    }
    cleanupOldMetrics() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.apiMetrics = this.apiMetrics.filter(m => m.timestamp >= cutoffTime);
        const oldAlerts = Array.from(this.alerts.entries())
            .filter(([, alert]) => alert.timestamp < cutoffTime && alert.resolved);
        oldAlerts.forEach(([id]) => this.alerts.delete(id));
        logger_1.logger.debug('Cleaned up old monitoring data', {
            service: 'monitoring',
            operation: 'cleanupOldMetrics',
            remainingMetrics: this.apiMetrics.length,
            remainingAlerts: this.alerts.size
        });
    }
    async persistMetrics() {
        try {
            const metrics = await this.getSystemMetrics();
            const key = `monitoring:metrics:${Date.now()}`;
            await redis_1.redisClient.setex(key, 24 * 60 * 60, JSON.stringify(metrics));
            logger_1.logger.debug('Persisted system metrics to Redis', {
                service: 'monitoring',
                operation: 'persistMetrics',
                key
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to persist metrics to Redis', error, {
                service: 'monitoring',
                operation: 'persistMetrics'
            });
        }
    }
    getApiMetrics(service, hours = 1) {
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        let metrics = this.apiMetrics.filter(m => m.timestamp >= cutoffTime);
        if (service) {
            metrics = metrics.filter(m => m.service === service);
        }
        return metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    clearMetrics() {
        this.apiMetrics = [];
        this.alerts.clear();
        this.rateLimits.clear();
        logger_1.logger.info('Monitoring metrics cleared', {
            service: 'monitoring',
            operation: 'clearMetrics'
        });
    }
    getMonitoringStatus() {
        return {
            metricsCount: this.apiMetrics.length,
            alertsCount: this.alerts.size,
            rateLimitsCount: this.rateLimits.size,
            unresolvedAlerts: this.getAlerts(undefined, false).length
        };
    }
}
exports.monitoringService = new MonitoringService();
//# sourceMappingURL=monitoringService.js.map