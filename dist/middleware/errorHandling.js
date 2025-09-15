"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthorizationError = exports.createAuthenticationError = exports.createValidationError = exports.createExternalApiError = exports.createDatabaseError = exports.setupUnhandledRejectionHandler = exports.notFoundHandler = exports.performanceMonitoring = exports.requestId = exports.requestTimeout = exports.asyncHandler = exports.globalErrorHandler = exports.CustomError = void 0;
const logger_1 = require("../utils/logger");
const monitoringService_1 = require("../services/monitoringService");
const errorRecoveryService_1 = require("../services/errorRecoveryService");
class CustomError extends Error {
    constructor(message, statusCode = 500, isOperational = true, service, operation) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        if (service)
            this.service = service;
        if (operation)
            this.operation = operation;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.CustomError = CustomError;
function classifyError(error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();
    if (name.includes('mongo') || message.includes('database') || message.includes('connection')) {
        return {
            type: 'DatabaseError',
            severity: 'high',
            isRetryable: true
        };
    }
    if (name.includes('fetch') || message.includes('network') || message.includes('timeout')) {
        return {
            type: 'NetworkError',
            severity: 'medium',
            isRetryable: true
        };
    }
    if (message.includes('rate limit') || message.includes('429')) {
        return {
            type: 'RateLimitError',
            severity: 'medium',
            isRetryable: true
        };
    }
    if (message.includes('unauthorized') || message.includes('authentication')) {
        return {
            type: 'AuthenticationError',
            severity: 'medium',
            isRetryable: false
        };
    }
    if (message.includes('validation') || message.includes('invalid')) {
        return {
            type: 'ValidationError',
            severity: 'low',
            isRetryable: false
        };
    }
    if (message.includes('file') || message.includes('parse') || message.includes('corrupt')) {
        return {
            type: 'FileProcessingError',
            severity: 'low',
            isRetryable: false
        };
    }
    return {
        type: 'UnknownError',
        severity: 'medium',
        isRetryable: false
    };
}
const globalErrorHandler = (error, req, res, next) => {
    const startTime = Date.now();
    try {
        const classification = classifyError(error);
        const service = error.service || 'unknown';
        const operation = error.operation || req.path.split('/').pop() || 'unknown';
        const statusCode = error.statusCode || 500;
        logger_1.logger.error('Request error occurred', error, {
            service,
            operation,
            statusCode,
            method: req.method,
            path: req.path,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id,
            requestId: req.requestId,
            errorType: classification.type,
            severity: classification.severity,
            isRetryable: classification.isRetryable
        });
        if (error.service && error.operation && classification.isRetryable) {
            errorRecoveryService_1.errorRecoveryService.recordFailure(error.service, error.operation, classification.type, error);
        }
        if (classification.severity === 'critical' || statusCode >= 500) {
            monitoringService_1.monitoringService.createAlert('error', service, `${classification.type}: ${error.message}`, {
                statusCode,
                path: req.path,
                method: req.method,
                errorType: classification.type,
                stack: error.stack
            });
        }
        const duration = Date.now() - startTime;
        logger_1.logger.apiRequest(req.method, req.path, statusCode, duration, {
            service,
            operation,
            errorType: classification.type,
            severity: classification.severity
        });
        const isDevelopment = process.env.NODE_ENV === 'development';
        const isOperational = error.isOperational !== false;
        let responseBody = {
            success: false,
            error: {
                message: isOperational ? error.message : 'Internal server error',
                type: classification.type,
                timestamp: new Date().toISOString()
            }
        };
        if (isDevelopment) {
            responseBody.error.stack = error.stack;
            responseBody.error.details = {
                service,
                operation,
                severity: classification.severity,
                isRetryable: classification.isRetryable
            };
        }
        if (req.requestId) {
            responseBody.error.requestId = req.requestId;
        }
        res.status(statusCode).json(responseBody);
    }
    catch (handlerError) {
        logger_1.logger.error('Error handler failed', handlerError, {
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
exports.globalErrorHandler = globalErrorHandler;
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
const requestTimeout = (timeoutMs = 30000) => {
    return (req, res, next) => {
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                const error = new CustomError(`Request timeout after ${timeoutMs}ms`, 408, true, 'middleware', 'requestTimeout');
                next(error);
            }
        }, timeoutMs);
        res.on('finish', () => clearTimeout(timeout));
        res.on('close', () => clearTimeout(timeout));
        next();
    };
};
exports.requestTimeout = requestTimeout;
const requestId = (req, res, next) => {
    const id = req.get('X-Request-ID') ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = id;
    res.set('X-Request-ID', id);
    next();
};
exports.requestId = requestId;
const performanceMonitoring = (req, res, next) => {
    const startTime = Date.now();
    const originalEnd = res.end.bind(res);
    res.end = function (chunk, encoding) {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        monitoringService_1.monitoringService.recordApiUsage({
            service: 'api',
            endpoint: req.path,
            method: req.method,
            statusCode,
            responseTime: duration
        });
        logger_1.logger.performance(`${req.method} ${req.path}`, duration, statusCode < 400, {
            service: 'api',
            operation: req.path.split('/').pop() || 'unknown',
            method: req.method,
            statusCode,
            userId: req.user?.id,
            requestId: req.requestId
        });
        return originalEnd(chunk, encoding);
    };
    next();
};
exports.performanceMonitoring = performanceMonitoring;
const notFoundHandler = (req, res, next) => {
    const error = new CustomError(`Route not found: ${req.method} ${req.path}`, 404, true, 'router', 'notFound');
    next(error);
};
exports.notFoundHandler = notFoundHandler;
const setupUnhandledRejectionHandler = () => {
    process.on('unhandledRejection', (reason, promise) => {
        logger_1.logger.error('Unhandled Promise Rejection', reason, {
            service: 'process',
            operation: 'unhandledRejection',
            promise: promise.toString()
        });
        monitoringService_1.monitoringService.createAlert('error', 'process', 'Unhandled Promise Rejection detected', {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined
        });
    });
    process.on('uncaughtException', (error) => {
        logger_1.logger.error('Uncaught Exception', error, {
            service: 'process',
            operation: 'uncaughtException'
        });
        monitoringService_1.monitoringService.createAlert('error', 'process', 'Uncaught Exception detected', {
            message: error.message,
            stack: error.stack
        });
        process.exit(1);
    });
};
exports.setupUnhandledRejectionHandler = setupUnhandledRejectionHandler;
const createDatabaseError = (message, operation) => {
    return new CustomError(message, 500, true, 'database', operation);
};
exports.createDatabaseError = createDatabaseError;
const createExternalApiError = (service, operation, message, statusCode = 500) => {
    return new CustomError(message, statusCode, true, service, operation);
};
exports.createExternalApiError = createExternalApiError;
const createValidationError = (message, operation) => {
    return new CustomError(message, 400, true, 'validation', operation);
};
exports.createValidationError = createValidationError;
const createAuthenticationError = (message = 'Authentication required') => {
    return new CustomError(message, 401, true, 'auth', 'authenticate');
};
exports.createAuthenticationError = createAuthenticationError;
const createAuthorizationError = (message = 'Insufficient permissions') => {
    return new CustomError(message, 403, true, 'auth', 'authorize');
};
exports.createAuthorizationError = createAuthorizationError;
//# sourceMappingURL=errorHandling.js.map