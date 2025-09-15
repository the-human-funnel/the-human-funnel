"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceInitializationService = exports.PerformanceInitializationService = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const redis_1 = require("../utils/redis");
const cachingService_1 = require("./cachingService");
const connectionPoolService_1 = require("./connectionPoolService");
const memoryManagementService_1 = require("./memoryManagementService");
const optimizedFileProcessingService_1 = require("./optimizedFileProcessingService");
const config_1 = require("../config");
class PerformanceInitializationService {
    constructor() {
        this.isInitialized = false;
        this.performanceConfig = {
            enableCaching: true,
            enableConnectionPooling: true,
            enableMemoryManagement: true,
            enableOptimizedFileProcessing: true,
            enableDatabaseOptimizations: true
        };
    }
    async initialize() {
        if (this.isInitialized) {
            logger_1.logger.warn('Performance optimizations already initialized');
            return;
        }
        logger_1.logger.info('Initializing performance optimizations...');
        try {
            if (this.performanceConfig.enableDatabaseOptimizations) {
                await this.initializeDatabaseOptimizations();
            }
            if (this.performanceConfig.enableCaching) {
                await this.initializeCaching();
            }
            if (this.performanceConfig.enableConnectionPooling) {
                await this.initializeConnectionPooling();
            }
            if (this.performanceConfig.enableMemoryManagement) {
                await this.initializeMemoryManagement();
            }
            if (this.performanceConfig.enableOptimizedFileProcessing) {
                await this.initializeOptimizedFileProcessing();
            }
            this.isInitialized = true;
            logger_1.logger.info('Performance optimizations initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize performance optimizations:', error);
            throw error;
        }
    }
    async initializeDatabaseOptimizations() {
        try {
            logger_1.logger.info('Initializing database optimizations...');
            if (!database_1.database.isDbConnected()) {
                await database_1.database.connect();
            }
            await database_1.database.createIndexes();
            await database_1.database.optimizeConnection();
            logger_1.logger.info('Database optimizations initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize database optimizations:', error);
            logger_1.logger.warn('Continuing without full database optimizations');
        }
    }
    async initializeCaching() {
        try {
            logger_1.logger.info('Initializing caching service...');
            if (!redis_1.redisClient.isClientConnected()) {
                await redis_1.redisClient.connect();
            }
            const cacheHealth = await cachingService_1.cachingService.healthCheck();
            if (!cacheHealth.healthy) {
                throw new Error(`Cache health check failed: ${JSON.stringify(cacheHealth.details)}`);
            }
            await cachingService_1.cachingService.warmUpCache();
            logger_1.logger.info('Caching service initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize caching service:', error);
            throw error;
        }
    }
    async initializeConnectionPooling() {
        try {
            logger_1.logger.info('Initializing connection pooling...');
            const secrets = config_1.config.getSecretsConfig();
            const apiEndpoints = [
                {
                    name: 'gemini',
                    baseURL: 'https://generativelanguage.googleapis.com',
                    headers: secrets.geminiApiKey ? {
                        'Authorization': `Bearer ${secrets.geminiApiKey}`,
                        'Content-Type': 'application/json'
                    } : undefined,
                    rateLimit: {
                        requests: 60,
                        windowMs: 60000
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
                        windowMs: 60000
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
                        windowMs: 60000
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
                        windowMs: 3600000
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
                        windowMs: 60000
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
                        windowMs: 60000
                    }
                }
            ];
            for (const endpoint of apiEndpoints) {
                connectionPoolService_1.connectionPoolService.initializePool(endpoint, {
                    maxConnections: 10,
                    timeout: 30000,
                    retryAttempts: 3,
                    retryDelay: 1000,
                    keepAlive: true,
                    maxIdleTime: 60000
                });
            }
            const poolHealth = await connectionPoolService_1.connectionPoolService.healthCheck();
            if (!poolHealth.healthy) {
                logger_1.logger.warn('Some connection pools failed health check:', poolHealth.details);
            }
            logger_1.logger.info('Connection pooling initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize connection pooling:', error);
            throw error;
        }
    }
    async initializeMemoryManagement() {
        try {
            logger_1.logger.info('Initializing memory management...');
            memoryManagementService_1.memoryManagementService.registerCleanupCallback(async () => {
                logger_1.logger.info('Executing cache cleanup...');
                await cachingService_1.cachingService.invalidateByPattern('temp:*');
            });
            memoryManagementService_1.memoryManagementService.registerCleanupCallback(async () => {
                logger_1.logger.info('Executing file processing cleanup...');
                await optimizedFileProcessingService_1.optimizedFileProcessingService.cleanup();
            });
            memoryManagementService_1.memoryManagementService.registerCleanupCallback(async () => {
                logger_1.logger.info('Executing connection pool cleanup...');
                await connectionPoolService_1.connectionPoolService.cleanup();
            });
            memoryManagementService_1.memoryManagementService.on('memoryWarning', (stats) => {
                logger_1.logger.warn('Memory usage warning triggered', {
                    service: 'performanceInitialization',
                    memoryPercentage: stats.percentage,
                    heapUsed: stats.heapUsed
                });
            });
            memoryManagementService_1.memoryManagementService.on('memoryHigh', (stats) => {
                logger_1.logger.error('High memory usage detected', {
                    service: 'performanceInitialization',
                    memoryPercentage: stats.percentage,
                    heapUsed: stats.heapUsed
                });
            });
            memoryManagementService_1.memoryManagementService.on('memoryCritical', (stats) => {
                logger_1.logger.error('Critical memory usage - emergency cleanup triggered', {
                    service: 'performanceInitialization',
                    memoryPercentage: stats.percentage,
                    heapUsed: stats.heapUsed
                });
            });
            const memoryHealth = await memoryManagementService_1.memoryManagementService.healthCheck();
            if (!memoryHealth.healthy) {
                logger_1.logger.warn('Memory management health check failed:', memoryHealth.details);
            }
            logger_1.logger.info('Memory management initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize memory management:', error);
            throw error;
        }
    }
    async initializeOptimizedFileProcessing() {
        try {
            logger_1.logger.info('Initializing optimized file processing...');
            const memoryStats = memoryManagementService_1.memoryManagementService.getMemoryStats();
            const processingLimits = memoryManagementService_1.memoryManagementService.getProcessingLimits();
            optimizedFileProcessingService_1.optimizedFileProcessingService.updateProcessingOptions({
                maxConcurrentFiles: processingLimits.maxConcurrentJobs,
                chunkSize: 1024 * 1024,
                useStreaming: true,
                enableCaching: true,
                tempDirectory: './temp'
            });
            const fileProcessingHealth = await optimizedFileProcessingService_1.optimizedFileProcessingService.healthCheck();
            if (!fileProcessingHealth.healthy) {
                logger_1.logger.warn('File processing health check failed:', fileProcessingHealth.details);
            }
            logger_1.logger.info('Optimized file processing initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize optimized file processing:', error);
            throw error;
        }
    }
    async getHealthStatus() {
        if (!this.isInitialized) {
            return {
                healthy: false,
                details: { error: 'Performance optimizations not initialized' }
            };
        }
        try {
            const healthChecks = await Promise.allSettled([
                database_1.database.healthCheck(),
                cachingService_1.cachingService.healthCheck(),
                connectionPoolService_1.connectionPoolService.healthCheck(),
                memoryManagementService_1.memoryManagementService.healthCheck(),
                optimizedFileProcessingService_1.optimizedFileProcessingService.healthCheck()
            ]);
            const results = {
                database: healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : { healthy: false, details: { error: 'Health check failed' } },
                caching: healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : { healthy: false, details: { error: 'Health check failed' } },
                connectionPooling: healthChecks[2].status === 'fulfilled' ? healthChecks[2].value : { healthy: false, details: { error: 'Health check failed' } },
                memoryManagement: healthChecks[3].status === 'fulfilled' ? healthChecks[3].value : { healthy: false, details: { error: 'Health check failed' } },
                fileProcessing: healthChecks[4].status === 'fulfilled' ? healthChecks[4].value : { healthy: false, details: { error: 'Health check failed' } }
            };
            const overallHealthy = Object.values(results).every(result => typeof result === 'object' && result !== null && 'healthy' in result && result.healthy);
            return {
                healthy: overallHealthy,
                details: {
                    initialized: this.isInitialized,
                    config: this.performanceConfig,
                    services: results
                }
            };
        }
        catch (error) {
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    initialized: this.isInitialized
                }
            };
        }
    }
    async getPerformanceStats() {
        if (!this.isInitialized) {
            return { error: 'Performance optimizations not initialized' };
        }
        try {
            const [dbStats, cacheStats, connectionStats, memoryStats] = await Promise.allSettled([
                database_1.database.getPerformanceStats(),
                cachingService_1.cachingService.getStats(),
                connectionPoolService_1.connectionPoolService.getStats(),
                memoryManagementService_1.memoryManagementService.getMemoryStats()
            ]);
            return {
                database: dbStats.status === 'fulfilled' ? dbStats.value : null,
                cache: cacheStats.status === 'fulfilled' ? cacheStats.value : null,
                connections: connectionStats.status === 'fulfilled' ? connectionStats.value : null,
                memory: memoryStats.status === 'fulfilled' ? memoryStats.value : null,
                timestamp: new Date()
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get performance stats:', error);
            return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    updateConfig(config) {
        Object.assign(this.performanceConfig, config);
        logger_1.logger.info('Performance configuration updated', {
            service: 'performanceInitialization',
            config: this.performanceConfig
        });
    }
    async shutdown() {
        logger_1.logger.info('Shutting down performance services...');
        try {
            await Promise.allSettled([
                memoryManagementService_1.memoryManagementService.shutdown(),
                optimizedFileProcessingService_1.optimizedFileProcessingService.cleanup(),
                connectionPoolService_1.connectionPoolService.cleanup(),
                redis_1.redisClient.disconnect(),
                database_1.database.disconnect()
            ]);
            this.isInitialized = false;
            logger_1.logger.info('Performance services shutdown completed');
        }
        catch (error) {
            logger_1.logger.error('Error during performance services shutdown:', error);
        }
    }
    isReady() {
        return this.isInitialized;
    }
}
exports.PerformanceInitializationService = PerformanceInitializationService;
exports.performanceInitializationService = new PerformanceInitializationService();
//# sourceMappingURL=performanceInitializationService.js.map