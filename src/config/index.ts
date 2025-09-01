import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
  // AI Provider Configuration
  geminiApiKey: string;
  openaiApiKey: string;
  claudeApiKey: string;
  
  // LinkedIn Scraper Configuration
  linkedinScraperApiKey: string;
  linkedinScraperBaseUrl: string;
  
  // GitHub API Configuration
  githubToken: string;
  
  // VAPI Configuration
  vapiApiKey: string;
  vapiBaseUrl: string;
  
  // Authentication Configuration
  jwtSecret: string;
  defaultAdminUsername: string;
  defaultAdminPassword: string;
  
  // Database passwords
  mongodbPassword?: string;
  redisPassword?: string;
}

class ConfigManager {
  private appConfig: AppConfig;
  private secretsConfig: SecretsConfig;
  private environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.appConfig = this.loadAppConfig();
    this.secretsConfig = this.loadSecretsConfig();
  }

  private loadAppConfig(): AppConfig {
    const configPath = path.join(__dirname, '../../config', `${this.environment}.json`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData) as AppConfig;
      
      // Override with environment variables if present
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
    } catch (error) {
      throw new Error(`Failed to parse configuration file: ${error}`);
    }
  }

  private loadSecretsConfig(): SecretsConfig {
    const requiredSecrets = [
      'GEMINI_API_KEY',
      'OPENAI_API_KEY', 
      'CLAUDE_API_KEY',
      'LINKEDIN_SCRAPER_API_KEY',
      'GITHUB_TOKEN',
      'VAPI_API_KEY',
      'JWT_SECRET'
    ];

    // Check for required secrets in production
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

  public getAppConfig(): AppConfig {
    return this.appConfig;
  }

  public getSecretsConfig(): SecretsConfig {
    return this.secretsConfig;
  }

  public getEnvironment(): string {
    return this.environment;
  }

  public isDevelopment(): boolean {
    return this.environment === 'development';
  }

  public isProduction(): boolean {
    return this.environment === 'production';
  }

  public isTest(): boolean {
    return this.environment === 'test';
  }
}

// Export singleton instance
export const config = new ConfigManager();
export default config;