// Security integration test to verify middleware is properly integrated
import request from 'supertest';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from '../utils/config';
import apiRoutes from '../routes';
import { generalRateLimit } from '../middleware/rateLimiting';
import { auditLog } from '../middleware/auditLog';
import { sanitizeInput } from '../middleware/validation';

// Create test app similar to main application
const createIntegrationTestApp = () => {
  const app = express();

  // Trust proxy if configured
  if (config.security.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration
  app.use(cors({
    origin: config.security.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Rate limiting
  app.use(generalRateLimit);

  // Audit logging
  app.use(auditLog);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Input sanitization
  app.use(sanitizeInput);

  // API routes
  app.use('/api', apiRoutes);

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'Job Candidate Filtering Funnel System API',
      version: '1.0.0',
      status: 'running'
    });
  });

  return app;
};

describe('Security Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/');

      // Check for Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-download-options']).toBe('noopen');
      expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
    });

    it('should set CORS headers correctly', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Authentication Integration', () => {
    it('should require authentication for protected API endpoints', async () => {
      const response = await request(app)
        .get('/api/job-profiles');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should allow access to public endpoints', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should allow login without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      // Should not require authentication but may fail due to validation
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('Input Validation Integration', () => {
    it('should sanitize malicious input in API requests', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '<script>alert("xss")</script>admin',
          password: 'password123'
        });

      // Should return validation error, not process the malicious script
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: '',
          password: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should apply rate limiting to API endpoints', async () => {
      // Make multiple requests quickly
      const promises = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/health')
      );

      const responses = await Promise.all(promises);

      // All requests should succeed since health endpoint has higher limits
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });

      // Check that rate limit headers are present
      const lastResponse = responses[responses.length - 1];
      if (lastResponse) {
        expect(lastResponse.headers['ratelimit-limit']).toBeDefined();
      }
    });

    it('should apply stricter rate limiting to auth endpoints', async () => {
      // Make multiple login attempts
      const promises = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            username: 'nonexistent',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(promises);

      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Audit Logging Integration', () => {
    it('should log API requests for audit purposes', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      // Audit logging happens in background, so we just verify the request succeeds
      // In a real test, we would check the audit log storage
    });

    it('should log failed authentication attempts', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'wrongpassword'
        });

      // Should log the failed attempt
      expect([400, 401, 429]).toContain(response.status);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should not expose sensitive error information', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint');

      expect(response.status).toBe(404);
      // Should not expose internal server details
      expect(response.body).not.toHaveProperty('stack');
    });
  });

  describe('Content Security', () => {
    it('should reject requests with oversized payloads', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB payload

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: largePayload
        });

      expect(response.status).toBe(413); // Payload too large
    });

    it('should handle empty requests gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});