import Redis from 'redis';
import { config } from './config';
import { logger } from './logger';

class RedisClient {
  private client: Redis.RedisClientType | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    try {
      this.client = Redis.createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
        },
        ...(config.redis.password && { password: config.redis.password }),
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis Client Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        logger.info('Redis Client Ready');
      });

      this.client.on('end', () => {
        logger.info('Redis Client Disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient(): Redis.RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client || !this.isConnected) {
        return false;
      }
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return false;
    }
  }

  async ping(): Promise<string> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return await this.client.ping();
  }

  async reconnect(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.disconnect();
      }
      await this.connect();
    } catch (error) {
      logger.error('Failed to reconnect to Redis:', error);
      throw error;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const client = this.getClient();
    if (ttl) {
      await client.setEx(key, ttl, value);
    } else {
      await client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    const client = this.getClient();
    return await client.get(key);
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    const client = this.getClient();
    await client.setEx(key, ttl, value);
  }

  async del(key: string): Promise<number> {
    const client = this.getClient();
    return await client.del(key);
  }

  async exists(key: string): Promise<number> {
    const client = this.getClient();
    return await client.exists(key);
  }

  async lpush(key: string, value: string): Promise<number> {
    const client = this.getClient();
    return await client.lPush(key, value);
  }

  async rpush(key: string, value: string): Promise<number> {
    const client = this.getClient();
    return await client.rPush(key, value);
  }

  async lpop(key: string): Promise<string | null> {
    const client = this.getClient();
    return await client.lPop(key);
  }

  async rpop(key: string): Promise<string | null> {
    const client = this.getClient();
    return await client.rPop(key);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const client = this.getClient();
    return await client.lRange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    const client = this.getClient();
    return await client.lLen(key);
  }

  async incr(key: string): Promise<number> {
    const client = this.getClient();
    return await client.incr(key);
  }

  async decr(key: string): Promise<number> {
    const client = this.getClient();
    return await client.decr(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    const client = this.getClient();
    const result = await client.expire(key, seconds);
    return result === 1;
  }
}

// Create singleton instance
const redisClient = new RedisClient();

export { redisClient };
export default redisClient;