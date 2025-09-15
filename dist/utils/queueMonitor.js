"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueMonitor = exports.QueueMonitor = void 0;
const queues_1 = require("../queues");
const logger_1 = require("./logger");
const redis_1 = require("./redis");
class QueueMonitor {
    constructor() {
        this.monitoringInterval = null;
        this.isMonitoring = false;
    }
    startMonitoring(intervalMs = 30000) {
        if (this.isMonitoring) {
            logger_1.logger.warn('Queue monitoring is already running');
            return;
        }
        this.isMonitoring = true;
        logger_1.logger.info(`Starting queue monitoring with ${intervalMs}ms interval`);
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            }
            catch (error) {
                logger_1.logger.error('Queue monitoring health check failed:', error);
            }
        }, intervalMs);
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        logger_1.logger.info('Queue monitoring stopped');
    }
    async performHealthCheck() {
        const redisHealthy = await redis_1.redisClient.healthCheck();
        if (!redisHealthy) {
            logger_1.logger.error('Redis health check failed - attempting reconnection');
            try {
                await redis_1.redisClient.connect();
            }
            catch (error) {
                logger_1.logger.error('Failed to reconnect to Redis:', error);
            }
        }
        const queueStats = await queues_1.queueManager.getAllQueueStats();
        for (const stats of queueStats) {
            const totalProcessed = stats.completed + stats.failed;
            if (totalProcessed > 0) {
                const failureRate = (stats.failed / totalProcessed) * 100;
                if (failureRate > 10) {
                    logger_1.logger.warn(`High failure rate in queue ${stats.queueName}: ${failureRate.toFixed(2)}%`, {
                        queueName: stats.queueName,
                        failed: stats.failed,
                        completed: stats.completed,
                        failureRate,
                    });
                }
            }
            if (stats.waiting > 100) {
                logger_1.logger.warn(`Large backlog in queue ${stats.queueName}: ${stats.waiting} waiting jobs`, {
                    queueName: stats.queueName,
                    waiting: stats.waiting,
                    active: stats.active,
                });
            }
            if (stats.active > 0) {
                logger_1.logger.debug(`Queue ${stats.queueName} processing ${stats.active} jobs`, {
                    queueName: stats.queueName,
                    active: stats.active,
                    waiting: stats.waiting,
                });
            }
        }
    }
    async getDetailedQueueMetrics() {
        const metrics = {};
        for (const [queueName, queue] of queues_1.queueManager.getAllQueues()) {
            try {
                const stats = await queues_1.queueManager.getQueueStats(queueName);
                const completed = await queue.getCompleted(0, 9);
                const failed = await queue.getFailed(0, 9);
                const active = await queue.getActive(0, 4);
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
            }
            catch (error) {
                logger_1.logger.error(`Failed to get metrics for queue ${queueName}:`, error);
                metrics[queueName] = {
                    stats: null,
                    recentJobs: { completed: [], failed: [], active: [] },
                    error: error instanceof Error ? error.message : String(error),
                };
            }
        }
        return metrics;
    }
    async generateHealthReport() {
        const report = {
            timestamp: new Date(),
            redis: {
                connected: redis_1.redisClient.isClientConnected(),
                healthy: await redis_1.redisClient.healthCheck(),
            },
            queues: {},
            summary: {
                totalQueues: 0,
                healthyQueues: 0,
                totalJobs: { waiting: 0, active: 0, completed: 0, failed: 0 },
                overallHealth: 'healthy',
            },
        };
        const queueStats = await queues_1.queueManager.getAllQueueStats();
        for (const stats of queueStats) {
            const issues = [];
            let healthy = true;
            const totalProcessed = stats.completed + stats.failed;
            if (totalProcessed > 0) {
                const failureRate = (stats.failed / totalProcessed) * 100;
                if (failureRate > 20) {
                    issues.push(`High failure rate: ${failureRate.toFixed(2)}%`);
                    healthy = false;
                }
                else if (failureRate > 10) {
                    issues.push(`Elevated failure rate: ${failureRate.toFixed(2)}%`);
                }
            }
            if (stats.waiting > 200) {
                issues.push(`Large backlog: ${stats.waiting} waiting jobs`);
                healthy = false;
            }
            else if (stats.waiting > 100) {
                issues.push(`Moderate backlog: ${stats.waiting} waiting jobs`);
            }
            report.queues[stats.queueName] = {
                healthy,
                stats,
                issues,
            };
            report.summary.totalQueues++;
            if (healthy) {
                report.summary.healthyQueues++;
            }
            report.summary.totalJobs.waiting += stats.waiting;
            report.summary.totalJobs.active += stats.active;
            report.summary.totalJobs.completed += stats.completed;
            report.summary.totalJobs.failed += stats.failed;
        }
        if (!report.redis.healthy) {
            report.summary.overallHealth = 'critical';
        }
        else if (report.summary.healthyQueues < report.summary.totalQueues) {
            const healthyRatio = report.summary.healthyQueues / report.summary.totalQueues;
            report.summary.overallHealth = healthyRatio < 0.5 ? 'critical' : 'warning';
        }
        return report;
    }
    isMonitoringActive() {
        return this.isMonitoring;
    }
}
exports.QueueMonitor = QueueMonitor;
exports.queueMonitor = new QueueMonitor();
//# sourceMappingURL=queueMonitor.js.map