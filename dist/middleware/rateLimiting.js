"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExternalAPILimit = exports.EXTERNAL_API_LIMITS = exports.externalAPILimiter = exports.exportRateLimit = exports.uploadRateLimit = exports.authRateLimit = exports.generalRateLimit = void 0;
const express_rate_limit_1 = __importStar(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
const rateLimitHandler = (req, res) => {
    logger_1.logger.warn('Rate limit exceeded', {
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.path,
        method: req.method,
        userId: req.user?.id || 'anonymous'
    });
    res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(60)
    });
};
exports.generalRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skip: (req) => {
        return req.path === '/api/health';
    }
});
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts. Please try again in 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    skipSuccessfulRequests: true
});
exports.uploadRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Too many file uploads. Please try again in an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler
});
exports.exportRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: {
        success: false,
        message: 'Too many export requests. Please try again in an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler,
    keyGenerator: (req) => {
        return req.user?.id || (0, express_rate_limit_1.ipKeyGenerator)(req);
    }
});
class ExternalAPIRateLimiter {
    constructor() {
        this.counters = new Map();
    }
    canMakeCall(service, maxCalls, windowMs) {
        const now = Date.now();
        const key = service;
        const counter = this.counters.get(key);
        if (!counter || now > counter.resetTime) {
            this.counters.set(key, { count: 1, resetTime: now + windowMs });
            return true;
        }
        if (counter.count >= maxCalls) {
            logger_1.logger.warn('External API rate limit reached', {
                service,
                count: counter.count,
                maxCalls,
                resetTime: new Date(counter.resetTime).toISOString()
            });
            return false;
        }
        counter.count++;
        this.counters.set(key, counter);
        return true;
    }
    getRemainingCalls(service, maxCalls) {
        const counter = this.counters.get(service);
        if (!counter || Date.now() > counter.resetTime) {
            return maxCalls;
        }
        return Math.max(0, maxCalls - counter.count);
    }
    getResetTime(service) {
        const counter = this.counters.get(service);
        if (!counter || Date.now() > counter.resetTime) {
            return null;
        }
        return new Date(counter.resetTime);
    }
}
exports.externalAPILimiter = new ExternalAPIRateLimiter();
exports.EXTERNAL_API_LIMITS = {
    gemini: { maxCalls: 1000, windowMs: 60 * 60 * 1000 },
    openai: { maxCalls: 500, windowMs: 60 * 60 * 1000 },
    claude: { maxCalls: 300, windowMs: 60 * 60 * 1000 },
    linkedin: { maxCalls: 100, windowMs: 60 * 60 * 1000 },
    github: { maxCalls: 5000, windowMs: 60 * 60 * 1000 },
    vapi: { maxCalls: 200, windowMs: 60 * 60 * 1000 }
};
const checkExternalAPILimit = (service) => {
    return (req, res, next) => {
        const limits = exports.EXTERNAL_API_LIMITS[service];
        if (!exports.externalAPILimiter.canMakeCall(service, limits.maxCalls, limits.windowMs)) {
            const resetTime = exports.externalAPILimiter.getResetTime(service);
            return res.status(429).json({
                success: false,
                message: `External service rate limit exceeded for ${service}. Please try again later.`,
                service,
                resetTime: resetTime?.toISOString()
            });
        }
        return next();
    };
};
exports.checkExternalAPILimit = checkExternalAPILimit;
//# sourceMappingURL=rateLimiting.js.map