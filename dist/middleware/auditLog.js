"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuditLogStats = exports.getAuditLogs = exports.logSecurityEvent = exports.auditLog = void 0;
const logger_1 = require("../utils/logger");
const auditLogs = [];
const MAX_AUDIT_LOGS = 10000;
const addAuditLog = (entry) => {
    auditLogs.push(entry);
    if (auditLogs.length > MAX_AUDIT_LOGS) {
        auditLogs.splice(0, auditLogs.length - MAX_AUDIT_LOGS);
    }
    logger_1.logger.info('Audit log entry', {
        service: 'audit',
        operation: 'logEntry',
        userId: entry.userId,
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode || 200,
        duration: entry.duration || 0
    });
};
const getActionType = (method, path) => {
    const normalizedPath = path.toLowerCase();
    switch (method.toUpperCase()) {
        case 'GET':
            if (normalizedPath.includes('/export'))
                return 'EXPORT';
            if (normalizedPath.includes('/search'))
                return 'SEARCH';
            if (normalizedPath.includes('/health'))
                return 'HEALTH_CHECK';
            return 'READ';
        case 'POST':
            if (normalizedPath.includes('/login'))
                return 'LOGIN';
            if (normalizedPath.includes('/upload'))
                return 'UPLOAD';
            if (normalizedPath.includes('/process'))
                return 'PROCESS';
            if (normalizedPath.includes('/analyze'))
                return 'ANALYZE';
            return 'CREATE';
        case 'PUT':
        case 'PATCH':
            return 'UPDATE';
        case 'DELETE':
            return 'DELETE';
        default:
            return 'UNKNOWN';
    }
};
const getResourceType = (path) => {
    const normalizedPath = path.toLowerCase();
    if (normalizedPath.includes('/job-profile'))
        return 'JOB_PROFILE';
    if (normalizedPath.includes('/candidate'))
        return 'CANDIDATE';
    if (normalizedPath.includes('/resume'))
        return 'RESUME';
    if (normalizedPath.includes('/ai-analysis'))
        return 'AI_ANALYSIS';
    if (normalizedPath.includes('/linkedin'))
        return 'LINKEDIN_ANALYSIS';
    if (normalizedPath.includes('/github'))
        return 'GITHUB_ANALYSIS';
    if (normalizedPath.includes('/interview'))
        return 'INTERVIEW';
    if (normalizedPath.includes('/scoring'))
        return 'SCORING';
    if (normalizedPath.includes('/report'))
        return 'REPORT';
    if (normalizedPath.includes('/queue'))
        return 'QUEUE';
    if (normalizedPath.includes('/user'))
        return 'USER';
    if (normalizedPath.includes('/auth'))
        return 'AUTH';
    return 'SYSTEM';
};
const extractResourceId = (req) => {
    if (!req.params)
        return undefined;
    const { id, candidateId, jobProfileId, batchId, userId } = req.params;
    return id || candidateId || jobProfileId || batchId || userId;
};
const auditLog = (req, res, next) => {
    const startTime = Date.now();
    const originalJson = res.json;
    let responseBody;
    res.json = function (body) {
        responseBody = body;
        return originalJson.call(this, body);
    };
    const originalEnd = res.end;
    res.end = function (...args) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const auditEntry = {
            timestamp: new Date(startTime),
            userId: req.user?.id,
            username: req.user?.username,
            action: getActionType(req.method, req.path),
            resource: getResourceType(req.path),
            resourceId: extractResourceId(req),
            method: req.method,
            path: req.path,
            ip: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent'),
            statusCode: res.statusCode,
            duration,
            success: res.statusCode >= 200 && res.statusCode < 400,
            details: {
                query: Object.keys(req.query).length > 0 ? req.query : undefined,
                bodySize: req.get('Content-Length') ? parseInt(req.get('Content-Length')) : undefined,
                responseSize: res.get('Content-Length') ? parseInt(res.get('Content-Length')) : undefined
            }
        };
        if (!auditEntry.success && responseBody) {
            auditEntry.error = responseBody.message || responseBody.error || 'Unknown error';
        }
        addAuditLog(auditEntry);
        return originalEnd.apply(this, args);
    };
    next();
};
exports.auditLog = auditLog;
const logSecurityEvent = (eventType, req, details) => {
    const securityEntry = {
        timestamp: new Date(),
        userId: req.user?.id,
        username: req.user?.username,
        action: eventType,
        resource: 'SECURITY',
        resourceId: undefined,
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        statusCode: undefined,
        duration: undefined,
        success: eventType === 'LOGIN_SUCCESS',
        details
    };
    addAuditLog(securityEntry);
};
exports.logSecurityEvent = logSecurityEvent;
const getAuditLogs = (filters) => {
    let filteredLogs = [...auditLogs];
    if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }
    if (filters.action) {
        filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }
    if (filters.resource) {
        filteredLogs = filteredLogs.filter(log => log.resource === filters.resource);
    }
    if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate);
    }
    if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate);
    }
    if (filters.success !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.success === filters.success);
    }
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);
    return {
        logs: paginatedLogs,
        total: filteredLogs.length,
        page,
        limit
    };
};
exports.getAuditLogs = getAuditLogs;
const getAuditLogStats = () => {
    const totalLogs = auditLogs.length;
    const successfulLogs = auditLogs.filter(log => log.success).length;
    const successRate = totalLogs > 0 ? (successfulLogs / totalLogs) * 100 : 0;
    const actionCounts = new Map();
    auditLogs.forEach(log => {
        actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
    });
    const resourceCounts = new Map();
    auditLogs.forEach(log => {
        resourceCounts.set(log.resource, (resourceCounts.get(log.resource) || 0) + 1);
    });
    const userCounts = new Map();
    auditLogs.forEach(log => {
        if (log.userId) {
            const existing = userCounts.get(log.userId) || { username: undefined, count: 0 };
            userCounts.set(log.userId, {
                username: log.username || existing.username,
                count: existing.count + 1
            });
        }
    });
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFailures = auditLogs
        .filter(log => !log.success && log.timestamp >= oneDayAgo)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10);
    return {
        totalLogs,
        successRate: Math.round(successRate * 100) / 100,
        topActions: Array.from(actionCounts.entries())
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        topResources: Array.from(resourceCounts.entries())
            .map(([resource, count]) => ({ resource, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        topUsers: Array.from(userCounts.entries())
            .map(([userId, data]) => ({ userId, username: data.username, count: data.count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
        recentFailures
    };
};
exports.getAuditLogStats = getAuditLogStats;
//# sourceMappingURL=auditLog.js.map