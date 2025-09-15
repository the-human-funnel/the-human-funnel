"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
const redis_1 = require("redis");
const config_1 = require("./config");
const logger_1 = require("./logger");
class RedisConnectionManager {
    constructor() {
        this.client = null;
        this.isConnected = false;
    }
    async connect() {
        try {
            this.client = (0, redis_1.createClient)({
                socket: {
                    host: config_1.config.redis.host,
                    port: config_1.config.redis.port,
                    keepAlive: true,
                    connectTimeout: 10000
                },
                ...(config_1.config.redis.password && { password: config_1.config.redis.password })
            });
            this.setupEventListeners(this.client);
            await this.client.connect();
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
        const result = await client.get(key);
        return typeof result === 'string' ? result : null;
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
        const result = await client.lPop(key);
        return typeof result === 'string' ? result : null;
    }
    async rpop(key) {
        const client = this.getClient();
        const result = await client.rPop(key);
        return typeof result === 'string' ? result : null;
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
const redisClient = new RedisConnectionManager();
exports.redisClient = redisClient;
exports.default = redisClient;
//# sourceMappingURL=redis.js.map