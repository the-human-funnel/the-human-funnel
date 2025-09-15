"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertingService = void 0;
const logger_1 = require("../utils/logger");
const monitoringService_1 = require("./monitoringService");
class AlertingService {
    constructor() {
        this.alertRules = new Map();
        this.notifications = new Map();
        this.cooldownTracker = new Map();
        this.evaluationInterval = null;
        this.maxNotificationHistory = 1000;
        this.initializeDefaultRules();
        this.startEvaluation();
    }
    initializeDefaultRules() {
        const defaultRules = [
            {
                name: 'High Memory Usage',
                description: 'Alert when memory usage exceeds 85%',
                condition: {
                    type: 'threshold',
                    metric: 'memory.heapUsed',
                    operator: '>',
                    value: 0.85,
                    timeWindow: 5,
                    aggregation: 'avg'
                },
                severity: 'high',
                enabled: true,
                cooldownMinutes: 15,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'recovery', config: { action: 'gc' } }
                ]
            },
            {
                name: 'High Error Rate',
                description: 'Alert when API error rate exceeds 10%',
                condition: {
                    type: 'rate',
                    metric: 'api.errorRate',
                    operator: '>',
                    value: 0.1,
                    timeWindow: 10,
                    aggregation: 'avg'
                },
                severity: 'critical',
                enabled: true,
                cooldownMinutes: 10,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'webhook', config: { url: process.env.ALERT_WEBHOOK_URL } }
                ]
            },
            {
                name: 'Slow Response Time',
                description: 'Alert when average response time exceeds 5 seconds',
                condition: {
                    type: 'threshold',
                    metric: 'api.responseTime',
                    operator: '>',
                    value: 5000,
                    timeWindow: 5,
                    aggregation: 'avg'
                },
                severity: 'medium',
                enabled: true,
                cooldownMinutes: 20,
                actions: [
                    { type: 'log', config: {} }
                ]
            },
            {
                name: 'Queue Backlog',
                description: 'Alert when queue has more than 500 waiting jobs',
                condition: {
                    type: 'threshold',
                    metric: 'queue.waiting',
                    operator: '>',
                    value: 500,
                    timeWindow: 5,
                    aggregation: 'avg'
                },
                severity: 'high',
                enabled: true,
                cooldownMinutes: 30,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'recovery', config: { action: 'scaleQueue' } }
                ]
            },
            {
                name: 'Failed Jobs Threshold',
                description: 'Alert when failed jobs exceed 50',
                condition: {
                    type: 'threshold',
                    metric: 'queue.failed',
                    operator: '>',
                    value: 50,
                    timeWindow: 10,
                    aggregation: 'sum'
                },
                severity: 'high',
                enabled: true,
                cooldownMinutes: 15,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'recovery', config: { action: 'retryFailedJobs' } }
                ]
            },
            {
                name: 'Rate Limit Exceeded',
                description: 'Alert when external API rate limits are exceeded',
                condition: {
                    type: 'pattern',
                    metric: 'api.rateLimitViolations',
                    operator: '>',
                    value: 5,
                    timeWindow: 15,
                    aggregation: 'count'
                },
                severity: 'medium',
                enabled: true,
                cooldownMinutes: 60,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'recovery', config: { action: 'backoffRequests' } }
                ]
            },
            {
                name: 'Database Connection Issues',
                description: 'Alert when database connection fails',
                condition: {
                    type: 'availability',
                    metric: 'database.connected',
                    operator: '=',
                    value: 0,
                    timeWindow: 1
                },
                severity: 'critical',
                enabled: true,
                cooldownMinutes: 5,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'recovery', config: { action: 'reconnectDatabase' } }
                ]
            },
            {
                name: 'External API Failures',
                description: 'Alert when external API error rate is high',
                condition: {
                    type: 'rate',
                    metric: 'external.errorRate',
                    operator: '>',
                    value: 0.2,
                    timeWindow: 15,
                    aggregation: 'avg'
                },
                severity: 'high',
                enabled: true,
                cooldownMinutes: 20,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'recovery', config: { action: 'switchProvider' } }
                ]
            },
            {
                name: 'Processing Pipeline Stalled',
                description: 'Alert when processing pipeline has no active jobs for extended period',
                condition: {
                    type: 'threshold',
                    metric: 'queue.activeJobs',
                    operator: '=',
                    value: 0,
                    timeWindow: 30,
                    aggregation: 'avg'
                },
                severity: 'medium',
                enabled: true,
                cooldownMinutes: 45,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'recovery', config: { action: 'restartQueues' } }
                ]
            },
            {
                name: 'Disk Space Low',
                description: 'Alert when available disk space is low',
                condition: {
                    type: 'threshold',
                    metric: 'system.diskUsage',
                    operator: '>',
                    value: 0.9,
                    timeWindow: 5,
                    aggregation: 'avg'
                },
                severity: 'high',
                enabled: true,
                cooldownMinutes: 60,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'recovery', config: { action: 'cleanupTempFiles' } }
                ]
            },
            {
                name: 'Security Anomaly Detected',
                description: 'Alert on suspicious security events',
                condition: {
                    type: 'pattern',
                    metric: 'security.anomalies',
                    operator: '>',
                    value: 5,
                    timeWindow: 10,
                    aggregation: 'count'
                },
                severity: 'critical',
                enabled: true,
                cooldownMinutes: 15,
                actions: [
                    { type: 'log', config: {} },
                    { type: 'webhook', config: { url: process.env.SECURITY_WEBHOOK_URL } }
                ]
            }
        ];
        defaultRules.forEach(rule => {
            const alertRule = {
                ...rule,
                id: this.generateRuleId(rule.name),
                createdAt: new Date()
            };
            this.alertRules.set(alertRule.id, alertRule);
        });
        logger_1.logger.info('Initialized default alert rules', {
            service: 'alerting',
            operation: 'initializeDefaultRules',
            rulesCount: this.alertRules.size
        });
    }
    generateRuleId(name) {
        return name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    }
    startEvaluation() {
        this.evaluationInterval = setInterval(() => {
            this.evaluateRules().catch(error => {
                logger_1.logger.error('Rule evaluation failed', error, {
                    service: 'alerting',
                    operation: 'evaluateRules'
                });
            });
        }, 60 * 1000);
        logger_1.logger.info('Alert rule evaluation started', {
            service: 'alerting',
            operation: 'startEvaluation'
        });
    }
    async evaluateRules() {
        const enabledRules = Array.from(this.alertRules.values()).filter(rule => rule.enabled);
        for (const rule of enabledRules) {
            try {
                const lastTriggered = this.cooldownTracker.get(rule.id);
                if (lastTriggered) {
                    const cooldownEnd = new Date(lastTriggered.getTime() + rule.cooldownMinutes * 60 * 1000);
                    if (new Date() < cooldownEnd) {
                        continue;
                    }
                }
                const shouldTrigger = await this.evaluateRule(rule);
                if (shouldTrigger) {
                    await this.triggerAlert(rule);
                }
            }
            catch (error) {
                logger_1.logger.error(`Failed to evaluate rule: ${rule.name}`, error, {
                    service: 'alerting',
                    operation: 'evaluateRule',
                    ruleId: rule.id
                });
            }
        }
    }
    async evaluateRule(rule) {
        const { condition } = rule;
        const timeWindowMs = (condition.timeWindow || 5) * 60 * 1000;
        const cutoffTime = new Date(Date.now() - timeWindowMs);
        try {
            let currentValue;
            switch (condition.metric) {
                case 'memory.heapUsed':
                    const memUsage = process.memoryUsage();
                    currentValue = memUsage.heapUsed / memUsage.heapTotal;
                    break;
                case 'api.errorRate':
                    const apiMetrics = monitoringService_1.monitoringService.getApiMetrics(undefined, condition.timeWindow || 1);
                    const totalRequests = apiMetrics.length;
                    const errorRequests = apiMetrics.filter(m => m.statusCode >= 400).length;
                    currentValue = totalRequests > 0 ? errorRequests / totalRequests : 0;
                    break;
                case 'api.responseTime':
                    const responseMetrics = monitoringService_1.monitoringService.getApiMetrics(undefined, condition.timeWindow || 1);
                    if (responseMetrics.length === 0)
                        return false;
                    currentValue = responseMetrics.reduce((sum, m) => sum + m.responseTime, 0) / responseMetrics.length;
                    break;
                case 'queue.waiting':
                case 'queue.failed':
                    const systemMetrics = await monitoringService_1.monitoringService.getSystemMetrics();
                    const queueField = condition.metric.split('.')[1];
                    currentValue = systemMetrics.queueStats[queueField];
                    break;
                case 'api.rateLimitViolations':
                    const rateLimitMetrics = monitoringService_1.monitoringService.getApiMetrics(undefined, condition.timeWindow || 1);
                    currentValue = rateLimitMetrics.filter(m => m.statusCode === 429).length;
                    break;
                case 'database.connected':
                    currentValue = 1;
                    break;
                default:
                    logger_1.logger.warn(`Unknown metric in alert rule: ${condition.metric}`, {
                        service: 'alerting',
                        operation: 'evaluateRule',
                        ruleId: rule.id
                    });
                    return false;
            }
            switch (condition.operator) {
                case '>':
                    return currentValue > condition.value;
                case '<':
                    return currentValue < condition.value;
                case '>=':
                    return currentValue >= condition.value;
                case '<=':
                    return currentValue <= condition.value;
                case '=':
                    return currentValue === condition.value;
                case '!=':
                    return currentValue !== condition.value;
                default:
                    return false;
            }
        }
        catch (error) {
            logger_1.logger.error(`Error evaluating rule condition: ${rule.name}`, error, {
                service: 'alerting',
                operation: 'evaluateRule',
                ruleId: rule.id,
                metric: condition.metric
            });
            return false;
        }
    }
    async triggerAlert(rule) {
        const notificationId = `${rule.id}-${Date.now()}`;
        const now = new Date();
        const notification = {
            id: notificationId,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Alert: ${rule.name} - ${rule.description}`,
            timestamp: now,
            acknowledged: false
        };
        this.notifications.set(notificationId, notification);
        this.cooldownTracker.set(rule.id, now);
        rule.lastTriggered = now;
        if (this.notifications.size > this.maxNotificationHistory) {
            const sortedNotifications = Array.from(this.notifications.entries())
                .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());
            this.notifications.clear();
            sortedNotifications.slice(0, this.maxNotificationHistory).forEach(([id, notif]) => {
                this.notifications.set(id, notif);
            });
        }
        logger_1.logger.error(`ALERT TRIGGERED: ${rule.name}`, undefined, {
            service: 'alerting',
            operation: 'triggerAlert',
            ruleId: rule.id,
            severity: rule.severity,
            notificationId
        });
        for (const action of rule.actions) {
            try {
                await this.executeAction(action, rule, notification);
            }
            catch (error) {
                logger_1.logger.error(`Failed to execute alert action: ${action.type}`, error, {
                    service: 'alerting',
                    operation: 'executeAction',
                    ruleId: rule.id,
                    actionType: action.type
                });
            }
        }
    }
    async executeAction(action, rule, notification) {
        switch (action.type) {
            case 'log':
                break;
            case 'email':
                logger_1.logger.info(`Email alert action (not implemented): ${rule.name}`, {
                    service: 'alerting',
                    operation: 'executeAction',
                    actionType: 'email',
                    ruleId: rule.id
                });
                break;
            case 'webhook':
                if (action.config.url) {
                    try {
                        await fetch(action.config.url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                alert: notification,
                                rule: {
                                    id: rule.id,
                                    name: rule.name,
                                    severity: rule.severity
                                },
                                timestamp: notification.timestamp.toISOString()
                            })
                        });
                        logger_1.logger.info(`Webhook alert sent: ${rule.name}`, {
                            service: 'alerting',
                            operation: 'executeAction',
                            actionType: 'webhook',
                            ruleId: rule.id,
                            webhookUrl: action.config.url
                        });
                    }
                    catch (error) {
                        logger_1.logger.error(`Webhook alert failed: ${rule.name}`, error, {
                            service: 'alerting',
                            operation: 'executeAction',
                            actionType: 'webhook',
                            ruleId: rule.id
                        });
                    }
                }
                break;
            case 'recovery':
                const recoveryAction = action.config.action;
                logger_1.logger.info(`Executing recovery action: ${recoveryAction}`, {
                    service: 'alerting',
                    operation: 'executeAction',
                    actionType: 'recovery',
                    ruleId: rule.id,
                    recoveryAction
                });
                break;
            default:
                logger_1.logger.warn(`Unknown alert action type: ${action.type}`, {
                    service: 'alerting',
                    operation: 'executeAction',
                    ruleId: rule.id
                });
        }
    }
    addRule(rule) {
        const alertRule = {
            ...rule,
            id: this.generateRuleId(rule.name),
            createdAt: new Date()
        };
        this.alertRules.set(alertRule.id, alertRule);
        logger_1.logger.info(`Alert rule added: ${rule.name}`, {
            service: 'alerting',
            operation: 'addRule',
            ruleId: alertRule.id
        });
        return alertRule.id;
    }
    updateRule(ruleId, updates) {
        const rule = this.alertRules.get(ruleId);
        if (!rule)
            return false;
        Object.assign(rule, updates);
        logger_1.logger.info(`Alert rule updated: ${rule.name}`, {
            service: 'alerting',
            operation: 'updateRule',
            ruleId
        });
        return true;
    }
    deleteRule(ruleId) {
        const deleted = this.alertRules.delete(ruleId);
        if (deleted) {
            logger_1.logger.info(`Alert rule deleted`, {
                service: 'alerting',
                operation: 'deleteRule',
                ruleId
            });
        }
        return deleted;
    }
    getRules() {
        return Array.from(this.alertRules.values());
    }
    getRule(ruleId) {
        return this.alertRules.get(ruleId);
    }
    acknowledgeNotification(notificationId, acknowledgedBy) {
        const notification = this.notifications.get(notificationId);
        if (!notification || notification.acknowledged)
            return false;
        notification.acknowledged = true;
        notification.acknowledgedAt = new Date();
        if (acknowledgedBy) {
            notification.acknowledgedBy = acknowledgedBy;
        }
        logger_1.logger.info(`Alert notification acknowledged`, {
            service: 'alerting',
            operation: 'acknowledgeNotification',
            notificationId,
            acknowledgedBy
        });
        return true;
    }
    getNotifications(acknowledged) {
        let notifications = Array.from(this.notifications.values());
        if (acknowledged !== undefined) {
            notifications = notifications.filter(n => n.acknowledged === acknowledged);
        }
        return notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    getAlertingStatus() {
        const rules = Array.from(this.alertRules.values());
        const notifications = Array.from(this.notifications.values());
        return {
            rulesCount: rules.length,
            enabledRules: rules.filter(r => r.enabled).length,
            notificationsCount: notifications.length,
            unacknowledgedNotifications: notifications.filter(n => !n.acknowledged).length
        };
    }
    shutdown() {
        if (this.evaluationInterval) {
            clearInterval(this.evaluationInterval);
            this.evaluationInterval = null;
        }
        logger_1.logger.info('Alerting service shutdown', {
            service: 'alerting',
            operation: 'shutdown'
        });
    }
}
exports.alertingService = new AlertingService();
//# sourceMappingURL=alertingService.js.map