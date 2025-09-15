"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const healthCheckService_1 = require("../services/healthCheckService");
const monitoringService_1 = require("../services/monitoringService");
const alertingService_1 = require("../services/alertingService");
const errorRecoveryService_1 = require("../services/errorRecoveryService");
const logger_1 = require("../utils/logger");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/health', async (req, res) => {
    const startTime = Date.now();
    try {
        const health = await healthCheckService_1.healthCheckService.getBasicHealthStatus();
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'basicHealthCheck'
        });
        res.status(health.status === 'healthy' ? 200 : 503).json(health);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Basic health check failed', error, {
            service: 'health',
            operation: 'basicHealthCheck'
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
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
router.get('/health/detailed', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const health = await healthCheckService_1.healthCheckService.getFullHealthStatus();
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'detailedHealthCheck',
            userId: req.user?.id
        });
        const statusCode = health.status === 'healthy' ? 200 :
            health.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(health);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Detailed health check failed', error, {
            service: 'health',
            operation: 'detailedHealthCheck',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'detailedHealthCheck'
        });
        res.status(500).json({
            error: 'Detailed health check failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/metrics', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const metrics = await monitoringService_1.monitoringService.getSystemMetrics();
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getMetrics',
            userId: req.user?.id
        });
        res.json(metrics);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get system metrics', error, {
            service: 'health',
            operation: 'getMetrics',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getMetrics'
        });
        res.status(500).json({
            error: 'Failed to get system metrics',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/metrics/api', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const service = req.query.service;
        const hours = parseInt(req.query.hours) || 1;
        const apiMetrics = monitoringService_1.monitoringService.getApiMetrics(service, hours);
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getApiMetrics',
            userId: req.user?.id,
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
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get API metrics', error, {
            service: 'health',
            operation: 'getApiMetrics',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getApiMetrics'
        });
        res.status(500).json({
            error: 'Failed to get API metrics',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/rate-limits', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const service = req.query.service;
        const rateLimits = monitoringService_1.monitoringService.getRateLimitStatus(service);
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getRateLimits',
            userId: req.user?.id,
            queryService: service
        });
        res.json(rateLimits);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get rate limit status', error, {
            service: 'health',
            operation: 'getRateLimits',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getRateLimits'
        });
        res.status(500).json({
            error: 'Failed to get rate limit status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/alerts', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const service = req.query.service;
        const resolved = req.query.resolved === 'true' ? true :
            req.query.resolved === 'false' ? false : undefined;
        const alerts = monitoringService_1.monitoringService.getAlerts(service, resolved);
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getAlerts',
            userId: req.user?.id,
            queryService: service,
            queryResolved: resolved
        });
        res.json(alerts);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get alerts', error, {
            service: 'health',
            operation: 'getAlerts',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getAlerts'
        });
        res.status(500).json({
            error: 'Failed to get alerts',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/alert-rules', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const rules = alertingService_1.alertingService.getRules();
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getAlertRules',
            userId: req.user?.id
        });
        res.json(rules);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get alert rules', error, {
            service: 'health',
            operation: 'getAlertRules',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getAlertRules'
        });
        res.status(500).json({
            error: 'Failed to get alert rules',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/notifications', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const acknowledged = req.query.acknowledged === 'true' ? true :
            req.query.acknowledged === 'false' ? false : undefined;
        const notifications = alertingService_1.alertingService.getNotifications(acknowledged);
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getNotifications',
            userId: req.user?.id,
            queryAcknowledged: acknowledged
        });
        res.json(notifications);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get notifications', error, {
            service: 'health',
            operation: 'getNotifications',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getNotifications'
        });
        res.status(500).json({
            error: 'Failed to get notifications',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/notifications/:id/acknowledge', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const notificationId = req.params.id;
        const acknowledgedBy = req.user?.id;
        if (!notificationId) {
            res.status(400).json({ error: 'Notification ID is required' });
            return;
        }
        let success;
        if (typeof acknowledgedBy === 'string') {
            success = alertingService_1.alertingService.acknowledgeNotification(notificationId, acknowledgedBy);
        }
        else {
            success = alertingService_1.alertingService.acknowledgeNotification(notificationId);
        }
        const duration = Date.now() - startTime;
        if (success) {
            logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
                service: 'health',
                operation: 'acknowledgeNotification',
                userId: req.user?.id,
                notificationId
            });
            res.json({ success: true, message: 'Notification acknowledged' });
        }
        else {
            logger_1.logger.apiRequest(req.method, req.path, 404, duration, {
                service: 'health',
                operation: 'acknowledgeNotification',
                userId: req.user?.id,
                notificationId
            });
            res.status(404).json({
                success: false,
                error: 'Notification not found or already acknowledged'
            });
        }
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to acknowledge notification', error, {
            service: 'health',
            operation: 'acknowledgeNotification',
            userId: req.user?.id,
            notificationId: req.params.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'acknowledgeNotification'
        });
        res.status(500).json({
            error: 'Failed to acknowledge notification',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/recovery/patterns', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const patterns = errorRecoveryService_1.errorRecoveryService.getFailurePatterns();
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getFailurePatterns',
            userId: req.user?.id
        });
        res.json(patterns);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get failure patterns', error, {
            service: 'health',
            operation: 'getFailurePatterns',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getFailurePatterns'
        });
        res.status(500).json({
            error: 'Failed to get failure patterns',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/recovery/status', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const status = errorRecoveryService_1.errorRecoveryService.getRecoveryStatus();
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getRecoveryStatus',
            userId: req.user?.id
        });
        res.json(status);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get recovery status', error, {
            service: 'health',
            operation: 'getRecoveryStatus',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getRecoveryStatus'
        });
        res.status(500).json({
            error: 'Failed to get recovery status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/recovery/retry-failed-jobs', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const queueName = req.body.queueName;
        const result = await errorRecoveryService_1.errorRecoveryService.retryFailedJobs(queueName);
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'retryFailedJobs',
            userId: req.user?.id,
            queueName
        });
        res.json(result);
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to retry failed jobs', error, {
            service: 'health',
            operation: 'retryFailedJobs',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'retryFailedJobs'
        });
        res.status(500).json({
            error: 'Failed to retry failed jobs',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/status', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const [healthStatus, detailedHealth, systemMetrics, monitoringStatus, alertingStatus, recoveryStatus] = await Promise.all([
            healthCheckService_1.healthCheckService.getBasicHealthStatus(),
            healthCheckService_1.healthCheckService.getFullHealthStatus(),
            monitoringService_1.monitoringService.getSystemMetrics(),
            Promise.resolve(monitoringService_1.monitoringService.getMonitoringStatus()),
            Promise.resolve(alertingService_1.alertingService.getAlertingStatus()),
            Promise.resolve(errorRecoveryService_1.errorRecoveryService.getRecoveryStatus())
        ]);
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'getSystemStatus',
            userId: req.user?.id
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
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to get system status', error, {
            service: 'health',
            operation: 'getSystemStatus',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'getSystemStatus'
        });
        res.status(500).json({
            error: 'Failed to get system status',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/connectivity', auth_1.authenticate, async (req, res) => {
    const startTime = Date.now();
    try {
        const connectivity = await healthCheckService_1.healthCheckService.checkServiceConnectivity();
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, 200, duration, {
            service: 'health',
            operation: 'checkConnectivity',
            userId: req.user?.id
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
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger_1.logger.error('Failed to check connectivity', error, {
            service: 'health',
            operation: 'checkConnectivity',
            userId: req.user?.id
        });
        logger_1.logger.apiRequest(req.method, req.path, 500, duration, {
            service: 'health',
            operation: 'checkConnectivity'
        });
        res.status(500).json({
            error: 'Failed to check connectivity',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=healthRoutes.js.map