// Authentication middleware for API access
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: string;
      };
    }
  }
}

// Simple user store (in production, this would be in a database)
interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'recruiter' | 'viewer';
  createdAt: Date;
  lastLogin?: Date;
}

// In-memory user store for MVP (replace with database in production)
const users: Map<string, User> = new Map();

// Initialize default admin user
const initializeDefaultUser = async () => {
  const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
  
  if (!users.has(defaultUsername)) {
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const defaultUser: User = {
      id: 'default-admin',
      username: defaultUsername,
      passwordHash,
      role: 'admin',
      createdAt: new Date()
    };
    users.set(defaultUsername, defaultUser);
    logger.info('Default admin user created', { username: defaultUsername });
  }
};

// Initialize default user on module load
initializeDefaultUser();

/**
 * Generate JWT token for user
 */
export const generateToken = (user: User): string => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };
  
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiration
  } as jwt.SignOptions);
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, config.auth.jwtSecret);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

/**
 * Authentication middleware
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): Response | void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);
    
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    
    logger.info('User authenticated', { 
      userId: req.user.id, 
      username: req.user.username,
      endpoint: req.path 
    });
    
    next();
  } catch (error) {
    logger.warn('Authentication failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Authorization middleware - check user role
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        endpoint: req.path
      });
      
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

/**
 * Login function
 */
export const login = async (username: string, password: string): Promise<{ user: User; token: string } | null> => {
  const user = users.get(username);
  
  if (!user) {
    logger.warn('Login attempt with invalid username', { username });
    return null;
  }
  
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  
  if (!isValidPassword) {
    logger.warn('Login attempt with invalid password', { username });
    return null;
  }
  
  // Update last login
  user.lastLogin = new Date();
  users.set(username, user);
  
  const token = generateToken(user);
  
  logger.info('User logged in successfully', { 
    userId: user.id, 
    username: user.username 
  });
  
  return { user, token };
};

/**
 * Create new user (admin only)
 */
export const createUser = async (userData: {
  username: string;
  password: string;
  role: 'admin' | 'recruiter' | 'viewer';
}): Promise<User> => {
  if (users.has(userData.username)) {
    throw new Error('Username already exists');
  }
  
  const passwordHash = await bcrypt.hash(userData.password, 10);
  const newUser: User = {
    id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    username: userData.username,
    passwordHash,
    role: userData.role,
    createdAt: new Date()
  };
  
  users.set(userData.username, newUser);
  
  logger.info('New user created', { 
    userId: newUser.id, 
    username: newUser.username, 
    role: newUser.role 
  });
  
  return newUser;
};

/**
 * Get all users (admin only)
 */
export const getAllUsers = () => {
  return Array.from(users.values()).map(user => ({
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin
  }));
};

/**
 * Delete user (admin only)
 */
export const deleteUser = (username: string): boolean => {
  if (username === 'admin') {
    throw new Error('Cannot delete default admin user');
  }
  
  const deleted = users.delete(username);
  
  if (deleted) {
    logger.info('User deleted', { username });
  }
  
  return deleted;
};