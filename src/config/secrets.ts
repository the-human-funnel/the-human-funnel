import * as crypto from 'crypto';
import config from './index';

/**
 * Secure credential management for external APIs
 * Provides encrypted storage and retrieval of sensitive credentials
 */
export class SecretsManager {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';

  constructor() {
    // Generate encryption key from JWT secret for consistency
    const jwtSecret = config.getSecretsConfig().jwtSecret;
    this.encryptionKey = crypto.scryptSync(jwtSecret, 'salt', 32);
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    if (!parts[0] || !parts[1] || !parts[2]) {
      throw new Error('Invalid encrypted data format - missing parts');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    (decipher as any).setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get API credentials with validation
   */
  public getApiCredentials() {
    const secrets = config.getSecretsConfig();
    
    return {
      gemini: {
        apiKey: this.validateAndGetSecret(secrets.geminiApiKey, 'Gemini API Key'),
        isConfigured: !!secrets.geminiApiKey
      },
      openai: {
        apiKey: this.validateAndGetSecret(secrets.openaiApiKey, 'OpenAI API Key'),
        isConfigured: !!secrets.openaiApiKey
      },
      claude: {
        apiKey: this.validateAndGetSecret(secrets.claudeApiKey, 'Claude API Key'),
        isConfigured: !!secrets.claudeApiKey
      },
      linkedin: {
        apiKey: this.validateAndGetSecret(secrets.linkedinScraperApiKey, 'LinkedIn Scraper API Key'),
        baseUrl: secrets.linkedinScraperBaseUrl,
        isConfigured: !!secrets.linkedinScraperApiKey
      },
      github: {
        token: this.validateAndGetSecret(secrets.githubToken, 'GitHub Token'),
        isConfigured: !!secrets.githubToken
      },
      vapi: {
        apiKey: this.validateAndGetSecret(secrets.vapiApiKey, 'VAPI API Key'),
        baseUrl: secrets.vapiBaseUrl,
        isConfigured: !!secrets.vapiApiKey
      }
    };
  }

  /**
   * Validate and return secret, with appropriate handling for missing values
   */
  private validateAndGetSecret(secret: string, name: string): string {
    if (!secret) {
      if (config.isProduction()) {
        throw new Error(`${name} is required in production environment`);
      }
      console.warn(`Warning: ${name} not configured. Some features may not work.`);
      return '';
    }

    // Basic validation for API key format
    if (secret.length < 10) {
      throw new Error(`${name} appears to be invalid (too short)`);
    }

    return secret;
  }

  /**
   * Get database credentials
   */
  public getDatabaseCredentials() {
    const secrets = config.getSecretsConfig();
    const appConfig = config.getAppConfig();
    
    return {
      mongodb: {
        uri: this.buildMongoUri(appConfig.database.mongodb.uri, secrets.mongodbPassword),
        options: appConfig.database.mongodb.options
      },
      redis: {
        ...appConfig.database.redis,
        password: secrets.redisPassword
      }
    };
  }

  /**
   * Build MongoDB URI with password if provided
   */
  private buildMongoUri(baseUri: string, password?: string): string {
    if (!password) {
      return baseUri;
    }

    // Insert password into URI if not already present
    if (baseUri.includes('@')) {
      return baseUri; // Password already in URI
    }

    const uriParts = baseUri.split('://');
    if (uriParts.length !== 2) {
      throw new Error('Invalid MongoDB URI format');
    }

    const [protocol, rest] = uriParts;
    if (!rest) {
      throw new Error('Invalid MongoDB URI format - missing host part');
    }
    
    const [hostPart, ...pathParts] = rest.split('/');
    
    return `${protocol}://admin:${encodeURIComponent(password)}@${hostPart}/${pathParts.join('/')}`;
  }

  /**
   * Get authentication secrets
   */
  public getAuthSecrets() {
    const secrets = config.getSecretsConfig();
    
    return {
      jwtSecret: secrets.jwtSecret,
      defaultAdmin: {
        username: secrets.defaultAdminUsername,
        password: secrets.defaultAdminPassword
      }
    };
  }

  /**
   * Validate all required credentials are present
   */
  public validateCredentials(): { isValid: boolean; missingCredentials: string[] } {
    const secrets = config.getSecretsConfig();
    const missingCredentials: string[] = [];

    const requiredCredentials = [
      { key: secrets.jwtSecret, name: 'JWT_SECRET' }
    ];

    // Only require external API keys in production
    if (config.isProduction()) {
      requiredCredentials.push(
        { key: secrets.geminiApiKey, name: 'GEMINI_API_KEY' },
        { key: secrets.openaiApiKey, name: 'OPENAI_API_KEY' },
        { key: secrets.claudeApiKey, name: 'CLAUDE_API_KEY' },
        { key: secrets.linkedinScraperApiKey, name: 'LINKEDIN_SCRAPER_API_KEY' },
        { key: secrets.githubToken, name: 'GITHUB_TOKEN' },
        { key: secrets.vapiApiKey, name: 'VAPI_API_KEY' }
      );
    }

    for (const credential of requiredCredentials) {
      if (!credential.key || credential.key.trim() === '') {
        missingCredentials.push(credential.name);
      }
    }

    return {
      isValid: missingCredentials.length === 0,
      missingCredentials
    };
  }

  /**
   * Rotate API keys (for future implementation)
   */
  public async rotateApiKeys(): Promise<void> {
    // Placeholder for API key rotation logic
    // This would integrate with external services to rotate keys
    console.log('API key rotation not yet implemented');
  }
}

// Export singleton instance
export const secretsManager = new SecretsManager();
export default secretsManager;