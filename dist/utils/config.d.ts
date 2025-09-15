export interface Config {
    server: {
        port: number;
        nodeEnv: string;
    };
    database: {
        mongoUri: string;
        dbName: string;
    };
    redis: {
        host: string;
        port: number;
        password?: string | undefined;
    };
    aiProviders: {
        gemini: {
            apiKey: string;
        };
        openai: {
            apiKey: string;
        };
        claude: {
            apiKey: string;
        };
    };
    linkedIn: {
        scraperApiKey: string;
        baseUrl: string;
    };
    github: {
        token: string;
    };
    vapi: {
        apiKey: string;
        baseUrl: string;
    };
    auth: {
        jwtSecret: string;
        jwtExpiration: string;
        bcryptRounds: number;
    };
    security: {
        apiRateLimit: number;
        corsOrigins: string[];
        trustProxy: boolean;
    };
    processing: {
        maxBatchSize: number;
        maxRetries: number;
        processingTimeout: number;
    };
}
declare const config: Config;
export { config };
export default config;
//# sourceMappingURL=config.d.ts.map