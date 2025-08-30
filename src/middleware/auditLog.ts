// Audit logging middleware for system operations
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Audit log entry interface
 */
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

/**
 * In-memory audit log store (in production, this would be in a database)
 */
const auditLogs: AuditLogEntry[] = [];
const MAX_AUDIT_LOGS = 10000; // Keep last 10,000 entries in memory

/**
 * Add audit log entry
 */
const addAuditLog = (entry: AuditLogEntry): void => {
  auditLogs.push(entry);
  
  // Keep only the most recent entries
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.splice(0, auditLogs.length - MAX_AUDIT_LOGS);
  }
  
  // Log to application logger as well
  logger.info('Audit log entry', entry);
};

/**
 * Determine action type based on HTTP method and path
 */
const getActionType = (method: string, path: string): string => {
  const normalizedPath = path.toLowerCase();
  
  switch (method.toUpperCase()) {
    case 'GET':
      if (normalizedPath.includes('/export')) return 'EXPORT';
      if (normalizedPath.includes('/search')) return 'SEARCH';
      if (normalizedPath.includes('/health')) return 'HEALTH_CHECK';
      return 'READ';
    
    case 'POST':
      if (normalizedPath.includes('/login')) return 'LOGIN';
      if (normalizedPath.includes('/upload')) return 'UPLOAD';
      if (normalizedPath.includes('/process')) return 'PROCESS';
      if (normalizedPath.includes('/analyze')) return 'ANALYZE';
      return 'CREATE';
    
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    
    case 'DELETE':
      return 'DELETE';
    
    default:
      return 'UNKNOWN';
  }
};

/**
 * Determine resource type based on path
 */
const getResourceType = (path: string): string => {
  const normalizedPath = path.toLowerCase();
  
  if (normalizedPath.includes('/job-profile')) return 'JOB_PROFILE';
  if (normalizedPath.includes('/candidate')) return 'CANDIDATE';
  if (normalizedPath.includes('/resume')) return 'RESUME';
  if (normalizedPath.includes('/ai-analysis')) return 'AI_ANALYSIS';
  if (normalizedPath.includes('/linkedin')) return 'LINKEDIN_ANALYSIS';
  if (normalizedPath.includes('/github')) return 'GITHUB_ANALYSIS';
  if (normalizedPath.includes('/interview')) return 'INTERVIEW';
  if (normalizedPath.includes('/scoring')) return 'SCORING';
  if (normalizedPath.includes('/report')) return 'REPORT';
  if (normalizedPath.includes('/queue')) return 'QUEUE';
  if (normalizedPath.includes('/user')) return 'USER';
  if (normalizedPath.includes('/auth')) return 'AUTH';
  
  return 'SYSTEM';
};

/**
 * Extract resource ID from path parameters
 */
const extractResourceId = (req: Request): string | undefined => {
  if (!req.params) return undefined;
  const { id, candidateId, jobProfileId, batchId, userId } = req.params;
  return id || candidateId || jobProfileId || batchId || userId;
};

/**
 * Audit logging middleware
 */
export const auditLog = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Store original res.json to capture response
  const originalJson = res.json;
  let responseBody: any;
  
  res.json = function(body: any) {
    responseBody = body;
    return originalJson.call(this, body);
  };
  
  // Store original res.end to capture when response is sent
  const originalEnd = res.end;
  
  res.end = function(...args: any[]) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Create audit log entry
    const auditEntry: AuditLogEntry = {
      timestamp: new Date(startTime),
      userId: req.user?.id,
      username: req.user?.username,
      action: getActionType(req.method, req.path),
      resource: getResourceType(req.path),
      resourceId: extractResourceId(req),
      method: req.method,
      path: req.path,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration,
      success: res.statusCode >= 200 && res.statusCode < 400,
      details: {
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        bodySize: req.get('Content-Length') ? parseInt(req.get('Content-Length')!) : undefined,
        responseSize: res.get('Content-Length') ? parseInt(res.get('Content-Length')!) : undefined
      }
    };
    
    // Add error information if request failed
    if (!auditEntry.success && responseBody) {
      auditEntry.error = responseBody.message || responseBody.error || 'Unknown error';
    }
    
    // Add audit log entry
    addAuditLog(auditEntry);
    
    // Call original end method
    return originalEnd.apply(this, args as any);
  };
  
  next();
};

/**
 * Log specific security events
 */
export const logSecurityEvent = (
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'UNAUTHORIZED_ACCESS' | 'RATE_LIMIT_EXCEEDED' | 'SUSPICIOUS_ACTIVITY',
  req: Request,
  details?: any
): void => {
  const securityEntry: AuditLogEntry = {
    timestamp: new Date(),
    userId: req.user?.id,
    username: req.user?.username,
    action: eventType,
    resource: 'SECURITY',
    resourceId: undefined,
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent'),
    statusCode: undefined,
    duration: undefined,
    success: eventType === 'LOGIN_SUCCESS',
    details
  };
  
  addAuditLog(securityEntry);
};

/**
 * Get audit logs with filtering and pagination
 */
export const getAuditLogs = (filters: {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  page?: number;
  limit?: number;
}): { logs: AuditLogEntry[]; total: number; page: number; limit: number } => {
  let filteredLogs = [...auditLogs];
  
  // Apply filters
  if (filters.userId) {
    filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
  }
  
  if (filters.action) {
    filteredLogs = filteredLogs.filter(log => log.action === filters.action);
  }
  
  if (filters.resource) {
    filteredLogs = filteredLogs.filter(log => log.resource === filters.resource);
  }
  
  if (filters.startDate) {
    filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
  }
  
  if (filters.endDate) {
    filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
  }
  
  if (filters.success !== undefined) {
    filteredLogs = filteredLogs.filter(log => log.success === filters.success);
  }
  
  // Sort by timestamp (newest first)
  filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  // Apply pagination
  const page = filters.page || 1;
  const limit = filters.limit || 50;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);
  
  return {
    logs: paginatedLogs,
    total: filteredLogs.length,
    page,
    limit
  };
};

/**
 * Get audit log statistics
 */
export const getAuditLogStats = (): {
  totalLogs: number;
  successRate: number;
  topActions: Array<{ action: string; count: number }>;
  topResources: Array<{ resource: string; count: number }>;
  topUsers: Array<{ userId: string; username: string | undefined; count: number }>;
  recentFailures: AuditLogEntry[];
} => {
  const totalLogs = auditLogs.length;
  const successfulLogs = auditLogs.filter(log => log.success).length;
  const successRate = totalLogs > 0 ? (successfulLogs / totalLogs) * 100 : 0;
  
  // Count actions
  const actionCounts = new Map<string, number>();
  auditLogs.forEach(log => {
    actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
  });
  
  // Count resources
  const resourceCounts = new Map<string, number>();
  auditLogs.forEach(log => {
    resourceCounts.set(log.resource, (resourceCounts.get(log.resource) || 0) + 1);
  });
  
  // Count users
  const userCounts = new Map<string, { username: string | undefined; count: number }>();
  auditLogs.forEach(log => {
    if (log.userId) {
      const existing = userCounts.get(log.userId) || { username: undefined, count: 0 };
      userCounts.set(log.userId, {
        username: log.username || existing.username,
        count: existing.count + 1
      });
    }
  });
  
  // Get recent failures (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentFailures = auditLogs
    .filter(log => !log.success && log.timestamp >= oneDayAgo)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 10);
  
  return {
    totalLogs,
    successRate: Math.round(successRate * 100) / 100,
    topActions: Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topResources: Array.from(resourceCounts.entries())
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topUsers: Array.from(userCounts.entries())
      .map(([userId, data]) => ({ userId, username: data.username, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    recentFailures
  };
};