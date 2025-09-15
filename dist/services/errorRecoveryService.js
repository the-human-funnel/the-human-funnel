"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorRecoveryService = void 0;
const logger_1 = require("../utils/logger");
const queues_1 = require("../queues");
const database_1 = require("../utils/database");
const redis_1 = require("../utils/redis");
class ErrorRecoveryService {
    constructor() {
        this.failurePatterns = new Map();
        this.recoveryInProgress = new Set();
        this.maxPatternHistory = 100;
        setInterval(() => this.cleanupOldPatterns(), 60 * 60 * 1000);
    }
    getPatternKey(service, operation, errorType) {
        return `${service}:${operation}:${errorType}`;
    }
    cleanupOldPatterns() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        for (const [key, pattern] of this.failurePatterns.entries()) {
            if (pattern.lastOccurrence < cutoffTime) {
                this.failurePatterns.delete(key);
            }
        }
        logger_1.logger.debug('Cleaned up old failure patterns', {
            service: 'errorRecovery',
            operation: 'cleanupOldPatterns',
            remainingPatterns: this.failurePatterns.size
        });
    }
    recordFailure(service, operation, errorType, error) {
        const patternKey = this.getPatternKey(service, operation, errorType);
        const now = new Date();
        let pattern = this.failurePatterns.get(patternKey);
        if (pattern) {
            pattern.count++;
            pattern.lastOccurrence = now;
        }
        else {
            pattern = {
                service,
                operation,
                errorType,
                count: 1,
                firstOccurrence: now,
                lastOccurrence: now,
                recoveryAction: this.determineRecoveryAction(service, operation, errorType)
            };
            this.failurePatterns.set(patternKey, pattern);
        }
        logger_1.logger.warn('Failure pattern recorded', {
            service: 'errorRecovery',
            operation: 'recordFailure',
            patternKey,
            count: pattern.count,
            recoveryAction: pattern.recoveryAction.type
        });
        if (this.shouldTriggerRecovery(pattern)) {
            this.triggerRecovery(pattern).catch(recoveryError => {
                logger_1.logger.error('Recovery trigger failed', recoveryError, {
                    service: 'errorRecovery',
                    operation: 'triggerRecovery',
                    patternKey
                });
            });
        }
    }
    determineRecoveryAction(service, operation, errorType) {
        const strategies = {
            'database:connect:ConnectionError': {
                type: 'retry',
                description: 'Retry database connection with exponential backoff',
                maxAttempts: 5,
                backoffMs: 1000
            },
            'database:query:TimeoutError': {
                type: 'retry',
                description: 'Retry database query with increased timeout',
                maxAttempts: 3,
                backoffMs: 2000
            },
            'redis:connect:ConnectionError': {
                type: 'retry',
                description: 'Retry Redis connection',
                maxAttempts: 5,
                backoffMs: 1000
            },
            'queue:process:JobError': {
                type: 'retry',
                description: 'Retry failed queue job',
                maxAttempts: 3,
                backoffMs: 5000
            },
            'queue:stalled:StalledJobError': {
                type: 'restart',
                description: 'Restart stalled queue jobs',
                maxAttempts: 1
            },
            'aiAnalysis:gemini:RateLimitError': {
                type: 'retry',
                description: 'Wait and retry with exponential backoff',
                maxAttempts: 5,
                backoffMs: 10000
            },
            'aiAnalysis:openai:RateLimitError': {
                type: 'retry',
                description: 'Switch to fallback provider or retry',
                maxAttempts: 3,
                backoffMs: 15000
            },
            'linkedInAnalysis:scraper:RateLimitError': {
                type: 'retry',
                description: 'Delay LinkedIn scraping requests',
                maxAttempts: 3,
                backoffMs: 30000
            },
            'githubAnalysis:api:RateLimitError': {
                type: 'retry',
                description: 'Wait for GitHub API rate limit reset',
                maxAttempts: 2,
                backoffMs: 60000
            },
            'vapiInterview:call:NetworkError': {
                type: 'retry',
                description: 'Retry VAPI call with different endpoint',
                maxAttempts: 3,
                backoffMs: 5000
            },
            'resumeProcessing:parse:CorruptFileError': {
                type: 'skip',
                description: 'Skip corrupted file and continue processing'
            },
            'resumeProcessing:extract:UnsupportedFormatError': {
                type: 'skip',
                description: 'Skip unsupported file format'
            }
        };
        const key = `${service}:${operation}:${errorType}`;
        return strategies[key] || {
            type: 'manual',
            description: 'Manual intervention required - unknown error pattern'
        };
    }
    shouldTriggerRecovery(pattern) {
        const timeSinceFirst = Date.now() - pattern.firstOccurrence.getTime();
        const timeSinceLast = Date.now() - pattern.lastOccurrence.getTime();
        const patternKey = this.getPatternKey(pattern.service, pattern.operation, pattern.errorType);
        if (this.recoveryInProgress.has(patternKey)) {
            return false;
        }
        if (pattern.recoveryAction.type === 'retry' && pattern.count >= 3) {
            return true;
        }
        if (pattern.recoveryAction.type === 'restart' && pattern.count >= 2) {
            return true;
        }
        const criticalServices = ['database', 'redis', 'queue'];
        if (criticalServices.includes(pattern.service) && pattern.count >= 2) {
            return true;
        }
        return false;
    }
    async triggerRecovery(pattern) {
        const patternKey = this.getPatternKey(pattern.service, pattern.operation, pattern.errorType);
        if (this.recoveryInProgress.has(patternKey)) {
            return {
                success: false,
                action: 'skip',
                error: 'Recovery already in progress'
            };
        }
        this.recoveryInProgress.add(patternKey);
        try {
            logger_1.logger.info('Starting error recovery', {
                service: 'errorRecovery',
                operation: 'triggerRecovery',
                pattern: patternKey,
                action: pattern.recoveryAction.type,
                failureCount: pattern.count
            });
            let result;
            switch (pattern.recoveryAction.type) {
                case 'retry':
                    result = await this.executeRetryRecovery(pattern);
                    break;
                case 'restart':
                    result = await this.executeRestartRecovery(pattern);
                    break;
                case 'skip':
                    result = await this.executeSkipRecovery(pattern);
                    break;
                default:
                    result = {
                        success: false,
                        action: 'manual',
                        error: 'Manual intervention required'
                    };
            }
            if (result.success) {
                pattern.count = 0;
                logger_1.logger.info('Error recovery successful', {
                    service: 'errorRecovery',
                    operation: 'triggerRecovery',
                    pattern: patternKey,
                    action: result.action
                });
            }
            else {
                logger_1.logger.error('Error recovery failed', undefined, {
                    service: 'errorRecovery',
                    operation: 'triggerRecovery',
                    pattern: patternKey,
                    action: result.action,
                    error: result.error
                });
            }
            return result;
        }
        finally {
            this.recoveryInProgress.delete(patternKey);
        }
    }
    async executeRetryRecovery(pattern) {
        const { service, operation } = pattern;
        const backoffMs = pattern.recoveryAction.backoffMs || 1000;
        try {
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            switch (service) {
                case 'database':
                    await database_1.database.reconnect();
                    break;
                case 'redis':
                    await redis_1.redisClient.reconnect();
                    break;
                case 'queue':
                    await queues_1.queueManager.retryFailedJobs();
                    break;
                case 'aiAnalysis':
                    await this.handleAiProviderFailure(operation, pattern.errorType);
                    break;
                case 'linkedInAnalysis':
                    await this.handleLinkedInFailure(operation, pattern.errorType);
                    break;
                case 'githubAnalysis':
                    await this.handleGitHubFailure(operation, pattern.errorType);
                    break;
                case 'vapiInterview':
                    await this.handleVapiFailure(operation, pattern.errorType);
                    break;
                default:
                    break;
            }
            return {
                success: true,
                action: 'retry',
                details: { backoffMs, service, operation }
            };
        }
        catch (error) {
            return {
                success: false,
                action: 'retry',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async handleAiProviderFailure(operation, errorType) {
        logger_1.logger.info('Handling AI provider failure', {
            service: 'errorRecovery',
            operation: 'handleAiProviderFailure',
            aiOperation: operation,
            errorType
        });
    }
    async handleLinkedInFailure(operation, errorType) {
        if (errorType === 'RateLimitError') {
            const backoffKey = 'linkedin:backoff';
            const currentBackoff = await redis_1.redisClient.get(backoffKey);
            const newBackoff = currentBackoff ? parseInt(currentBackoff) * 2 : 60000;
            const maxBackoff = 30 * 60 * 1000;
            await redis_1.redisClient.setex(backoffKey, Math.min(newBackoff, maxBackoff) / 1000, newBackoff.toString());
            logger_1.logger.info('LinkedIn rate limit backoff applied', {
                service: 'errorRecovery',
                operation: 'handleLinkedInFailure',
                backoffMs: Math.min(newBackoff, maxBackoff)
            });
        }
    }
    async handleGitHubFailure(operation, errorType) {
        if (errorType === 'RateLimitError') {
            const resetTime = new Date();
            resetTime.setHours(resetTime.getHours() + 1);
            const backoffKey = 'github:rateLimit:reset';
            await redis_1.redisClient.setex(backoffKey, 3600, resetTime.toISOString());
            logger_1.logger.info('GitHub rate limit detected, waiting for reset', {
                service: 'errorRecovery',
                operation: 'handleGitHubFailure',
                resetTime: resetTime.toISOString()
            });
        }
    }
    async handleVapiFailure(operation, errorType) {
        if (errorType === 'NetworkError' || errorType === 'CallFailedError') {
            const backoffKey = 'vapi:backoff';
            const backoffMs = 5 * 60 * 1000;
            await redis_1.redisClient.setex(backoffKey, backoffMs / 1000, Date.now().toString());
            logger_1.logger.info('VAPI call failure backoff applied', {
                service: 'errorRecovery',
                operation: 'handleVapiFailure',
                backoffMs
            });
        }
    }
    async executeRestartRecovery(pattern) {
        const { service, operation } = pattern;
        try {
            switch (service) {
                case 'queue':
                    await queues_1.queueManager.restartStalledJobs();
                    break;
                default:
                    return {
                        success: false,
                        action: 'restart',
                        error: `Restart not implemented for service: ${service}`
                    };
            }
            return {
                success: true,
                action: 'restart',
                details: { service, operation }
            };
        }
        catch (error) {
            return {
                success: false,
                action: 'restart',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async executeSkipRecovery(pattern) {
        logger_1.logger.info('Skipping failed operation as per recovery strategy', {
            service: 'errorRecovery',
            operation: 'executeSkipRecovery',
            pattern: pattern.service + ':' + pattern.operation + ':' + pattern.errorType
        });
        return {
            success: true,
            action: 'skip',
            details: {
                service: pattern.service,
                operation: pattern.operation,
                reason: pattern.recoveryAction.description
            }
        };
    }
    async retryFailedJobs(queueName) {
        try {
            const result = await queues_1.queueManager.retryFailedJobs(queueName);
            return {
                success: true,
                action: 'manual_retry',
                details: result
            };
        }
        catch (error) {
            return {
                success: false,
                action: 'manual_retry',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async clearFailurePatterns() {
        this.failurePatterns.clear();
        logger_1.logger.info('Failure patterns cleared', {
            service: 'errorRecovery',
            operation: 'clearFailurePatterns'
        });
    }
    getFailurePatterns() {
        return Array.from(this.failurePatterns.values());
    }
    getRecoveryStatus() {
        return {
            inProgress: Array.from(this.recoveryInProgress),
            patterns: this.failurePatterns.size
        };
    }
}
exports.errorRecoveryService = new ErrorRecoveryService();
//# sourceMappingURL=errorRecoveryService.js.map