// Authentication routes
import { Router, Request, Response } from 'express';
import { 
  login, 
  createUser, 
  getAllUsers, 
  deleteUser,
  authenticate,
  authorize
} from '../middleware/auth';
import { 
  validateLogin, 
  validateCreateUser, 
  sanitizeInput,
  handleValidationErrors
} from '../middleware/validation';
import { authRateLimit } from '../middleware/rateLimiting';
import { logSecurityEvent } from '../middleware/auditLog';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', 
  authRateLimit,
  sanitizeInput,
  validateLogin,
  async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      const result = await login(username, password);
      
      if (!result) {
        logSecurityEvent('LOGIN_FAILURE', req, { username });
        
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }
      
      logSecurityEvent('LOGIN_SUCCESS', req, { 
        userId: result.user.id,
        username: result.user.username 
      });
      
      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          token: result.token,
          user: {
            id: result.user.id,
            username: result.user.username,
            role: result.user.role,
            lastLogin: result.user.lastLogin
          }
        }
      });
    } catch (error) {
      logger.error('Login error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        username: req.body.username,
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

/**
 * POST /auth/users
 * Create new user (admin only)
 */
router.post('/users',
  authenticate,
  authorize(['admin']),
  sanitizeInput,
  validateCreateUser,
  async (req: Request, res: Response) => {
    try {
      const { username, password, role } = req.body;
      
      const newUser = await createUser({ username, password, role });
      
      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          user: {
            id: newUser.id,
            username: newUser.username,
            role: newUser.role,
            createdAt: newUser.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('User creation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedUsername: req.body.username,
        createdBy: req.user?.username
      });
      
      if (error instanceof Error && error.message === 'Username already exists') {
        return res.status(409).json({
          success: false,
          message: 'Username already exists'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to create user'
      });
    }
  }
);

/**
 * GET /auth/users
 * Get all users (admin only)
 */
router.get('/users',
  authenticate,
  authorize(['admin']),
  (req: Request, res: Response) => {
    try {
      const users = getAllUsers();
      
      res.json({
        success: true,
        data: {
          users,
          total: users.length
        }
      });
    } catch (error) {
      logger.error('Get users error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.username
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
      });
    }
  }
);

/**
 * DELETE /auth/users/:username
 * Delete user (admin only)
 */
router.delete('/users/:username',
  authenticate,
  authorize(['admin']),
  sanitizeInput,
  async (req: Request, res: Response) => {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({
          success: false,
          message: 'Username is required'
        });
      }
      
      const deleted = deleteUser(username);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      return res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.error('User deletion error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetUsername: req.params.username,
        deletedBy: req.user?.username
      });
      
      if (error instanceof Error && error.message === 'Cannot delete default admin user') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete default admin user'
        });
      }
      
      return res.status(500).json({
        success: false,
        message: 'Failed to delete user'
      });
    }
  }
);

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me',
  authenticate,
  (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  }
);

/**
 * POST /auth/logout
 * Logout user (client-side token removal, server-side logging)
 */
router.post('/logout',
  authenticate,
  (req: Request, res: Response) => {
    logger.info('User logged out', {
      userId: req.user?.id,
      username: req.user?.username
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
);

export default router;