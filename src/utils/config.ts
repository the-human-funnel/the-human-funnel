import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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

const config: Config = {
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

export { config };
export default config;