export interface AppConfig {
    server: {
        port: number;
        host: string;
        cors: {
            origins: string[];
            credentials: boolean;
        };
    };
    database: {
        mongodb: {
            uri: string;
            options: Record<string, any>;
        };
        redis: {
            host: string;
            port: number;
            db: number;
            maxRetriesPerRequest: number | null;
            [key: string]: any;
        };
    };
    processing: {
        maxBatchSize: number;
        maxRetries: number;
        timeoutMs: number;
        concurrency: number;
    };
    security: {
        rateLimit: {
            windowMs: number;
            max: number;
        };
        jwt: {
            expiresIn: string;
        };
        bcrypt: {
            rounds: number;
        };
    };
    logging: {
        level: string;
        format: string;
    };
}
export interface SecretsConfig {
    geminiApiKey: string;
    openaiApiKey: string;
    claudeApiKey: string;
    linkedinScraperApiKey: string;
    linkedinScraperBaseUrl: string;
    githubToken: string;
    vapiApiKey: string;
    vapiBaseUrl: string;
    jwtSecret: string;
    defaultAdminUsername: string;
    defaultAdminPassword: string;
    mongodbPassword?: string;
    redisPassword?: string;
}
declare class ConfigManager {
    private appConfig;
    private secretsConfig;
    private environment;
    constructor();
    private loadAppConfig;
    private loadSecretsConfig;
    getAppConfig(): AppConfig;
    getSecretsConfig(): SecretsConfig;
    getEnvironment(): string;
    isDevelopment(): boolean;
    isProduction(): boolean;
    isTest(): boolean;
}
export declare const config: ConfigManager;
export default config;
//# sourceMappingURL=index.d.ts.map