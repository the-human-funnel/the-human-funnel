import { Request, Response } from 'express';
export declare const generalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const uploadRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const exportRateLimit: import("express-rate-limit").RateLimitRequestHandler;
declare class ExternalAPIRateLimiter {
    private counters;
    canMakeCall(service: string, maxCalls: number, windowMs: number): boolean;
    getRemainingCalls(service: string, maxCalls: number): number;
    getResetTime(service: string): Date | null;
}
export declare const externalAPILimiter: ExternalAPIRateLimiter;
export declare const EXTERNAL_API_LIMITS: {
    gemini: {
        maxCalls: number;
        windowMs: number;
    };
    openai: {
        maxCalls: number;
        windowMs: number;
    };
    claude: {
        maxCalls: number;
        windowMs: number;
    };
    linkedin: {
        maxCalls: number;
        windowMs: number;
    };
    github: {
        maxCalls: number;
        windowMs: number;
    };
    vapi: {
        maxCalls: number;
        windowMs: number;
    };
};
export declare const checkExternalAPILimit: (service: keyof typeof EXTERNAL_API_LIMITS) => (req: Request, res: Response, next: Function) => any;
export {};
//# sourceMappingURL=rateLimiting.d.ts.map