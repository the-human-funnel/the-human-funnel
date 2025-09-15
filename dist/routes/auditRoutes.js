"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const auditLog_1 = require("../middleware/auditLog");
const validation_1 = require("../middleware/validation");
const express_validator_1 = require("express-validator");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const validateAuditLogQuery = [
    (0, express_validator_1.query)('userId')
        .optional()
        .isLength({ min: 1, max: 100 })
        .withMessage('User ID must be between 1 and 100 characters'),
    (0, express_validator_1.query)('action')
        .optional()
        .isIn(['READ', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'UPLOAD', 'PROCESS', 'ANALYZE', 'SEARCH', 'HEALTH_CHECK'])
        .withMessage('Invalid action type'),
    (0, express_validator_1.query)('resource')
        .optional()
        .isIn(['JOB_PROFILE', 'CANDIDATE', 'RESUME', 'AI_ANALYSIS', 'LINKEDIN_ANALYSIS', 'GITHUB_ANALYSIS', 'INTERVIEW', 'SCORING', 'REPORT', 'QUEUE', 'USER', 'AUTH', 'SYSTEM', 'SECURITY'])
        .withMessage('Invalid resource type'),
    (0, express_validator_1.query)('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid ISO 8601 date'),
    (0, express_validator_1.query)('success')
        .optional()
        .isBoolean()
        .withMessage('Success must be a boolean value'),
    validation_1.handleValidationErrors
];
router.get('/logs', auth_1.authenticate, (0, auth_1.authorize)(['admin']), validation_1.sanitizeInput, validation_1.validatePaginationQuery, validateAuditLogQuery, (req, res) => {
    try {
        const filters = {
            userId: req.query.userId,
            action: req.query.action,
            resource: req.query.resource,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
            success: req.query.success ? req.query.success === 'true' : undefined,
            page: req.query.page ? parseInt(req.query.page) : 1,
            limit: req.query.limit ? parseInt(req.query.limit) : 50
        };
        const result = (0, auditLog_1.getAuditLogs)(filters);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Get audit logs error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestedBy: req.user?.username,
            filters: req.query
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve audit logs'
        });
    }
});
router.get('/stats', auth_1.authenticate, (0, auth_1.authorize)(['admin']), (req, res) => {
    try {
        const stats = (0, auditLog_1.getAuditLogStats)();
        res.json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        logger_1.logger.error('Get audit stats error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestedBy: req.user?.username
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve audit statistics'
        });
    }
});
router.get('/security-events', auth_1.authenticate, (0, auth_1.authorize)(['admin']), validation_1.sanitizeInput, validation_1.validatePaginationQuery, (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const securityFilters = {
            resource: 'SECURITY',
            page,
            limit
        };
        const result = (0, auditLog_1.getAuditLogs)(securityFilters);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Get security events error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestedBy: req.user?.username
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve security events'
        });
    }
});
router.get('/user-activity/:userId', auth_1.authenticate, (0, auth_1.authorize)(['admin']), validation_1.sanitizeInput, validation_1.validatePaginationQuery, (req, res) => {
    try {
        const { userId } = req.params;
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const filters = {
            userId,
            page,
            limit
        };
        const result = (0, auditLog_1.getAuditLogs)(filters);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Get user activity error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestedBy: req.user?.username,
            targetUserId: req.params.userId
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve user activity'
        });
    }
});
router.get('/failed-requests', auth_1.authenticate, (0, auth_1.authorize)(['admin']), validation_1.sanitizeInput, validation_1.validatePaginationQuery, (req, res) => {
    try {
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const filters = {
            success: false,
            startDate: oneDayAgo,
            page,
            limit
        };
        const result = (0, auditLog_1.getAuditLogs)(filters);
        res.json({
            success: true,
            data: result
        });
    }
    catch (error) {
        logger_1.logger.error('Get failed requests error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestedBy: req.user?.username
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve failed requests'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auditRoutes.js.map