import Redis from 'redis';
import { config } from './config';
import { logger } from './logger';

interface RedisPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
}

class RedisClient {
  private client: Redis.RedisClientType | null = null;
  private isConnected = false;
  private connectionPool: Redis.RedisClientType[] = [];
  private poolConfig: RedisPoolConfig;
  private activeConnections = 0;

  constructor() {
    this.poolConfig = {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000 // 5 minutes
    };
  }

  async connect(): Promise<void> {
    try {
      // Create main client
      this.client = Redis.createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
          keepAlive: true,
          connectTimeout: 10000,
          lazyConnect: true
        },
        ...(config.redis.password && { password: config.redis.password }),
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
      
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private setupEventListeners(client: Redis.RedisClientType): void {
    client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    client.on('connect', () => {
      logger.info('Redis Client Connected');
      this.isConnected = true;
    });

    client.on('ready', () => {
      logger.info('Redis Client Ready');
    });

    client.on('end', () => {
      logger.info('Redis Client Disconnected');
      this.isConnected = false;
    });

    client.on('reconnecting', () => {
      logger.info('Redis Client Reconnecting');
    });
  }

  private async initializeConnectionPool(): Promise<void> {
    try {
      // Create minimum number of connections
      for (let i = 0; i < this.poolConfig.minConnections; i++) {
        const poolClient = Redis.createClient({
          socket: {
            host: config.redis.host,
            port: config.redis.port,
            keepAlive: true
          },
          ...(config.redis.password && { password: config.redis.password })
        });
        
        await poolClient.connect();
        this.connectionPool.push(poolClient);
      }
      
      logger.info(`Redis connection pool initialized with ${this.connectionPool.length} connections`);
    } catch (error) {
      logger.error('Failed to initialize Redis connection pool:', error);
      throw error;
    }
  }

  private async getPooledConnection(): Promise<Redis.RedisClientType> {
    // If we have available connections in pool, use them
    if (this.connectionPool.length > 0) {
      const connection = this.connectionPool.pop()!;
      this.activeConnections++;
      return connection;
    }
    
    // If we can create more connections, create one
    if (this.activeConnections < this.poolConfig.maxConnections) {
      const poolClient = Redis.createClient({
        socket: {
          host: config.redis.host,
          port: config.redis.port,
          keepAlive: true
        },
        ...(config.redis.password && { password: config.redis.password })
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
          const connection = this.connectionPool.pop()!;
          this.activeConnections++;
          resolve(connection);
        } else {
          setTimeout(checkForConnection, 100);
        }
      };
      
      checkForConnection();
    });
  }

  private releasePooledConnection(connection: Redis.RedisClientType): void {
    this.activeConnections--;
    
    // Return connection to pool if we're under max pool size
    if (this.connectionPool.length < this.poolConfig.maxConnections) {
      this.connectionPool.push(connection);
    } else {
      // Close excess connections
      connection.disconnect().catch(err => 
        logger.error('Error closing excess Redis connection:', err)
      );
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