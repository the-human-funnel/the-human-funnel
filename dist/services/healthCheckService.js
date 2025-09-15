"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheckService = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const redis_1 = require("../utils/redis");
const queues_1 = require("../queues");
class HealthCheckService {
    constructor() {
        this.activeConnections = 0;
        this.startTime = new Date();
    }
    incrementConnections() {
        this.activeConnections++;
    }
    decrementConnections() {
        this.activeConnections = Math.max(0, this.activeConnections - 1);
    }
    async checkDatabase() {
        const startTime = Date.now();
        try {
            const result = await database_1.database.healthCheck();
            const responseTime = Date.now() - startTime;
            return {
                status: result.connected ? 'healthy' : 'unhealthy',
                responseTime,
                lastChecked: new Date(),
                details: result
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            logger_1.logger.error('Database health check failed', error, {
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
    async checkRedis() {
        const startTime = Date.now();
        try {
            await redis_1.redisClient.ping();
            const responseTime = Date.now() - startTime;
            return {
                status: 'healthy',
                responseTime,
                lastChecked: new Date()
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            logger_1.logger.error('Redis health check failed', error, {
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
    async checkQueues() {
        const startTime = Date.now();
        try {
            const queueHealth = await queues_1.queueManager.getHealthStatus();
            const responseTime = Date.now() - startTime;
            return {
                status: queueHealth.healthy ? 'healthy' : 'degraded',
                responseTime,
                lastChecked: new Date(),
                details: queueHealth
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            logger_1.logger.error('Queue health check failed', error, {
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
    async checkExternalApi(name, url, timeout = 5000) {
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
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            logger_1.logger.warn(`External API health check failed: ${name}`, {
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
    async checkAiProviders() {
        const providers = {
            gemini: 'https://generativelanguage.googleapis.com',
            openai: 'https://api.openai.com',
            claude: 'https://api.anthropic.com'
        };
        const results = {};
        for (const [provider, url] of Object.entries(providers)) {
            results[provider] = await this.checkExternalApi(provider, url, 10000);
        }
        return results;
    }
    async checkServiceConnectivity() {
        const [databaseHealth, redisHealth, queueHealth, aiProviders] = await Promise.allSettled([
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
    async getQueueStats() {
        try {
            const stats = await queues_1.queueManager.getAggregatedQueueStats();
            return {
                waiting: stats.waiting || 0,
                active: stats.active || 0,
                completed: stats.completed || 0,
                failed: stats.failed || 0,
                delayed: stats.delayed || 0
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get queue stats', error, {
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
    async getFullHealthStatus() {
        const startTime = Date.now();
        try {
            const [databaseHealth, redisHealth, queueHealth, queueStats, geminiHealth, openaiHealth, claudeHealth, linkedinHealth, githubHealth, vapiHealth] = await Promise.allSettled([
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
            const getResult = (result, fallback) => {
                return result.status === 'fulfilled' ? result.value : fallback;
            };
            const services = {
                database: getResult(databaseHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }),
                redis: getResult(redisHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }),
                queues: getResult(queueHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }),
                externalApis: {
                    gemini: getResult(geminiHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }),
                    openai: getResult(openaiHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }),
                    claude: getResult(claudeHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }),
                    linkedin: getResult(linkedinHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }),
                    github: getResult(githubHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' }),
                    vapi: getResult(vapiHealth, { status: 'unhealthy', lastChecked: new Date(), error: 'Health check failed' })
                }
            };
            const coreServices = [services.database, services.redis, services.queues];
            const hasUnhealthyCore = coreServices.some(service => service.status === 'unhealthy');
            const hasDegradedCore = coreServices.some(service => service.status === 'degraded');
            let overallStatus;
            if (hasUnhealthyCore) {
                overallStatus = 'unhealthy';
            }
            else if (hasDegradedCore) {
                overallStatus = 'degraded';
            }
            else {
                overallStatus = 'healthy';
            }
            const healthStatus = {
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
            logger_1.logger.performance('fullHealthCheck', checkDuration, true, {
                service: 'healthCheck',
                operation: 'getFullHealthStatus',
                overallStatus
            });
            return healthStatus;
        }
        catch (error) {
            const checkDuration = Date.now() - startTime;
            logger_1.logger.error('Health check failed', error, {
                service: 'healthCheck',
                operation: 'getFullHealthStatus'
            });
            logger_1.logger.performance('fullHealthCheck', checkDuration, false, {
                service: 'healthCheck',
                operation: 'getFullHealthStatus'
            });
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
    async getBasicHealthStatus() {
        try {
            const [dbResult, redisResult] = await Promise.allSettled([
                database_1.database.healthCheck(),
                redis_1.redisClient.ping()
            ]);
            const dbHealthy = dbResult.status === 'fulfilled' && dbResult.value.connected;
            const redisHealthy = redisResult.status === 'fulfilled';
            return {
                status: (dbHealthy && redisHealthy) ? 'healthy' : 'unhealthy',
                timestamp: new Date()
            };
        }
        catch (error) {
            logger_1.logger.error('Basic health check failed', error, {
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
exports.healthCheckService = new HealthCheckService();
//# sourceMappingURL=healthCheckService.js.map