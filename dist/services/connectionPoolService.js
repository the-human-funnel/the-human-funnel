"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionPoolService = exports.ConnectionPoolService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const cachingService_1 = require("./cachingService");
class ConnectionPoolService {
    constructor() {
        this.pools = new Map();
        this.rateLimiters = new Map();
        this.stats = new Map();
        this.requestTimings = new WeakMap();
        this.defaultConfig = {
            maxConnections: 10,
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            keepAlive: true,
            maxIdleTime: 60000
        };
    }
    initializePool(endpoint, config) {
        const poolConfig = { ...this.defaultConfig, ...config };
        const axiosInstance = axios_1.default.create({
            baseURL: endpoint.baseURL,
            timeout: poolConfig.timeout,
            headers: {
                'Connection': poolConfig.keepAlive ? 'keep-alive' : 'close',
                'Keep-Alive': `timeout=${Math.floor(poolConfig.maxIdleTime / 1000)}`,
                ...endpoint.headers
            },
            httpAgent: this.createHttpAgent(poolConfig),
            httpsAgent: this.createHttpsAgent(poolConfig)
        });
        axiosInstance.interceptors.request.use(async (config) => {
            if (endpoint.rateLimit) {
                await this.checkRateLimit(endpoint.name, endpoint.rateLimit);
            }
            this.requestTimings.set(config, Date.now());
            return config;
        }, (error) => Promise.reject(error));
        axiosInstance.interceptors.response.use((response) => {
            this.updateStats(endpoint.name, response, true);
            return response;
        }, (error) => {
            this.updateStats(endpoint.name, error.response, false);
            return Promise.reject(error);
        });
        this.pools.set(endpoint.name, axiosInstance);
        if (endpoint.rateLimit) {
            this.rateLimiters.set(endpoint.name, {
                requests: [],
                limit: endpoint.rateLimit.requests,
                windowMs: endpoint.rateLimit.windowMs
            });
        }
        this.stats.set(endpoint.name, {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastRequestTime: null
        });
        logger_1.logger.info(`Connection pool initialized for ${endpoint.name}`, {
            service: 'connectionPool',
            endpoint: endpoint.name,
            baseURL: endpoint.baseURL,
            maxConnections: poolConfig.maxConnections,
            timeout: poolConfig.timeout
        });
    }
    createHttpAgent(config) {
        const http = require('http');
        return new http.Agent({
            keepAlive: config.keepAlive,
            maxSockets: config.maxConnections,
            maxFreeSockets: Math.floor(config.maxConnections / 2),
            timeout: config.maxIdleTime,
            freeSocketTimeout: config.maxIdleTime
        });
    }
    createHttpsAgent(config) {
        const https = require('https');
        return new https.Agent({
            keepAlive: config.keepAlive,
            maxSockets: config.maxConnections,
            maxFreeSockets: Math.floor(config.maxConnections / 2),
            timeout: config.maxIdleTime,
            freeSocketTimeout: config.maxIdleTime
        });
    }
    async request(endpointName, config, cacheOptions) {
        const pool = this.pools.get(endpointName);
        if (!pool) {
            throw new Error(`Connection pool not found for endpoint: ${endpointName}`);
        }
        let cacheKey = null;
        if (cacheOptions?.enabled) {
            cacheKey = cacheOptions.key || this.generateCacheKey(endpointName, config);
            const cachedResponse = await cachingService_1.cachingService.get('externalApi', cacheKey);
            if (cachedResponse) {
                logger_1.logger.debug(`Cache hit for API request: ${cacheKey}`);
                return cachedResponse;
            }
        }
        try {
            const response = await this.executeWithRetry(pool, config);
            if (cacheOptions?.enabled && cacheKey && response.status >= 200 && response.status < 300) {
                await cachingService_1.cachingService.set('externalApi', cacheKey, response, cacheOptions.ttl);
            }
            return response;
        }
        catch (error) {
            logger_1.logger.error(`API request failed for ${endpointName}`, {
                service: 'connectionPool',
                endpoint: endpointName,
                url: config.url,
                method: config.method,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async executeWithRetry(pool, config, attempt = 1) {
        try {
            return await pool.request(config);
        }
        catch (error) {
            if (attempt < this.defaultConfig.retryAttempts && this.shouldRetry(error)) {
                const delay = this.defaultConfig.retryDelay * Math.pow(2, attempt - 1);
                logger_1.logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${this.defaultConfig.retryAttempts})`, {
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
    shouldRetry(error) {
        if (!error.response) {
            return true;
        }
        const status = error.response.status;
        return status >= 500 || status === 429;
    }
    async checkRateLimit(endpointName, rateLimit) {
        const limiter = this.rateLimiters.get(endpointName);
        if (!limiter) {
            return;
        }
        const now = Date.now();
        const windowStart = now - rateLimit.windowMs;
        limiter.requests = limiter.requests.filter(time => time > windowStart);
        if (limiter.requests.length >= rateLimit.requests) {
            const oldestRequest = Math.min(...limiter.requests);
            const waitTime = oldestRequest + rateLimit.windowMs - now;
            if (waitTime > 0) {
                logger_1.logger.warn(`Rate limit reached for ${endpointName}, waiting ${waitTime}ms`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        limiter.requests.push(now);
    }
    updateStats(endpointName, response, success) {
        const stats = this.stats.get(endpointName);
        if (!stats) {
            return;
        }
        stats.totalRequests++;
        stats.lastRequestTime = new Date();
        if (success) {
            stats.successfulRequests++;
        }
        else {
            stats.failedRequests++;
        }
        if (response?.config) {
            const startTime = this.requestTimings.get(response.config);
            if (startTime) {
                const responseTime = Date.now() - startTime;
                stats.averageResponseTime = (stats.averageResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
                this.requestTimings.delete(response.config);
            }
        }
    }
    generateCacheKey(endpointName, config) {
        const keyParts = [
            endpointName,
            config.method || 'GET',
            config.url || '',
            JSON.stringify(config.params || {}),
            JSON.stringify(config.data || {})
        ];
        return Buffer.from(keyParts.join('|')).toString('base64');
    }
    getStats(endpointName) {
        if (endpointName) {
            return this.stats.get(endpointName) || null;
        }
        return new Map(this.stats);
    }
    getPoolNames() {
        return Array.from(this.pools.keys());
    }
    async healthCheck() {
        const poolHealth = {};
        let overallHealthy = true;
        for (const [name, pool] of this.pools) {
            try {
                const response = await pool.head('/', { timeout: 5000 });
                poolHealth[name] = {
                    healthy: response.status < 400,
                    status: response.status,
                    stats: this.stats.get(name)
                };
            }
            catch (error) {
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
    resetStats(endpointName) {
        if (endpointName) {
            const stats = this.stats.get(endpointName);
            if (stats) {
                stats.totalRequests = 0;
                stats.successfulRequests = 0;
                stats.failedRequests = 0;
                stats.averageResponseTime = 0;
                stats.lastRequestTime = null;
            }
        }
        else {
            for (const stats of this.stats.values()) {
                stats.totalRequests = 0;
                stats.successfulRequests = 0;
                stats.failedRequests = 0;
                stats.averageResponseTime = 0;
                stats.lastRequestTime = null;
            }
        }
    }
    async cleanup() {
        logger_1.logger.info('Cleaning up connection pools');
        for (const [name, pool] of this.pools) {
            try {
                logger_1.logger.info(`Cleaned up connection pool: ${name}`);
            }
            catch (error) {
                logger_1.logger.error(`Error cleaning up pool ${name}:`, error);
            }
        }
        this.pools.clear();
        this.rateLimiters.clear();
        this.stats.clear();
    }
}
exports.ConnectionPoolService = ConnectionPoolService;
exports.connectionPoolService = new ConnectionPoolService();
//# sourceMappingURL=connectionPoolService.js.map