# Security Implementation Documentation

## Overview

This document describes the security measures implemented in the Job Candidate Filtering Funnel System as part of task 14.

## Implemented Security Features

### 1. Authentication System

#### JWT-based Authentication
- **Location**: `src/middleware/auth.ts`
- **Features**:
  - JWT token generation and verification
  - Configurable token expiration (default: 24 hours)
  - Secure password hashing using bcrypt (10 rounds)
  - Default admin user creation on startup

#### User Management
- **Roles**: admin, recruiter, viewer
- **Default Admin**: Username `admin`, password `admin123` (change in production)
- **Password Requirements**: Minimum 8 characters with uppercase, lowercase, and numbers

#### API Endpoints
- `POST /api/auth/login` - User authentication
- `POST /api/auth/users` - Create new user (admin only)
- `GET /api/auth/users` - List all users (admin only)
- `DELETE /api/auth/users/:username` - Delete user (admin only)
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout (client-side token removal)

### 2. Authorization System

#### Role-based Access Control
- **Location**: `src/middleware/auth.ts`
- **Implementation**: `authorize(['admin', 'recruiter'])` middleware
- **Roles**:
  - **admin**: Full system access, user management
  - **recruiter**: Job profiles, resume processing, candidate management
  - **viewer**: Read-only access to reports and candidates

#### Protected Routes
All API endpoints except `/auth/login` require authentication:
- Job profiles: admin, recruiter
- Resume processing: admin, recruiter
- Reports: admin, recruiter, viewer
- User management: admin only
- Audit logs: admin only

### 3. Input Validation and Sanitization

#### Validation Middleware
- **Location**: `src/middleware/validation.ts`
- **Features**:
  - Express-validator integration
  - Custom validation rules for login, user creation
  - MongoDB ObjectId validation
  - Pagination parameter validation

#### Input Sanitization
- **HTML/Script Tag Removal**: Prevents XSS attacks
- **SQL Injection Prevention**: Input sanitization and parameterized queries
- **Recursive Object Sanitization**: Deep sanitization of nested objects
- **File Upload Validation**: PDF-only uploads with size limits

#### Validation Rules
```typescript
// Login validation
username: 3-50 characters, alphanumeric + underscore/hyphen
password: 6-100 characters

// User creation validation  
username: 3-50 characters, alphanumeric + underscore/hyphen
password: 8-100 characters, must contain uppercase, lowercase, number
role: must be 'admin', 'recruiter', or 'viewer'
```

### 4. Rate Limiting

#### API Rate Limits
- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 login attempts per 15 minutes per IP
- **File Uploads**: 10 uploads per hour per IP
- **Exports**: 20 exports per hour per user

#### External API Rate Limits
- **Gemini API**: 1000 calls per hour
- **OpenAI API**: 500 calls per hour
- **Claude API**: 300 calls per hour
- **LinkedIn Scraper**: 100 calls per hour
- **GitHub API**: 5000 calls per hour
- **VAPI Service**: 200 calls per hour

#### Implementation
```typescript
// Usage in services
const limits = EXTERNAL_API_LIMITS.gemini;
if (!externalAPILimiter.canMakeCall('gemini', limits.maxCalls, limits.windowMs)) {
  throw new Error('Rate limit exceeded');
}
```

### 5. Audit Logging

#### Comprehensive Logging
- **Location**: `src/middleware/auditLog.ts`
- **Features**:
  - All API requests logged with user context
  - Security events tracking (login success/failure, unauthorized access)
  - Request/response metadata (duration, status codes, IP addresses)
  - Automatic log rotation (keeps last 10,000 entries)

#### Audit Log Endpoints
- `GET /api/audit/logs` - Get audit logs with filtering (admin only)
- `GET /api/audit/stats` - Get audit statistics (admin only)
- `GET /api/audit/security-events` - Get security events (admin only)
- `GET /api/audit/user-activity/:userId` - Get user activity (admin only)
- `GET /api/audit/failed-requests` - Get recent failures (admin only)

#### Logged Information
```typescript
interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  username?: string;
  action: string;           // CREATE, READ, UPDATE, DELETE, LOGIN, etc.
  resource: string;         // JOB_PROFILE, CANDIDATE, RESUME, etc.
  method: string;           // HTTP method
  path: string;             // Request path
  ip: string;               // Client IP
  statusCode?: number;      // Response status
  duration?: number;        // Request duration in ms
  success: boolean;         // Request success/failure
  error?: string;           // Error message if failed
}
```

### 6. Additional Security Measures

#### HTTP Security Headers
- **Helmet.js Integration**: Automatic security headers
- **Content Security Policy**: Prevents XSS attacks
- **HSTS**: Enforces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking

#### CORS Configuration
- **Configurable Origins**: Environment-based CORS origins
- **Credential Support**: Allows authenticated requests
- **Method Restrictions**: Only allows necessary HTTP methods

#### Environment Security
- **Secure Defaults**: All sensitive values have secure defaults
- **Environment Validation**: Warns about default values in production
- **Proxy Trust**: Configurable proxy trust for rate limiting

## Configuration

### Environment Variables

```bash
# Authentication
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRATION=24h
BCRYPT_ROUNDS=10
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123

# Security
API_RATE_LIMIT=100
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
TRUST_PROXY=false
```

### Production Security Checklist

1. **Change Default Credentials**
   - Set strong JWT_SECRET (not default value)
   - Change DEFAULT_ADMIN_PASSWORD
   - Create proper admin user and delete default

2. **Configure Rate Limits**
   - Adjust API_RATE_LIMIT based on expected load
   - Monitor external API usage
   - Set up proper CORS_ORIGINS

3. **Enable Security Features**
   - Set TRUST_PROXY=true if behind reverse proxy
   - Configure proper SSL/TLS certificates
   - Enable audit log monitoring

4. **Monitor Security Events**
   - Set up alerts for failed login attempts
   - Monitor rate limit violations
   - Review audit logs regularly

## Testing

### Security Test Coverage
- **Authentication**: Login/logout, token validation, password requirements
- **Authorization**: Role-based access control, permission checks
- **Input Validation**: XSS prevention, SQL injection prevention, malformed input
- **Rate Limiting**: API limits, external service limits, abuse prevention
- **Audit Logging**: Event tracking, log filtering, security event logging

### Running Security Tests
```bash
# Run basic security tests
npm test -- --testPathPattern=securityBasic.test.ts

# Run all tests
npm test
```

## Security Considerations

### Known Limitations (MVP Implementation)
1. **In-Memory User Store**: Users are stored in memory, not persisted to database
2. **Simple Session Management**: No session invalidation or refresh tokens
3. **Basic Audit Storage**: Audit logs stored in memory with rotation
4. **Limited Brute Force Protection**: Basic rate limiting only

### Recommended Production Enhancements
1. **Database User Storage**: Move user management to MongoDB
2. **Session Management**: Implement refresh tokens and session invalidation
3. **Persistent Audit Logs**: Store audit logs in database with proper indexing
4. **Advanced Monitoring**: Integrate with security monitoring tools
5. **Multi-Factor Authentication**: Add 2FA for admin accounts
6. **API Key Management**: Implement API key rotation and management

## Compliance and Standards

### Security Standards Followed
- **OWASP Top 10**: Protection against common web vulnerabilities
- **JWT Best Practices**: Secure token generation and validation
- **Input Validation**: Comprehensive sanitization and validation
- **Audit Logging**: Comprehensive activity tracking

### Data Protection
- **Password Security**: Bcrypt hashing with salt rounds
- **Sensitive Data**: No sensitive data in logs or responses
- **Error Handling**: Generic error messages to prevent information disclosure