import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { monitoringService } from '../services/monitoringService';
import { errorRecoveryService } from '../services/errorRecoveryService';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  service?: string;
  operation?: string;
}

// Create custom error class
export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public service?: string;
  public operation?: string;

  constructor(
    message: string, 
    statusCode: number = 500, 
    isOperational: boolean = true,
    service?: string,
    operation?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (service) this.service = service;
    if (operation) this.operation = operation;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error classification helper
function classifyError(error: Error): {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
} {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  
  // Database errors
  if (name.includes('mongo') || message.includes('database') || message.includes('connection')) {
    return {
      type: 'DatabaseError',
      severity: 'high',
      isRetryable: true
    };
  }
  
  // Network/API errors
  if (name.includes('fetch') || message.includes('network') || message.includes('timeout')) {
    return {
      type: 'NetworkError',
      severity: 'medium',
      isRetryable: true
    };
  }
  
  // Rate limit errors
  if (message.includes('rate limit') || message.includes('429')) {
    return {
      type: 'RateLimitError',
      severity: 'medium',
      isRetryable: true
    };
  }
  
  // Authentication errors
  if (message.includes('unauthorized') || message.includes('authentication')) {
    return {
      type: 'AuthenticationError',
      severity: 'medium',
      isRetryable: false
    };
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid')) {
    return {
      type: 'ValidationError',
      severity: 'low',
      isRetryable: false
    };
  }
  
  // File processing errors
  if (message.includes('file') || message.includes('parse') || message.includes('corrupt')) {
    return {
      type: 'FileProcessingError',
      severity: 'low',
      isRetryable: false
    };
  }
  
  // Default classification
  return {
    type: 'UnknownError',
    severity: 'medium',
    isRetryable: false
  };
}

// Global error handler middleware
export const globalErrorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  
  try {
    // Classify the error
    const classification = classifyError(error);
    
    // Extract context information
    const service = error.service || 'unknown';
    const operation = error.operation || req.path.split('/').pop() || 'unknown';
    const statusCode = error.statusCode || 500;
    
    // Log the error with context
    logger.error('Request error occurred', error, {
      service,
      operation,
      statusCode,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
      requestId: (req as any).requestId,
      errorType: classification.type,
      severity: classification.severity,
      isRetryable: classification.isRetryable
    });
    
    // Record failure for error recovery if it's a service error
    if (error.service && error.operation && classification.isRetryable) {
      errorRecoveryService.recordFailure(
        error.service,
        error.operation,
        classification.type,
        error
      );
    }
    
    // Create monitoring alert for critical errors
    if (classification.severity === 'critical' || statusCode >= 500) {
      monitoringService.createAlert(
        'error',
        service,
        `${classification.type}: ${error.message}`,
        {
          statusCode,
          path: req.path,
          method: req.method,
          errorType: classification.type,
          stack: error.stack
        }
      );
    }
    
    // Log API request metrics
    const duration = Date.now() - startTime;
    logger.apiRequest(req.method, req.path, statusCode, duration, {
      service,
      operation,
      errorType: classification.type,
      severity: classification.severity
    });
    
    // Determine response based on environment and error type
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isOperational = error.isOperational !== false;
    
    let responseBody: any = {
      success: false,
      error: {
        message: isOperational ? error.message : 'Internal server error',
        type: classification.type,
        timestamp: new Date().toISOString()
      }
    };
    
    // Add additional details in development
    if (isDevelopment) {
      responseBody.error.stack = error.stack;
      responseBody.error.details = {
        service,
        operation,
        severity: classification.severity,
        isRetryable: classification.isRetryable
      };
    }
    
    // Add request ID if available
    if ((req as any).requestId) {
      responseBody.error.requestId = (req as any).requestId;
    }
    
    // Send error response
    res.status(statusCode).json(responseBody);
    
  } catch (handlerError) {
    // If error handler itself fails, log it and send minimal response
    logger.error('Error handler failed', handlerError, {
      service: 'errorHandler',
      operation: 'globalErrorHandler',
      originalError: error.message
    });
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        const error = new CustomError(
          `Request timeout after ${timeoutMs}ms`,
          408,
          true,
          'middleware',
          'requestTimeout'
        );
        next(error);
      }
    }, timeoutMs);
    
    // Clear timeout when response is finished
    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));
    
    next();
  };
};

// Request ID middleware for tracking
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = req.get('X-Request-ID') || 
             `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  (req as any).requestId = id;
  res.set('X-Request-ID', id);
  
  next();
};

// Performance monitoring middleware
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Record API usage metrics
    monitoringService.recordApiUsage({
      service: 'api',
      endpoint: req.path,
      method: req.method,
      statusCode,
      responseTime: duration
    });
    
    // Log performance metrics
    logger.performance(
      `${req.method} ${req.path}`,
      duration,
      statusCode < 400,
      {
        service: 'api',
        operation: req.path.split('/').pop() || 'unknown',
        method: req.method,
        statusCode,
        userId: (req as any).user?.id,
        requestId: (req as any).requestId
      }
    );
    
    // Call original end method
    return originalEnd(chunk, encoding);
  } as any;
  
  next();
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new CustomError(
    `Route not found: ${req.method} ${req.path}`,
    404,
    true,
    'router',
    'notFound'
  );
  next(error);
};

// Unhandled promise rejection handler
export const setupUnhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection', reason, {
      service: 'process',
      operation: 'unhandledRejection',
      promise: promise.toString()
    });
    
    // Create critical alert
    monitoringService.createAlert(
      'error',
      'process',
      'Unhandled Promise Rejection detected',
      {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined
      }
    );
  });
  
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', error, {
      service: 'process',
      operation: 'uncaughtException'
    });
    
    // Create critical alert
    monitoringService.createAlert(
      'error',
      'process',
      'Uncaught Exception detected',
      {
        message: error.message,
        stack: error.stack
      }
    );
    
    // Exit process after logging
    process.exit(1);
  });
};

// Service-specific error creators
export const createDatabaseError = (message: string, operation: string) => {
  return new CustomError(message, 500, true, 'database', operation);
};

export const createExternalApiError = (service: string, operation: string, message: string, statusCode: number = 500) => {
  return new CustomError(message, statusCode, true, service, operation);
};

export const createValidationError = (message: string, operation: string) => {
  return new CustomError(message, 400, true, 'validation', operation);
};

export const createAuthenticationError = (message: string = 'Authentication required') => {
  return new CustomError(message, 401, true, 'auth', 'authenticate');
};

export const createAuthorizationError = (message: string = 'Insufficient permissions') => {
  return new CustomError(message, 403, true, 'auth', 'authorize');
};