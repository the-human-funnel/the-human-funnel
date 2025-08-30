import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { logger } from '../utils/logger';
import { healthCheckService } from '../services/healthCheckService';
import { monitoringService } from '../services/monitoringService';
import { alertingService } from '../services/alertingService';
import { errorRecoveryService } from '../services/errorRecoveryService';
import { 
  CustomError, 
  createDatabaseError, 
  createExternalApiError,
  createValidationError 
} from '../middleware/errorHandling';

describe('Error Handling and Monitoring System', () => {
  beforeEach(() => {
    // Clear metrics and logs before each test
    logger.clearMetrics();
    monitoringService.clearMetrics();
    errorRecoveryService.clearFailurePatterns();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Clean up services to prevent background timers from running after tests
    alertingService.shutdown();
  });

  describe('Logger', () => {
    it('should log structured messages with context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.info('Test message', {
        service: 'test',
        operation: 'testOperation',
        userId: 'user123'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0]?.[0] as string;
      expect(logCall).toContain('Test message');
      expect(logCall).toContain('test');
      expect(logCall).toContain('testOperation');
      
      consoleSpy.mockRestore();
    });

    it('should track performance metrics', () => {
      logger.performance('testOperation', 1500, true, {
        service: 'test',
        operation: 'performance'
      });
      
      const metrics = logger.getPerformanceMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.operation).toBe('testOperation');
      expect(metrics[0]?.duration).toBe(1500);
      expect(metrics[0]?.success).toBe(true);
    });

    it('should track error metrics', () => {
      const error = new Error('Test error');
      logger.error('Test error occurred', error, {
        service: 'test',
        operation: 'errorTest'
      });
      
      const errorMetrics = logger.getErrorMetrics();
      expect(errorMetrics).toHaveLength(1);
      expect(errorMetrics[0]?.service).toBe('test');
      expect(errorMetrics[0]?.operation).toBe('errorTest');
      expect(errorMetrics[0]?.errorType).toBe('Error');
    });

    it('should log API requests with proper context', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.apiRequest('GET', '/api/test', 200, 150, {
        service: 'api',
        userId: 'user123'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log external service calls', () => {
      // Set log level to debug to capture debug messages
      logger.setLogLevel('DEBUG');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      logger.externalService('gemini', 'analyze', true, 2000, {
        candidateId: 'candidate123'
      });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
      
      // Reset log level
      logger.setLogLevel('INFO');
    });
  });

  describe('Custom Errors', () => {
    it('should create database errors with proper context', () => {
      const error = createDatabaseError('Connection failed', 'connect');
      
      expect(error).toBeInstanceOf(CustomError);
      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBe(500);
      expect(error.service).toBe('database');
      expect(error.operation).toBe('connect');
    });

    it('should create external API errors with proper context', () => {
      const error = createExternalApiError('gemini', 'analyze', 'Rate limit exceeded', 429);
      
      expect(error).toBeInstanceOf(CustomError);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
      expect(error.service).toBe('gemini');
      expect(error.operation).toBe('analyze');
    });

    it('should create validation errors with proper context', () => {
      const error = createValidationError('Invalid input format', 'validateInput');
      
      expect(error).toBeInstanceOf(CustomError);
      expect(error.message).toBe('Invalid input format');
      expect(error.statusCode).toBe(400);
      expect(error.service).toBe('validation');
      expect(error.operation).toBe('validateInput');
    });
  });

  describe('Monitoring Service', () => {
    it('should record API usage metrics', () => {
      monitoringService.recordApiUsage({
        service: 'gemini',
        endpoint: '/analyze',
        method: 'POST',
        statusCode: 200,
        responseTime: 1500
      });
      
      const metrics = monitoringService.getApiMetrics('gemini', 1);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]?.service).toBe('gemini');
      expect(metrics[0]?.statusCode).toBe(200);
      expect(metrics[0]?.responseTime).toBe(1500);
    });

    it('should create alerts for slow API responses', () => {
      monitoringService.recordApiUsage({
        service: 'gemini',
        endpoint: '/analyze',
        method: 'POST',
        statusCode: 200,
        responseTime: 6000 // Slow response
      });
      
      const alerts = monitoringService.getAlerts('gemini', false);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]?.type).toBe('warning');
      expect(alerts[0]?.message).toContain('Slow API response');
    });

    it('should create alerts for API errors', () => {
      monitoringService.recordApiUsage({
        service: 'gemini',
        endpoint: '/analyze',
        method: 'POST',
        statusCode: 500,
        responseTime: 1000
      });
      
      const alerts = monitoringService.getAlerts('gemini', false);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]?.type).toBe('error');
      expect(alerts[0]?.message).toContain('API error: 500');
    });

    it('should update rate limit status', () => {
      monitoringService.updateRateLimitStatus('gemini', {
        service: 'gemini',
        remaining: 50,
        limit: 1000,
        resetTime: new Date(Date.now() + 60000),
        isNearLimit: true,
        isExceeded: false
      });
      
      const rateLimits = monitoringService.getRateLimitStatus('gemini');
      expect(rateLimits).toHaveLength(1);
      expect(rateLimits[0]?.remaining).toBe(50);
      expect(rateLimits[0]?.isNearLimit).toBe(true);
    });

    it('should get system metrics', async () => {
      const metrics = await monitoringService.getSystemMetrics();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('apiUsage');
      expect(metrics.apiUsage).toHaveProperty('totalRequests');
      expect(metrics.apiUsage).toHaveProperty('successRate');
    });
  });

  describe('Error Recovery Service', () => {
    it('should record failure patterns', () => {
      errorRecoveryService.recordFailure('gemini', 'analyze', 'RateLimitError');
      
      const patterns = errorRecoveryService.getFailurePatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0]?.service).toBe('gemini');
      expect(patterns[0]?.operation).toBe('analyze');
      expect(patterns[0]?.errorType).toBe('RateLimitError');
      expect(patterns[0]?.count).toBe(1);
    });

    it('should increment failure count for repeated failures', () => {
      errorRecoveryService.recordFailure('gemini', 'analyze', 'RateLimitError');
      errorRecoveryService.recordFailure('gemini', 'analyze', 'RateLimitError');
      errorRecoveryService.recordFailure('gemini', 'analyze', 'RateLimitError');
      
      const patterns = errorRecoveryService.getFailurePatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0]?.count).toBe(3);
    });

    it('should track different error types separately', () => {
      errorRecoveryService.recordFailure('gemini', 'analyze', 'RateLimitError');
      errorRecoveryService.recordFailure('gemini', 'analyze', 'NetworkError');
      errorRecoveryService.recordFailure('database', 'connect', 'ConnectionError');
      
      const patterns = errorRecoveryService.getFailurePatterns();
      expect(patterns).toHaveLength(3);
    });

    it('should get recovery status', () => {
      errorRecoveryService.recordFailure('gemini', 'analyze', 'RateLimitError');
      
      const status = errorRecoveryService.getRecoveryStatus();
      expect(status).toHaveProperty('inProgress');
      expect(status).toHaveProperty('patterns');
      expect(status.patterns).toBe(1);
    });
  });

  describe('Alerting Service', () => {
    it('should have default alert rules', () => {
      const rules = alertingService.getRules();
      expect(rules.length).toBeGreaterThan(0);
      
      const memoryRule = rules.find(rule => rule.name === 'High Memory Usage');
      expect(memoryRule).toBeDefined();
      expect(memoryRule?.enabled).toBe(true);
    });

    it('should add custom alert rules', () => {
      const ruleId = alertingService.addRule({
        name: 'Test Rule',
        description: 'Test alert rule',
        condition: {
          type: 'threshold',
          metric: 'test.metric',
          operator: '>',
          value: 100
        },
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10,
        actions: [{ type: 'log', config: {} }]
      });
      
      expect(ruleId).toBeDefined();
      
      const rule = alertingService.getRule(ruleId);
      expect(rule?.name).toBe('Test Rule');
    });

    it('should update alert rules', () => {
      const rules = alertingService.getRules();
      const firstRule = rules[0];
      
      if (firstRule) {
        const updated = alertingService.updateRule(firstRule.id, {
          enabled: false
        });
        
        expect(updated).toBe(true);
        
        const updatedRule = alertingService.getRule(firstRule.id);
        expect(updatedRule?.enabled).toBe(false);
      }
    });

    it('should delete alert rules', () => {
      const ruleId = alertingService.addRule({
        name: 'Test Rule to Delete',
        description: 'Test alert rule',
        condition: {
          type: 'threshold',
          metric: 'test.metric',
          operator: '>',
          value: 100
        },
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10,
        actions: [{ type: 'log', config: {} }]
      });
      
      const deleted = alertingService.deleteRule(ruleId);
      expect(deleted).toBe(true);
      
      const rule = alertingService.getRule(ruleId);
      expect(rule).toBeUndefined();
    });

    it('should get alerting status', () => {
      const status = alertingService.getAlertingStatus();
      
      expect(status).toHaveProperty('rulesCount');
      expect(status).toHaveProperty('enabledRules');
      expect(status).toHaveProperty('notificationsCount');
      expect(status).toHaveProperty('unacknowledgedNotifications');
    });
  });

  describe('Health Check Service', () => {
    it('should get basic health status', async () => {
      const health = await healthCheckService.getBasicHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(['healthy', 'unhealthy']).toContain(health.status);
    });

    it('should increment and decrement connections', () => {
      const initialConnections = 0;
      
      healthCheckService.incrementConnections();
      healthCheckService.incrementConnections();
      
      // We can't directly test the connection count without exposing it,
      // but we can verify the methods don't throw errors
      expect(() => {
        healthCheckService.decrementConnections();
        healthCheckService.decrementConnections();
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should handle error flow from logging to recovery', () => {
      // Simulate an error that should trigger recovery
      const error = new Error('Database connection failed');
      
      // Log the error
      logger.error('Database error occurred', error, {
        service: 'database',
        operation: 'connect'
      });
      
      // Record the failure for recovery
      errorRecoveryService.recordFailure('database', 'connect', 'ConnectionError');
      
      // Check that error metrics were recorded
      const errorMetrics = logger.getErrorMetrics();
      expect(errorMetrics.length).toBeGreaterThan(0);
      
      // Check that failure patterns were recorded
      const patterns = errorRecoveryService.getFailurePatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should handle API monitoring flow', () => {
      // Record a slow API call
      monitoringService.recordApiUsage({
        service: 'gemini',
        endpoint: '/analyze',
        method: 'POST',
        statusCode: 200,
        responseTime: 8000 // Very slow
      });
      
      // Check that metrics were recorded
      const metrics = monitoringService.getApiMetrics('gemini', 1);
      expect(metrics).toHaveLength(1);
      
      // Check that an alert was created
      const alerts = monitoringService.getAlerts('gemini', false);
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});