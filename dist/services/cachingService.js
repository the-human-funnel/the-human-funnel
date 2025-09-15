"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachingService = exports.CachingService = void 0;
const redis_1 = require("../utils/redis");
const logger_1 = require("../utils/logger");
class CachingService {
    constructor() {
        this.defaultTTL = 3600;
        this.cacheConfigs = new Map();
        this.stats = {
            hits: 0,
            misses: 0
        };
        this.initializeCacheConfigs();
    }
    initializeCacheConfigs() {
        this.cacheConfigs.set('jobProfile', {
            ttl: 86400,
            prefix: 'jp:'
        });
        this.cacheConfigs.set('aiAnalysis', {
            ttl: 604800,
            prefix: 'ai:'
        });
        this.cacheConfigs.set('linkedInAnalysis', {
            ttl: 86400,
            prefix: 'li:'
        });
        this.cacheConfigs.set('githubAnalysis', {
            ttl: 43200,
            prefix: 'gh:'
        });
        this.cacheConfigs.set('candidate', {
            ttl: 21600,
            prefix: 'cd:'
        });
        this.cacheConfigs.set('resumeData', {
            ttl: 86400,
            prefix: 'rd:'
        });
        this.cacheConfigs.set('externalApi', {
            ttl: 3600,
            prefix: 'api:'
        });
        this.cacheConfigs.set('searchResults', {
            ttl: 1800,
            prefix: 'sr:'
        });
        this.cacheConfigs.set('batchStatus', {
            ttl: 300,
            prefix: 'bs:'
        });
    }
    generateKey(type, identifier) {
        const config = this.cacheConfigs.get(type);
        if (!config) {
            throw new Error(`Unknown cache type: ${type}`);
        }
        return `${config.prefix}${identifier}`;
    }
    async set(type, identifier, data, customTTL) {
        try {
            const config = this.cacheConfigs.get(type);
            if (!config) {
                throw new Error(`Unknown cache type: ${type}`);
            }
            const key = this.generateKey(type, identifier);
            const ttl = customTTL || config.ttl;
            const serializedData = JSON.stringify(data);
            await redis_1.redisClient.setex(key, ttl, serializedData);
            logger_1.logger.debug(`Cache set: ${key}`, {
                service: 'caching',
                operation: 'set',
                type,
                identifier,
                ttl,
                dataSize: serializedData.length
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to set cache for ${type}:${identifier}`, error);
        }
    }
    async get(type, identifier) {
        try {
            const key = this.generateKey(type, identifier);
            const cachedData = await redis_1.redisClient.get(key);
            if (cachedData) {
                this.stats.hits++;
                const parsedData = JSON.parse(cachedData);
                logger_1.logger.debug(`Cache hit: ${key}`, {
                    service: 'caching',
                    operation: 'get',
                    type,
                    identifier,
                    hit: true
                });
                return parsedData;
            }
            else {
                this.stats.misses++;
                logger_1.logger.debug(`Cache miss: ${key}`, {
                    service: 'caching',
                    operation: 'get',
                    type,
                    identifier,
                    hit: false
                });
                return null;
            }
        }
        catch (error) {
            this.stats.misses++;
            logger_1.logger.error(`Failed to get cache for ${type}:${identifier}`, error);
            return null;
        }
    }
    async delete(type, identifier) {
        try {
            const key = this.generateKey(type, identifier);
            await redis_1.redisClient.del(key);
            logger_1.logger.debug(`Cache deleted: ${key}`, {
                service: 'caching',
                operation: 'delete',
                type,
                identifier
            });
        }
        catch (error) {
            logger_1.logger.error(`Failed to delete cache for ${type}:${identifier}`, error);
        }
    }
    async exists(type, identifier) {
        try {
            const key = this.generateKey(type, identifier);
            const exists = await redis_1.redisClient.exists(key);
            return exists === 1;
        }
        catch (error) {
            logger_1.logger.error(`Failed to check cache existence for ${type}:${identifier}`, error);
            return false;
        }
    }
    async getOrSet(type, identifier, computeFn, customTTL) {
        const cachedData = await this.get(type, identifier);
        if (cachedData !== null) {
            return cachedData;
        }
        const computedData = await computeFn();
        await this.set(type, identifier, computedData, customTTL);
        return computedData;
    }
    async batchGet(type, identifiers) {
        const results = new Map();
        const pipeline = redis_1.redisClient.getClient().multi();
        const keys = identifiers.map(id => this.generateKey(type, id));
        keys.forEach(key => pipeline.get(key));
        try {
            const responses = await pipeline.exec();
            identifiers.forEach((identifier, index) => {
                const response = responses?.[index];
                if (response && Array.isArray(response) && response[1]) {
                    try {
                        const parsedData = JSON.parse(response[1]);
                        results.set(identifier, parsedData);
                        this.stats.hits++;
                    }
                    catch (error) {
                        logger_1.logger.error(`Failed to parse cached data for ${identifier}`, error);
                        results.set(identifier, null);
                        this.stats.misses++;
                    }
                }
                else {
                    results.set(identifier, null);
                    this.stats.misses++;
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to batch get from cache', error);
            identifiers.forEach(id => results.set(id, null));
            this.stats.misses += identifiers.length;
        }
        return results;
    }
    async batchSet(type, items, customTTL) {
        const config = this.cacheConfigs.get(type);
        if (!config) {
            throw new Error(`Unknown cache type: ${type}`);
        }
        const ttl = customTTL || config.ttl;
        const pipeline = redis_1.redisClient.getClient().multi();
        for (const [identifier, data] of items) {
            const key = this.generateKey(type, identifier);
            const serializedData = JSON.stringify(data);
            pipeline.setEx(key, ttl, serializedData);
        }
        try {
            await pipeline.exec();
            logger_1.logger.debug(`Batch cache set: ${items.size} items of type ${type}`);
        }
        catch (error) {
            logger_1.logger.error(`Failed to batch set cache for type ${type}`, error);
        }
    }
    async invalidateByPattern(pattern) {
        try {
            const client = redis_1.redisClient.getClient();
            const keys = await client.keys(pattern);
            if (keys.length === 0) {
                return 0;
            }
            const deletedCount = await client.del(keys);
            logger_1.logger.info(`Cache invalidated: ${deletedCount} keys matching pattern ${pattern}`);
            return deletedCount;
        }
        catch (error) {
            logger_1.logger.error(`Failed to invalidate cache by pattern ${pattern}`, error);
            return 0;
        }
    }
    async invalidateType(type) {
        const config = this.cacheConfigs.get(type);
        if (!config) {
            throw new Error(`Unknown cache type: ${type}`);
        }
        return await this.invalidateByPattern(`${config.prefix}*`);
    }
    async getStats() {
        try {
            const client = redis_1.redisClient.getClient();
            const info = await client.info('keyspace');
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get cache stats', error);
            return {
                hits: this.stats.hits,
                misses: this.stats.misses,
                hitRate: 0,
                totalKeys: 0
            };
        }
    }
    resetStats() {
        this.stats.hits = 0;
        this.stats.misses = 0;
    }
    async warmUpCache() {
        try {
            logger_1.logger.info('Starting cache warm-up process');
            logger_1.logger.info('Cache warm-up completed');
        }
        catch (error) {
            logger_1.logger.error('Cache warm-up failed', error);
        }
    }
    async healthCheck() {
        try {
            const testKey = 'health:check';
            const testValue = 'ok';
            await redis_1.redisClient.set(testKey, testValue);
            const retrieved = await redis_1.redisClient.get(testKey);
            await redis_1.redisClient.del(testKey);
            const healthy = retrieved === testValue;
            const stats = await this.getStats();
            return {
                healthy,
                details: {
                    redisConnected: redis_1.redisClient.isClientConnected(),
                    cacheStats: stats,
                    configuredTypes: Array.from(this.cacheConfigs.keys())
                }
            };
        }
        catch (error) {
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    redisConnected: redis_1.redisClient.isClientConnected()
                }
            };
        }
    }
}
exports.CachingService = CachingService;
exports.cachingService = new CachingService();
//# sourceMappingURL=cachingService.js.map