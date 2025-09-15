export declare class SecretsManager {
    private encryptionKey;
    private algorithm;
    constructor();
    private encrypt;
    private decrypt;
    getApiCredentials(): {
        gemini: {
            apiKey: string;
            isConfigured: boolean;
        };
        openai: {
            apiKey: string;
            isConfigured: boolean;
        };
        claude: {
            apiKey: string;
            isConfigured: boolean;
        };
        linkedin: {
            apiKey: string;
            baseUrl: string;
            isConfigured: boolean;
        };
        github: {
            token: string;
            isConfigured: boolean;
        };
        vapi: {
            apiKey: string;
            baseUrl: string;
            isConfigured: boolean;
        };
    };
    private validateAndGetSecret;
    getDatabaseCredentials(): {
        mongodb: {
            uri: string;
            options: Record<string, any>;
        };
        redis: {
            password: string | undefined;
            host: string;
            port: number;
            db: number;
            maxRetriesPerRequest: number | null;
        };
    };
    private buildMongoUri;
    getAuthSecrets(): {
        jwtSecret: string;
        defaultAdmin: {
            username: string;
            password: string;
        };
    };
    validateCredentials(): {
        isValid: boolean;
        missingCredentials: string[];
    };
    rotateApiKeys(): Promise<void>;
}
export declare const secretsManager: SecretsManager;
export default secretsManager;
//# sourceMappingURL=secrets.d.ts.map