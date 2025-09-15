import type { RedisClientType } from 'redis';
declare class RedisConnectionManager {
    private client;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    private setupEventListeners;
    disconnect(): Promise<void>;
    getClient(): RedisClientType;
    isClientConnected(): boolean;
    healthCheck(): Promise<boolean>;
    ping(): Promise<string>;
    reconnect(): Promise<void>;
    set(key: string, value: string, ttl?: number): Promise<void>;
    get(key: string): Promise<string | null>;
    setex(key: string, ttl: number, value: string): Promise<void>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    lpush(key: string, value: string): Promise<number>;
    rpush(key: string, value: string): Promise<number>;
    lpop(key: string): Promise<string | null>;
    rpop(key: string): Promise<string | null>;
    lrange(key: string, start: number, stop: number): Promise<string[]>;
    llen(key: string): Promise<number>;
    incr(key: string): Promise<number>;
    decr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<boolean>;
}
declare const redisClient: RedisConnectionManager;
export { redisClient };
export default redisClient;
//# sourceMappingURL=redis.d.ts.map