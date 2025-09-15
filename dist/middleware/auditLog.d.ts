import { Request, Response, NextFunction } from 'express';
interface AuditLogEntry {
    timestamp: Date;
    userId: string | undefined;
    username: string | undefined;
    action: string;
    resource: string;
    resourceId: string | undefined;
    method: string;
    path: string;
    ip: string;
    userAgent: string | undefined;
    statusCode: number | undefined;
    duration: number | undefined;
    success: boolean;
    details?: any;
    error?: string;
}
export declare const auditLog: (req: Request, res: Response, next: NextFunction) => void;
export declare const logSecurityEvent: (eventType: "LOGIN_SUCCESS" | "LOGIN_FAILURE" | "UNAUTHORIZED_ACCESS" | "RATE_LIMIT_EXCEEDED" | "SUSPICIOUS_ACTIVITY", req: Request, details?: any) => void;
export declare const getAuditLogs: (filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    page?: number;
    limit?: number;
}) => {
    logs: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
};
export declare const getAuditLogStats: () => {
    totalLogs: number;
    successRate: number;
    topActions: Array<{
        action: string;
        count: number;
    }>;
    topResources: Array<{
        resource: string;
        count: number;
    }>;
    topUsers: Array<{
        userId: string;
        username: string | undefined;
        count: number;
    }>;
    recentFailures: AuditLogEntry[];
};
export {};
//# sourceMappingURL=auditLog.d.ts.map