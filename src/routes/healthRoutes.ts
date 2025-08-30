import { Router, Request, Response } from 'express';
import { healthCheckService } from '../services/healthCheckService';
import { monitoringService } from '../services/monitoringService';
import { alertingService } from '../services/alertingService';
import { errorRecoveryService } from '../services/errorRecoveryService';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';

const router = Router();

// Basic health check (public endpoint for load balancers)
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const health = await healthCheckService.getBasicHealthStatus();
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'basicHealthCheck'
    });
    
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Basic health check failed', error, {
      service: 'health',
      operation: 'basicHealthCheck'
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'basicHealthCheck'
    });
    
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: 'Health check failed'
    });
  }
});

// Detailed health check (requires authentication)
router.get('/health/detailed', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const health = await healthCheckService.getFullHealthStatus();
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'detailedHealthCheck',
      userId: (req as any).user?.id
    });
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Detailed health check failed', error, {
      service: 'health',
      operation: 'detailedHealthCheck',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'detailedHealthCheck'
    });
    
    res.status(500).json({
      error: 'Detailed health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// System metrics endpoint
router.get('/metrics', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const metrics = await monitoringService.getSystemMetrics();
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getMetrics',
      userId: (req as any).user?.id
    });
    
    res.json(metrics);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get system metrics', error, {
      service: 'health',
      operation: 'getMetrics',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getMetrics'
    });
    
    res.status(500).json({
      error: 'Failed to get system metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API usage metrics
router.get('/metrics/api', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const service = req.query.service as string;
    const hours = parseInt(req.query.hours as string) || 1;
    
    const apiMetrics = monitoringService.getApiMetrics(service, hours);
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getApiMetrics',
      userId: (req as any).user?.id,
      queryService: service,
      queryHours: hours
    });
    
    res.json({
      metrics: apiMetrics,
      summary: {
        totalRequests: apiMetrics.length,
        successRate: apiMetrics.length > 0 ? 
          apiMetrics.filter(m => m.statusCode < 400).length / apiMetrics.length : 1,
        averageResponseTime: apiMetrics.length > 0 ?
          apiMetrics.reduce((sum, m) => sum + m.responseTime, 0) / apiMetrics.length : 0
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get API metrics', error, {
      service: 'health',
      operation: 'getApiMetrics',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getApiMetrics'
    });
    
    res.status(500).json({
      error: 'Failed to get API metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Rate limit status
router.get('/rate-limits', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const service = req.query.service as string;
    const rateLimits = monitoringService.getRateLimitStatus(service);
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getRateLimits',
      userId: (req as any).user?.id,
      queryService: service
    });
    
    res.json(rateLimits);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get rate limit status', error, {
      service: 'health',
      operation: 'getRateLimits',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getRateLimits'
    });
    
    res.status(500).json({
      error: 'Failed to get rate limit status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Alerts endpoints
router.get('/alerts', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const service = req.query.service as string;
    const resolved = req.query.resolved === 'true' ? true : 
                    req.query.resolved === 'false' ? false : undefined;
    
    const alerts = monitoringService.getAlerts(service, resolved);
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getAlerts',
      userId: (req as any).user?.id,
      queryService: service,
      queryResolved: resolved
    });
    
    res.json(alerts);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get alerts', error, {
      service: 'health',
      operation: 'getAlerts',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getAlerts'
    });
    
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Alert rules management
router.get('/alert-rules', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const rules = alertingService.getRules();
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getAlertRules',
      userId: (req as any).user?.id
    });
    
    res.json(rules);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get alert rules', error, {
      service: 'health',
      operation: 'getAlertRules',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getAlertRules'
    });
    
    res.status(500).json({
      error: 'Failed to get alert rules',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Alert notifications
router.get('/notifications', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const acknowledged = req.query.acknowledged === 'true' ? true : 
                       req.query.acknowledged === 'false' ? false : undefined;
    
    const notifications = alertingService.getNotifications(acknowledged);
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getNotifications',
      userId: (req as any).user?.id,
      queryAcknowledged: acknowledged
    });
    
    res.json(notifications);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get notifications', error, {
      service: 'health',
      operation: 'getNotifications',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getNotifications'
    });
    
    res.status(500).json({
      error: 'Failed to get notifications',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Acknowledge notification
router.post('/notifications/:id/acknowledge', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const notificationId = req.params.id;
    const acknowledgedBy = (req as any).user?.id;
    
    if (!notificationId) {
      res.status(400).json({ error: 'Notification ID is required' });
      return;
    }
    
    let success: boolean;
    if (typeof acknowledgedBy === 'string') {
      success = alertingService.acknowledgeNotification(notificationId, acknowledgedBy);
    } else {
      success = alertingService.acknowledgeNotification(notificationId);
    }
    const duration = Date.now() - startTime;
    
    if (success) {
      logger.apiRequest(req.method, req.path, 200, duration, {
        service: 'health',
        operation: 'acknowledgeNotification',
        userId: (req as any).user?.id,
        notificationId
      });
      
      res.json({ success: true, message: 'Notification acknowledged' });
    } else {
      logger.apiRequest(req.method, req.path, 404, duration, {
        service: 'health',
        operation: 'acknowledgeNotification',
        userId: (req as any).user?.id,
        notificationId
      });
      
      res.status(404).json({ 
        success: false, 
        error: 'Notification not found or already acknowledged' 
      });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to acknowledge notification', error, {
      service: 'health',
      operation: 'acknowledgeNotification',
      userId: (req as any).user?.id,
      notificationId: req.params.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'acknowledgeNotification'
    });
    
    res.status(500).json({
      error: 'Failed to acknowledge notification',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error recovery endpoints
router.get('/recovery/patterns', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const patterns = errorRecoveryService.getFailurePatterns();
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getFailurePatterns',
      userId: (req as any).user?.id
    });
    
    res.json(patterns);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get failure patterns', error, {
      service: 'health',
      operation: 'getFailurePatterns',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getFailurePatterns'
    });
    
    res.status(500).json({
      error: 'Failed to get failure patterns',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/recovery/status', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const status = errorRecoveryService.getRecoveryStatus();
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getRecoveryStatus',
      userId: (req as any).user?.id
    });
    
    res.json(status);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get recovery status', error, {
      service: 'health',
      operation: 'getRecoveryStatus',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getRecoveryStatus'
    });
    
    res.status(500).json({
      error: 'Failed to get recovery status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manual recovery actions
router.post('/recovery/retry-failed-jobs', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const queueName = req.body.queueName;
    const result = await errorRecoveryService.retryFailedJobs(queueName);
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'retryFailedJobs',
      userId: (req as any).user?.id,
      queueName
    });
    
    res.json(result);
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to retry failed jobs', error, {
      service: 'health',
      operation: 'retryFailedJobs',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'retryFailedJobs'
    });
    
    res.status(500).json({
      error: 'Failed to retry failed jobs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// System status overview
router.get('/status', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const [
      healthStatus,
      detailedHealth,
      systemMetrics,
      monitoringStatus,
      alertingStatus,
      recoveryStatus
    ] = await Promise.all([
      healthCheckService.getBasicHealthStatus(),
      healthCheckService.getFullHealthStatus(),
      monitoringService.getSystemMetrics(),
      Promise.resolve(monitoringService.getMonitoringStatus()),
      Promise.resolve(alertingService.getAlertingStatus()),
      Promise.resolve(errorRecoveryService.getRecoveryStatus())
    ]);
    
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'getSystemStatus',
      userId: (req as any).user?.id
    });
    
    res.json({
      overview: {
        status: healthStatus.status,
        uptime: systemMetrics.uptime,
        version: detailedHealth.version,
        timestamp: new Date()
      },
      health: {
        basic: healthStatus,
        detailed: detailedHealth
      },
      metrics: systemMetrics,
      monitoring: monitoringStatus,
      alerting: alertingStatus,
      recovery: recoveryStatus,
      summary: {
        criticalAlerts: alertingStatus.unacknowledgedNotifications,
        failurePatterns: recoveryStatus.patterns,
        queueBacklog: systemMetrics.queueStats.waiting,
        apiSuccessRate: systemMetrics.apiUsage.successRate,
        memoryUsage: Math.round((systemMetrics.memory.heapUsed / systemMetrics.memory.heapTotal) * 100)
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to get system status', error, {
      service: 'health',
      operation: 'getSystemStatus',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'getSystemStatus'
    });
    
    res.status(500).json({
      error: 'Failed to get system status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Comprehensive connectivity check
router.get('/connectivity', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const connectivity = await healthCheckService.checkServiceConnectivity();
    const duration = Date.now() - startTime;
    
    logger.apiRequest(req.method, req.path, 200, duration, {
      service: 'health',
      operation: 'checkConnectivity',
      userId: (req as any).user?.id
    });
    
    res.json({
      connectivity,
      summary: {
        coreServices: {
          database: connectivity.database.status,
          redis: connectivity.redis.status,
          queues: connectivity.queues.status
        },
        aiProviders: Object.entries(connectivity.aiProviders).map(([name, health]) => ({
          name,
          status: health.status,
          responseTime: health.responseTime
        })),
        externalServices: Object.entries(connectivity.externalServices).map(([name, health]) => ({
          name,
          status: health.status,
          responseTime: health.responseTime
        }))
      },
      timestamp: new Date()
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to check connectivity', error, {
      service: 'health',
      operation: 'checkConnectivity',
      userId: (req as any).user?.id
    });
    
    logger.apiRequest(req.method, req.path, 500, duration, {
      service: 'health',
      operation: 'checkConnectivity'
    });
    
    res.status(500).json({
      error: 'Failed to check connectivity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;