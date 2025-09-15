import mongoose from 'mongoose';
interface DatabaseHealthCheck {
    connected: boolean;
    status: 'healthy' | 'unhealthy';
    details: {
        message?: string;
        error?: string;
        readyState?: string;
        host?: string;
        port?: number;
        name?: string;
    };
}
interface PerformanceStats {
    collections: number;
    dataSize: number;
    indexSize: number;
    storageSize: number;
    connections: any;
    opcounters: any;
    mem: any;
}
interface SlowQueryAnalysis {
    timestamp: Date;
    duration: number;
    command: any;
    collection: string;
    planSummary?: string;
}
export declare class DatabaseConnection {
    private static instance;
    private isConnected;
    private constructor();
    static getInstance(): DatabaseConnection;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isDbConnected(): boolean;
    private isDatabaseConnected;
    private ensureDatabaseConnection;
    getConnectionStatus(): string;
    private setupEventListeners;
    healthCheck(): Promise<DatabaseHealthCheck>;
    reconnect(): Promise<void>;
    createIndexes(): Promise<void>;
    optimizeConnection(): Promise<void>;
    getPerformanceStats(): Promise<PerformanceStats | null>;
    analyzeSlowQueries(): Promise<SlowQueryAnalysis[]>;
}
export declare class DatabaseError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code?: string, statusCode?: number);
}
export declare function handleMongoError(error: unknown): DatabaseError;
export declare function withTransaction<T>(operation: (session: mongoose.ClientSession) => Promise<T>): Promise<T>;
export declare const database: DatabaseConnection;
export {};
//# sourceMappingURL=database.d.ts.map