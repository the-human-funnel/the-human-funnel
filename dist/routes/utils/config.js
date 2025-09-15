"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const config = {
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    database: {
        mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/job-filtering-funnel',
        dbName: process.env.MONGODB_DB_NAME || 'job_filtering_funnel',
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
    },
    aiProviders: {
        gemini: {
            apiKey: process.env.GEMINI_API_KEY || '',
        },
        openai: {
            apiKey: process.env.OPENAI_API_KEY || '',
        },
        claude: {
            apiKey: process.env.CLAUDE_API_KEY || '',
        },
    },
    linkedIn: {
        scraperApiKey: process.env.LINKEDIN_SCRAPER_API_KEY || '',
        baseUrl: process.env.LINKEDIN_SCRAPER_BASE_URL || 'https://api.linkedin-scraper.com',
    },
    github: {
        token: process.env.GITHUB_TOKEN || '',
    },
    vapi: {
        apiKey: process.env.VAPI_API_KEY || '',
        baseUrl: process.env.VAPI_BASE_URL || 'https://api.vapi.ai',
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
        jwtExpiration: process.env.JWT_EXPIRATION || '24h',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    },
    security: {
        apiRateLimit: parseInt(process.env.API_RATE_LIMIT || '100', 10),
        corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
        trustProxy: process.env.TRUST_PROXY === 'true',
    },
    processing: {
        maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '100', 10),
        maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
        processingTimeout: parseInt(process.env.PROCESSING_TIMEOUT || '300000', 10),
    },
};
exports.config = config;
exports.default = config;
