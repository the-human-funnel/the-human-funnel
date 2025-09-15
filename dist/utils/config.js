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
const dotenv = __importStar(require("dotenv"));
dotenv.config();
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
//# sourceMappingURL=config.js.map