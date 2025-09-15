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
    /**
     * Initialize all performance optimizations
     */
    async initialize() {
        if (this.isInitialized) {
            logger_1.logger.warn('Performance optimizations already initialized');
            return;
        }
        logger_1.logger.info('Initializing performance optimizations...');
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
            logger_1.logger.info('Performance optimizations initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize performance optimizations:', error);
            throw error;
        }
    }
    /**
     * Initialize database optimizations
     */
    async initializeDatabaseOptimizations() {
        try {
            logger_1.logger.info('Initializing database optimizations...');
            // Ensure database connection is established
            if (!database_1.database.isDbConnected()) {
                await database_1.database.connect();
            }
            // Create optimized indexes
            await database_1.database.createIndexes();
            // Optimize connection settings
            await database_1.database.optimizeConnection();
            logger_1.logger.info('Database optimizations initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize database optimizations:', error);
            throw error;
        }
    }
    /**
     * Initialize caching service
     */
    async initializeCaching() {
        try {
            logger_1.logger.info('Initializing caching service...');
            // Ensure Redis connection is established
            if (!redis_1.redisClient.isClientConnected()) {
                await redis_1.redisClient.connect();
            }
            // Perform cache health check
            const cacheHealth = await cachingService_1.cachingService.healthCheck();
            if (!cacheHealth.healthy) {
                throw new Error(`Cache health check failed: ${JSON.stringify(cacheHealth.details)}`);
            }
            // Warm up cache with frequently accessed data
            await cachingService_1.cachingService.warmUpCache();
            logger_1.logger.info('Caching service initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize caching service:', error);
            throw error;
        }
    }
    /**
     * Initialize connection pooling for external APIs
     */
    async initializeConnectionPooling() {
        try {
            logger_1.logger.info('Initializing connection pooling...');
            const secrets = config_1.config.getSecretsConfig();
            // Initialize pools for external APIs
            const apiEndpoints = [
                {
                    name: 'gemini',
                    baseURL: 'https://generativelanguage.googleapis.com',
                    headers: {
                        'Authorization': `Bearer ${secrets.geminiApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    rateLimit: {
                        requests: 60,
                        windowMs: 60000 // 60 requests per minute
                    }
                },
                {
                    name: 'openai',
                    baseURL: 'https://api.openai.com',
                    headers: {
                        'Authorization': `Bearer ${secrets.openaiApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    rateLimit: {
                        requests: 100,
                        windowMs: 60000 // 100 requests per minute
                    }
                },
                {
                    name: 'claude',
                    baseURL: 'https://api.anthropic.com',
                    headers: {
                        'Authorization': `Bearer ${secrets.claudeApiKey}`,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    rateLimit: {
                        requests: 50,
                        windowMs: 60000 // 50 requests per minute
                    }
                },
                {
                    name: 'github',
                    baseURL: 'https://api.github.com',
                    headers: {
                        'Authorization': `token ${secrets.githubToken}`,
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    rateLimit: {
                        requests: 5000,
                        windowMs: 3600000 // 5000 requests per hour
                    }
                },
                {
                    name: 'linkedin-scraper',
                    baseURL: secrets.linkedinScraperBaseUrl,
                    headers: {
                        'Authorization': `Bearer ${secrets.linkedinScraperApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    rateLimit: {
                        requests: 100,
                        windowMs: 60000 // 100 requests per minute
                    }
                },
                {
                    name: 'vapi',
                    baseURL: secrets.vapiBaseUrl,
                    headers: {
                        'Authorization': `Bearer ${secrets.vapiApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    rateLimit: {
                        requests: 200,
                        windowMs: 60000 // 200 requests per minute
                    }
                }
            ];
            // Initialize connection pools
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
            // Perform health check
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
    /**
     * Initialize memory management
     */
    async initializeMemoryManagement() {
        try {
            logger_1.logger.info('Initializing memory management...');
            // Register cleanup callbacks for various services
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
            // Set up memory monitoring event listeners
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
            // Perform health check
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
    /**
     * Initialize optimized file processing
     */
    async initializeOptimizedFileProcessing() {
        try {
            logger_1.logger.info('Initializing optimized file processing...');
            // Configure file processing options based on available memory
            const memoryStats = memoryManagementService_1.memoryManagementService.getMemoryStats();
            const processingLimits = memoryManagementService_1.memoryManagementService.getProcessingLimits();
            optimizedFileProcessingService_1.optimizedFileProcessingService.updateProcessingOptions({
                maxConcurrentFiles: processingLimits.maxConcurrentJobs,
                chunkSize: 1024 * 1024, // 1MB chunks
                useStreaming: true,
                enableCaching: true,
                tempDirectory: './temp'
            });
            // Perform health check
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
    /**
     * Get performance health status
     */
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
            const overallHealthy = Object.values(results).every(result => result.healthy);
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
    /**
     * Get performance statistics
     */
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
    /**
     * Update performance configuration
     */
    updateConfig(config) {
        Object.assign(this.performanceConfig, config);
        logger_1.logger.info('Performance configuration updated', {
            service: 'performanceInitialization',
            config: this.performanceConfig
        });
    }
    /**
     * Shutdown all performance services
     */
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
    /**
     * Check if performance optimizations are initialized
     */
    isReady() {
        return this.isInitialized;
    }
}
exports.PerformanceInitializationService = PerformanceInitializationService;
// Export singleton instance
exports.performanceInitializationService = new PerformanceInitializationService();
