import { logger } from '../utils/logger';
import { queueManager } from '../queues';
import { database } from '../utils/database';
import { redisClient } from '../utils/redis';

export interface RecoveryAction {
  type: 'retry' | 'restart' | 'skip' | 'manual';
  description: string;
  maxAttempts?: number;
  backoffMs?: number;
}

export interface FailurePattern {
  service: string;
  operation: string;
  errorType: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  recoveryAction: RecoveryAction;
}

export interface RecoveryResult {
  success: boolean;
  action: string;
  details?: any;
  error?: string;
}

class ErrorRecoveryService {
  private failurePatterns: Map<string, FailurePattern> = new Map();
  private recoveryInProgress: Set<string> = new Set();
  private maxPatternHistory = 100;

  constructor() {
    // Clean up old patterns every hour
    setInterval(() => this.cleanupOldPatterns(), 60 * 60 * 1000);
  }

  private getPatternKey(service: string, operation: string, errorType: string): string {
    return `${service}:${operation}:${errorType}`;
  }

  private cleanupOldPatterns(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [key, pattern] of this.failurePatterns.entries()) {
      if (pattern.lastOccurrence < cutoffTime) {
        this.failurePatterns.delete(key);
      }
    }
    
    logger.debug('Cleaned up old failure patterns', {
      service: 'errorRecovery',
      operation: 'cleanupOldPatterns',
      remainingPatterns: this.failurePatterns.size
    });
  }

  recordFailure(service: string, operation: string, errorType: string, error?: any): void {
    const patternKey = this.getPatternKey(service, operation, errorType);
    const now = new Date();
    
    let pattern = this.failurePatterns.get(patternKey);
    
    if (pattern) {
      pattern.count++;
      pattern.lastOccurrence = now;
    } else {
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
    
    logger.warn('Failure pattern recorded', {
      service: 'errorRecovery',
      operation: 'recordFailure',
      patternKey,
      count: pattern.count,
      recoveryAction: pattern.recoveryAction.type
    });
    
    // Trigger recovery if pattern indicates it's needed
    if (this.shouldTriggerRecovery(pattern)) {
      this.triggerRecovery(pattern).catch(recoveryError => {
        logger.error('Recovery trigger failed', recoveryError, {
          service: 'errorRecovery',
          operation: 'triggerRecovery',
          patternKey
        });
      });
    }
  }

  private determineRecoveryAction(service: string, operation: string, errorType: string): RecoveryAction {
    // Define recovery strategies based on service and error type
    const strategies: Record<string, RecoveryAction> = {
      // Database connection issues
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
      
      // Redis connection issues
      'redis:connect:ConnectionError': {
        type: 'retry',
        description: 'Retry Redis connection',
        maxAttempts: 5,
        backoffMs: 1000
      },
      
      // Queue processing issues
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
      
      // External API issues
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
      
      // File processing issues
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

  private shouldTriggerRecovery(pattern: FailurePattern): boolean {
    // Trigger recovery based on failure count and time window
    const timeSinceFirst = Date.now() - pattern.firstOccurrence.getTime();
    const timeSinceLast = Date.now() - pattern.lastOccurrence.getTime();
    
    // Don't trigger if recovery is already in progress
    const patternKey = this.getPatternKey(pattern.service, pattern.operation, pattern.errorType);
    if (this.recoveryInProgress.has(patternKey)) {
      return false;
    }
    
    // Trigger recovery conditions
    if (pattern.recoveryAction.type === 'retry' && pattern.count >= 3) {
      return true;
    }
    
    if (pattern.recoveryAction.type === 'restart' && pattern.count >= 2) {
      return true;
    }
    
    // For critical services, trigger faster
    const criticalServices = ['database', 'redis', 'queue'];
    if (criticalServices.includes(pattern.service) && pattern.count >= 2) {
      return true;
    }
    
    return false;
  }

  private async triggerRecovery(pattern: FailurePattern): Promise<RecoveryResult> {
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
      logger.info('Starting error recovery', {
        service: 'errorRecovery',
        operation: 'triggerRecovery',
        pattern: patternKey,
        action: pattern.recoveryAction.type,
        failureCount: pattern.count
      });
      
      let result: RecoveryResult;
      
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
        // Reset failure count on successful recovery
        pattern.count = 0;
        logger.info('Error recovery successful', {
          service: 'errorRecovery',
          operation: 'triggerRecovery',
          pattern: patternKey,
          action: result.action
        });
      } else {
        logger.error('Error recovery failed', undefined, {
          service: 'errorRecovery',
          operation: 'triggerRecovery',
          pattern: patternKey,
          action: result.action,
          error: result.error
        });
      }
      
      return result;
    } finally {
      this.recoveryInProgress.delete(patternKey);
    }
  }

  private async executeRetryRecovery(pattern: FailurePattern): Promise<RecoveryResult> {
    const { service, operation } = pattern;
    const backoffMs = pattern.recoveryAction.backoffMs || 1000;
    
    try {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      
      // Execute service-specific recovery
      switch (service) {
        case 'database':
          await database.reconnect();
          break;
        case 'redis':
          await redisClient.reconnect();
          break;
        case 'queue':
          await queueManager.retryFailedJobs();
          break;
        case 'aiAnalysis':
          // For AI services, implement provider switching
          await this.handleAiProviderFailure(operation, pattern.errorType);
          break;
        case 'linkedInAnalysis':
          // For LinkedIn, implement request throttling
          await this.handleLinkedInFailure(operation, pattern.errorType);
          break;
        case 'githubAnalysis':
          // For GitHub, handle rate limits
          await this.handleGitHubFailure(operation, pattern.errorType);
          break;
        case 'vapiInterview':
          // For VAPI, handle call failures
          await this.handleVapiFailure(operation, pattern.errorType);
          break;
        default:
          // For other external services, just wait - the next request will retry
          break;
      }
      
      return {
        success: true,
        action: 'retry',
        details: { backoffMs, service, operation }
      };
    } catch (error) {
      return {
        success: false,
        action: 'retry',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async handleAiProviderFailure(operation: string, errorType: string): Promise<void> {
    logger.info('Handling AI provider failure', {
      service: 'errorRecovery',
      operation: 'handleAiProviderFailure',
      aiOperation: operation,
      errorType
    });
    
    // AI provider failures are handled by the AI service itself through provider switching
    // This is just for logging and potential future enhancements
  }

  private async handleLinkedInFailure(operation: string, errorType: string): Promise<void> {
    if (errorType === 'RateLimitError') {
      // Implement exponential backoff for LinkedIn requests
      const backoffKey = 'linkedin:backoff';
      const currentBackoff = await redisClient.get(backoffKey);
      const newBackoff = currentBackoff ? parseInt(currentBackoff) * 2 : 60000; // Start with 1 minute
      const maxBackoff = 30 * 60 * 1000; // Max 30 minutes
      
      await redisClient.setex(backoffKey, Math.min(newBackoff, maxBackoff) / 1000, newBackoff.toString());
      
      logger.info('LinkedIn rate limit backoff applied', {
        service: 'errorRecovery',
        operation: 'handleLinkedInFailure',
        backoffMs: Math.min(newBackoff, maxBackoff)
      });
    }
  }

  private async handleGitHubFailure(operation: string, errorType: string): Promise<void> {
    if (errorType === 'RateLimitError') {
      // GitHub rate limits reset at specific times, so we need to wait
      const resetTime = new Date();
      resetTime.setHours(resetTime.getHours() + 1); // GitHub resets hourly
      
      const backoffKey = 'github:rateLimit:reset';
      await redisClient.setex(backoffKey, 3600, resetTime.toISOString()); // 1 hour TTL
      
      logger.info('GitHub rate limit detected, waiting for reset', {
        service: 'errorRecovery',
        operation: 'handleGitHubFailure',
        resetTime: resetTime.toISOString()
      });
    }
  }

  private async handleVapiFailure(operation: string, errorType: string): Promise<void> {
    if (errorType === 'NetworkError' || errorType === 'CallFailedError') {
      // For VAPI call failures, we might want to switch to a different endpoint or retry later
      const backoffKey = 'vapi:backoff';
      const backoffMs = 5 * 60 * 1000; // 5 minutes backoff for call failures
      
      await redisClient.setex(backoffKey, backoffMs / 1000, Date.now().toString());
      
      logger.info('VAPI call failure backoff applied', {
        service: 'errorRecovery',
        operation: 'handleVapiFailure',
        backoffMs
      });
    }
  }

  private async executeRestartRecovery(pattern: FailurePattern): Promise<RecoveryResult> {
    const { service, operation } = pattern;
    
    try {
      switch (service) {
        case 'queue':
          await queueManager.restartStalledJobs();
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
    } catch (error) {
      return {
        success: false,
        action: 'restart',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeSkipRecovery(pattern: FailurePattern): Promise<RecoveryResult> {
    // For skip recovery, we just log and continue
    logger.info('Skipping failed operation as per recovery strategy', {
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

  // Manual recovery methods
  async retryFailedJobs(queueName?: string): Promise<RecoveryResult> {
    try {
      const result = await queueManager.retryFailedJobs(queueName);
      return {
        success: true,
        action: 'manual_retry',
        details: result
      };
    } catch (error) {
      return {
        success: false,
        action: 'manual_retry',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async clearFailurePatterns(): Promise<void> {
    this.failurePatterns.clear();
    logger.info('Failure patterns cleared', {
      service: 'errorRecovery',
      operation: 'clearFailurePatterns'
    });
  }

  getFailurePatterns(): FailurePattern[] {
    return Array.from(this.failurePatterns.values());
  }

  getRecoveryStatus(): { inProgress: string[]; patterns: number } {
    return {
      inProgress: Array.from(this.recoveryInProgress),
      patterns: this.failurePatterns.size
    };
  }
}

export const errorRecoveryService = new ErrorRecoveryService();