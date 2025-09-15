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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretsManager = exports.SecretsManager = void 0;
const crypto = __importStar(require("crypto"));
const index_1 = __importDefault(require("./index"));
class SecretsManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        const jwtSecret = index_1.default.getSecretsConfig().jwtSecret;
        this.encryptionKey = crypto.scryptSync(jwtSecret, 'salt', 32);
    }
    encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    decrypt(encryptedData) {
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
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    getApiCredentials() {
        const secrets = index_1.default.getSecretsConfig();
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
    validateAndGetSecret(secret, name) {
        if (!secret) {
            if (index_1.default.isProduction()) {
                throw new Error(`${name} is required in production environment`);
            }
            console.warn(`Warning: ${name} not configured. Some features may not work.`);
            return '';
        }
        if (secret.length < 10) {
            throw new Error(`${name} appears to be invalid (too short)`);
        }
        return secret;
    }
    getDatabaseCredentials() {
        const secrets = index_1.default.getSecretsConfig();
        const appConfig = index_1.default.getAppConfig();
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
    buildMongoUri(baseUri, password) {
        if (!password) {
            return baseUri;
        }
        if (baseUri.includes('@')) {
            return baseUri;
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
    getAuthSecrets() {
        const secrets = index_1.default.getSecretsConfig();
        return {
            jwtSecret: secrets.jwtSecret,
            defaultAdmin: {
                username: secrets.defaultAdminUsername,
                password: secrets.defaultAdminPassword
            }
        };
    }
    validateCredentials() {
        const secrets = index_1.default.getSecretsConfig();
        const missingCredentials = [];
        const requiredCredentials = [
            { key: secrets.jwtSecret, name: 'JWT_SECRET' }
        ];
        if (index_1.default.isProduction()) {
            requiredCredentials.push({ key: secrets.geminiApiKey, name: 'GEMINI_API_KEY' }, { key: secrets.openaiApiKey, name: 'OPENAI_API_KEY' }, { key: secrets.claudeApiKey, name: 'CLAUDE_API_KEY' }, { key: secrets.linkedinScraperApiKey, name: 'LINKEDIN_SCRAPER_API_KEY' }, { key: secrets.githubToken, name: 'GITHUB_TOKEN' }, { key: secrets.vapiApiKey, name: 'VAPI_API_KEY' });
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
    async rotateApiKeys() {
        console.log('API key rotation not yet implemented');
    }
}
exports.SecretsManager = SecretsManager;
exports.secretsManager = new SecretsManager();
exports.default = exports.secretsManager;
//# sourceMappingURL=secrets.js.map