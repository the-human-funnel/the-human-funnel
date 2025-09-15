"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
class ConfigManager {
    constructor() {
        this.environment = process.env.NODE_ENV || 'development';
        this.appConfig = this.loadAppConfig();
        this.secretsConfig = this.loadSecretsConfig();
    }
    loadAppConfig() {
        const configPath = path.join(__dirname, '../../config', `${this.environment}.json`);
        if (!fs.existsSync(configPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(configData);
            if (process.env.PORT) {
                config.server.port = parseInt(process.env.PORT, 10);
            }
            if (process.env.MONGODB_URI) {
                config.database.mongodb.uri = process.env.MONGODB_URI;
            }
            if (process.env.REDIS_HOST) {
                config.database.redis.host = process.env.REDIS_HOST;
            }
            if (process.env.REDIS_PORT) {
                config.database.redis.port = parseInt(process.env.REDIS_PORT, 10);
            }
            return config;
        }
        catch (error) {
            throw new Error(`Failed to parse configuration file: ${error}`);
        }
    }
    loadSecretsConfig() {
        const requiredSecrets = [
            'GEMINI_API_KEY',
            'OPENAI_API_KEY',
            'CLAUDE_API_KEY',
            'LINKEDIN_SCRAPER_API_KEY',
            'GITHUB_TOKEN',
            'VAPI_API_KEY',
            'JWT_SECRET'
        ];
        if (this.environment === 'production') {
            const missingSecrets = requiredSecrets.filter(secret => !process.env[secret]);
            if (missingSecrets.length > 0) {
                throw new Error(`Missing required environment variables: ${missingSecrets.join(', ')}`);
            }
        }
        return {
            geminiApiKey: process.env.GEMINI_API_KEY || '',
            openaiApiKey: process.env.OPENAI_API_KEY || '',
            claudeApiKey: process.env.CLAUDE_API_KEY || '',
            linkedinScraperApiKey: process.env.LINKEDIN_SCRAPER_API_KEY || '',
            linkedinScraperBaseUrl: process.env.LINKEDIN_SCRAPER_BASE_URL || 'https://api.linkedin-scraper.com',
            githubToken: process.env.GITHUB_TOKEN || '',
            vapiApiKey: process.env.VAPI_API_KEY || '',
            vapiBaseUrl: process.env.VAPI_BASE_URL || 'https://api.vapi.ai',
            jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
            defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
            defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123',
            mongodbPassword: process.env.MONGODB_PASSWORD,
            redisPassword: process.env.REDIS_PASSWORD
        };
    }
    getAppConfig() {
        return this.appConfig;
    }
    getSecretsConfig() {
        return this.secretsConfig;
    }
    getEnvironment() {
        return this.environment;
    }
    isDevelopment() {
        return this.environment === 'development';
    }
    isProduction() {
        return this.environment === 'production';
    }
    isTest() {
        return this.environment === 'test';
    }
}
exports.config = new ConfigManager();
exports.default = exports.config;
//# sourceMappingURL=index.js.map