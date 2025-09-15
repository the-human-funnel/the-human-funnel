export interface CacheConfig {
    ttl: number;
    prefix: string;
}
export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalKeys: number;
}
export declare class CachingService {
    private readonly defaultTTL;
    private readonly cacheConfigs;
    private stats;
    constructor();
    private initializeCacheConfigs;
    private generateKey;
    set<T>(type: string, identifier: string, data: T, customTTL?: number): Promise<void>;
    get<T>(type: string, identifier: string): Promise<T | null>;
    delete(type: string, identifier: string): Promise<void>;
    exists(type: string, identifier: string): Promise<boolean>;
    getOrSet<T>(type: string, identifier: string, computeFn: () => Promise<T>, customTTL?: number): Promise<T>;
    batchGet<T>(type: string, identifiers: string[]): Promise<Map<string, T | null>>;
    batchSet<T>(type: string, items: Map<string, T>, customTTL?: number): Promise<void>;
    invalidateByPattern(pattern: string): Promise<number>;
    invalidateType(type: string): Promise<number>;
    getStats(): Promise<CacheStats>;
    resetStats(): void;
    warmUpCache(): Promise<void>;
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
}
export declare const cachingService: CachingService;
//# sourceMappingURL=cachingService.d.ts.map