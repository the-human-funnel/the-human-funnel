// Audit log routes for system monitoring
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { 
  getAuditLogs, 
  getAuditLogStats 
} from '../middleware/auditLog';
import { 
  sanitizeInput,
  validatePaginationQuery,
  handleValidationErrors
} from '../middleware/validation';
import { query } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Validation rules for audit log queries
 */
const validateAuditLogQuery = [
  query('userId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('User ID must be between 1 and 100 characters'),
  query('action')
    .optional()
    .isIn(['READ', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'UPLOAD', 'PROCESS', 'ANALYZE', 'SEARCH', 'HEALTH_CHECK'])
    .withMessage('Invalid action type'),
  query('resource')
    .optional()
    .isIn(['JOB_PROFILE', 'CANDIDATE', 'RESUME', 'AI_ANALYSIS', 'LINKEDIN_ANALYSIS', 'GITHUB_ANALYSIS', 'INTERVIEW', 'SCORING', 'REPORT', 'QUEUE', 'USER', 'AUTH', 'SYSTEM', 'SECURITY'])
    .withMessage('Invalid resource type'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('success')
    .optional()
    .isBoolean()
    .withMessage('Success must be a boolean value'),
  handleValidationErrors
];

/**
 * GET /audit/logs
 * Get audit logs with filtering and pagination (admin only)
 */
router.get('/logs',
  authenticate,
  authorize(['admin']),
  sanitizeInput,
  validatePaginationQuery,
  validateAuditLogQuery,
  (req: Request, res: Response) => {
    try {
      const filters: any = {
        userId: req.query.userId as string,
        action: req.query.action as string,
        resource: req.query.resource as string,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        success: req.query.success ? req.query.success === 'true' : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50
      };
      
      const result = getAuditLogs(filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get audit logs error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.username,
        filters: req.query
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit logs'
      });
    }
  }
);

/**
 * GET /audit/stats
 * Get audit log statistics (admin only)
 */
router.get('/stats',
  authenticate,
  authorize(['admin']),
  (req: Request, res: Response) => {
    try {
      const stats = getAuditLogStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get audit stats error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.username
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve audit statistics'
      });
    }
  }
);

/**
 * GET /audit/security-events
 * Get recent security events (admin only)
 */
router.get('/security-events',
  authenticate,
  authorize(['admin']),
  sanitizeInput,
  validatePaginationQuery,
  (req: Request, res: Response) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      // Get security-related audit logs
      const securityFilters = {
        resource: 'SECURITY',
        page,
        limit
      };
      
      const result = getAuditLogs(securityFilters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get security events error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.username
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve security events'
      });
    }
  }
);

/**
 * GET /audit/user-activity/:userId
 * Get activity logs for a specific user (admin only)
 */
router.get('/user-activity/:userId',
  authenticate,
  authorize(['admin']),
  sanitizeInput,
  validatePaginationQuery,
  (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const filters: any = {
        userId,
        page,
        limit
      };
      
      const result = getAuditLogs(filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get user activity error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.username,
        targetUserId: req.params.userId
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user activity'
      });
    }
  }
);

/**
 * GET /audit/failed-requests
 * Get recent failed requests for troubleshooting (admin only)
 */
router.get('/failed-requests',
  authenticate,
  authorize(['admin']),
  sanitizeInput,
  validatePaginationQuery,
  (req: Request, res: Response) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      // Get failed requests from last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const filters = {
        success: false,
        startDate: oneDayAgo,
        page,
        limit
      };
      
      const result = getAuditLogs(filters);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get failed requests error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.username
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve failed requests'
      });
    }
  }
);

export default router;