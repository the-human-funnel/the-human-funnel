// Rate limiting middleware for API endpoints and external service calls
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom rate limit handler with logging
 */
const rateLimitHandler = (req: Request, res: Response) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    endpoint: req.path,
    method: req.method,
    userId: req.user?.id
  });
  
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    retryAfter: Math.ceil(60) // 1 minute
  });
};

/**
 * General API rate limiter - 100 requests per 15 minutes per IP
 */
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: rateLimitHandler,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

/**
 * Strict rate limiter for authentication endpoints - 5 attempts per 15 minutes per IP
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true // Don't count successful requests
});

/**
 * Upload rate limiter - 10 uploads per hour per IP
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: {
    success: false,
    message: 'Too many file uploads. Please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
});

/**
 * Export rate limiter - 20 exports per hour per user
 */
export const exportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each user to 20 exports per hour
  message: {
    success: false,
    message: 'Too many export requests. Please try again in an hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise fall back to IP with proper IPv6 handling
    return req.user?.id || ipKeyGenerator(req as any);
  }
});

/**
 * External API rate limiter tracker
 * Tracks and limits calls to external services to prevent hitting their rate limits
 */
class ExternalAPIRateLimiter {
  private counters: Map<string, { count: number; resetTime: number }> = new Map();
  
  /**
   * Check if we can make a call to an external service
   */
  canMakeCall(service: string, maxCalls: number, windowMs: number): boolean {
    const now = Date.now();
    const key = service;
    const counter = this.counters.get(key);
    
    if (!counter || now > counter.resetTime) {
      // Reset counter
      this.counters.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (counter.count >= maxCalls) {
      logger.warn('External API rate limit reached', {
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
  
  /**
   * Get remaining calls for a service
   */
  getRemainingCalls(service: string, maxCalls: number): number {
    const counter = this.counters.get(service);
    if (!counter || Date.now() > counter.resetTime) {
      return maxCalls;
    }
    return Math.max(0, maxCalls - counter.count);
  }
  
  /**
   * Get reset time for a service
   */
  getResetTime(service: string): Date | null {
    const counter = this.counters.get(service);
    if (!counter || Date.now() > counter.resetTime) {
      return null;
    }
    return new Date(counter.resetTime);
  }
}

// Create singleton instance
export const externalAPILimiter = new ExternalAPIRateLimiter();

/**
 * Rate limits for external services (calls per hour)
 */
export const EXTERNAL_API_LIMITS = {
  gemini: { maxCalls: 1000, windowMs: 60 * 60 * 1000 }, // 1000 calls per hour
  openai: { maxCalls: 500, windowMs: 60 * 60 * 1000 },  // 500 calls per hour
  claude: { maxCalls: 300, windowMs: 60 * 60 * 1000 },  // 300 calls per hour
  linkedin: { maxCalls: 100, windowMs: 60 * 60 * 1000 }, // 100 calls per hour
  github: { maxCalls: 5000, windowMs: 60 * 60 * 1000 },  // 5000 calls per hour (GitHub's limit)
  vapi: { maxCalls: 200, windowMs: 60 * 60 * 1000 }      // 200 calls per hour
};

/**
 * Middleware to check external API rate limits
 */
export const checkExternalAPILimit = (service: keyof typeof EXTERNAL_API_LIMITS) => {
  return (req: Request, res: Response, next: Function) => {
    const limits = EXTERNAL_API_LIMITS[service];
    
    if (!externalAPILimiter.canMakeCall(service, limits.maxCalls, limits.windowMs)) {
      const resetTime = externalAPILimiter.getResetTime(service);
      
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