import { Request, Response, NextFunction } from 'express';
export interface AppError extends Error {
    statusCode?: number;
    isOperational?: boolean;
    service?: string;
    operation?: string;
}
export declare class CustomError extends Error implements AppError {
    statusCode: number;
    isOperational: boolean;
    service?: string;
    operation?: string;
    constructor(message: string, statusCode?: number, isOperational?: boolean, service?: string, operation?: string);
}
export declare const globalErrorHandler: (error: AppError, req: Request, res: Response, next: NextFunction) => void;
export declare const asyncHandler: (fn: Function) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requestTimeout: (timeoutMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requestId: (req: Request, res: Response, next: NextFunction) => void;
export declare const performanceMonitoring: (req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response, next: NextFunction) => void;
export declare const setupUnhandledRejectionHandler: () => void;
export declare const createDatabaseError: (message: string, operation: string) => CustomError;
export declare const createExternalApiError: (service: string, operation: string, message: string, statusCode?: number) => CustomError;
export declare const createValidationError: (message: string, operation: string) => CustomError;
export declare const createAuthenticationError: (message?: string) => CustomError;
export declare const createAuthorizationError: (message?: string) => CustomError;
//# sourceMappingURL=errorHandling.d.ts.map