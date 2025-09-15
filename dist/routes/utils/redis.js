"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const redis_1 = __importDefault(require("redis"));
const config_1 = require("./config");
const logger_1 = require("./logger");
class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.connectionPool = [];
        this.activeConnections = 0;
        this.poolConfig = {
            maxConnections: 10,
            minConnections: 2,
            acquireTimeoutMillis: 30000,
            idleTimeoutMillis: 300000 // 5 minutes
        };
    }
    async connect() {
        try {
            // Create main client
            this.client = redis_1.default.createClient({
                socket: {
                    host: config_1.config.redis.host,
                    port: config_1.config.redis.port,
                    keepAlive: true,
                    connectTimeout: 10000,
                    lazyConnect: true
                },
                ...(config_1.config.redis.password && { password: config_1.config.redis.password }),
                // Connection pooling configuration
                isolationPoolOptions: {
                    min: this.poolConfig.minConnections,
                    max: this.poolConfig.maxConnections,
                    acquireTimeoutMillis: this.poolConfig.acquireTimeoutMillis,
                    idleTimeoutMillis: this.poolConfig.idleTimeoutMillis
                }
            });
            this.setupEventListeners(this.client);
            await this.client.connect();
            // Initialize connection pool
            await this.initializeConnectionPool();
        }
        catch (error) {
            logger_1.logger.error('Failed to connect to Redis:', error);
            throw error;
        }
    }
    setupEventListeners(client) {
        client.on('error', (err) => {
            logger_1.logger.error('Redis Client Error:', err);
            this.isConnected = false;
        });
        client.on('connect', () => {
            logger_1.logger.info('Redis Client Connected');
            this.isConnected = true;
        });
        client.on('ready', () => {
            logger_1.logger.info('Redis Client Ready');
        });
        client.on('end', () => {
            logger_1.logger.info('Redis Client Disconnected');
            this.isConnected = false;
        });
        client.on('reconnecting', () => {
            logger_1.logger.info('Redis Client Reconnecting');
        });
    }
    async initializeConnectionPool() {
        try {
            // Create minimum number of connections
            for (let i = 0; i < this.poolConfig.minConnections; i++) {
                const poolClient = redis_1.default.createClient({
                    socket: {
                        host: config_1.config.redis.host,
                        port: config_1.config.redis.port,
                        keepAlive: true
                    },
                    ...(config_1.config.redis.password && { password: config_1.config.redis.password })
                });
                await poolClient.connect();
                this.connectionPool.push(poolClient);
            }
            logger_1.logger.info(`Redis connection pool initialized with ${this.connectionPool.length} connections`);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Redis connection pool:', error);
            throw error;
        }
    }
    async getPooledConnection() {
        // If we have available connections in pool, use them
        if (this.connectionPool.length > 0) {
            const connection = this.connectionPool.pop();
            this.activeConnections++;
            return connection;
        }
        // If we can create more connections, create one
        if (this.activeConnections < this.poolConfig.maxConnections) {
            const poolClient = redis_1.default.createClient({
                socket: {
                    host: config_1.config.redis.host,
                    port: config_1.config.redis.port,
                    keepAlive: true
                },
                ...(config_1.config.redis.password && { password: config_1.config.redis.password })
            });
            await poolClient.connect();
            this.activeConnections++;
            return poolClient;
        }
        // Wait for a connection to become available
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for Redis connection'));
            }, this.poolConfig.acquireTimeoutMillis);
            const checkForConnection = () => {
                if (this.connectionPool.length > 0) {
                    clearTimeout(timeout);
                    const connection = this.connectionPool.pop();
                    this.activeConnections++;
                    resolve(connection);
                }
                else {
                    setTimeout(checkForConnection, 100);
                }
            };
            checkForConnection();
        });
    }
    releasePooledConnection(connection) {
        this.activeConnections--;
        // Return connection to pool if we're under max pool size
        if (this.connectionPool.length < this.poolConfig.maxConnections) {
            this.connectionPool.push(connection);
        }
        else {
            // Close excess connections
            connection.disconnect().catch(err => logger_1.logger.error('Error closing excess Redis connection:', err));
        }
    }
    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
            this.isConnected = false;
        }
    }
    getClient() {
        if (!this.client || !this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        return this.client;
    }
    isClientConnected() {
        return this.isConnected;
    }
    async healthCheck() {
        try {
            if (!this.client || !this.isConnected) {
                return false;
            }
            await this.client.ping();
            return true;
        }
        catch (error) {
            logger_1.logger.error('Redis health check failed:', error);
            return false;
        }
    }
    async ping() {
        if (!this.client || !this.isConnected) {
            throw new Error('Redis client is not connected');
        }
        return await this.client.ping();
    }
    async reconnect() {
        try {
            if (this.client && this.isConnected) {
                await this.disconnect();
            }
            await this.connect();
        }
        catch (error) {
            logger_1.logger.error('Failed to reconnect to Redis:', error);
            throw error;
        }
    }
    async set(key, value, ttl) {
        const client = this.getClient();
        if (ttl) {
            await client.setEx(key, ttl, value);
        }
        else {
            await client.set(key, value);
        }
    }
    async get(key) {
        const client = this.getClient();
        return await client.get(key);
    }
    async setex(key, ttl, value) {
        const client = this.getClient();
        await client.setEx(key, ttl, value);
    }
    async del(key) {
        const client = this.getClient();
        return await client.del(key);
    }
    async exists(key) {
        const client = this.getClient();
        return await client.exists(key);
    }
    async lpush(key, value) {
        const client = this.getClient();
        return await client.lPush(key, value);
    }
    async rpush(key, value) {
        const client = this.getClient();
        return await client.rPush(key, value);
    }
    async lpop(key) {
        const client = this.getClient();
        return await client.lPop(key);
    }
    async rpop(key) {
        const client = this.getClient();
        return await client.rPop(key);
    }
    async lrange(key, start, stop) {
        const client = this.getClient();
        return await client.lRange(key, start, stop);
    }
    async llen(key) {
        const client = this.getClient();
        return await client.lLen(key);
    }
    async incr(key) {
        const client = this.getClient();
        return await client.incr(key);
    }
    async decr(key) {
        const client = this.getClient();
        return await client.decr(key);
    }
    async expire(key, seconds) {
        const client = this.getClient();
        const result = await client.expire(key, seconds);
        return result === 1;
    }
}
// Create singleton instance
const redisClient = new RedisClient();
exports.redisClient = redisClient;
exports.default = redisClient;
