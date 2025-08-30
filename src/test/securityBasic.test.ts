// Basic security integration test
import { 
  login, 
  createUser, 
  generateToken, 
  verifyToken 
} from '../middleware/auth';
import { 
  sanitizeString, 
  sanitizeObject 
} from '../middleware/validation';
import { 
  externalAPILimiter, 
  EXTERNAL_API_LIMITS 
} from '../middleware/rateLimiting';

describe('Basic Security Integration', () => {
  describe('Authentication Functions', () => {
    it('should create user and login successfully', async () => {
      const userData = {
        username: 'testuser123',
        password: 'TestPassword123!',
        role: 'recruiter' as const
      };
      
      // Create user
      const user = await createUser(userData);
      expect(user).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.role).toBe(userData.role);
      
      // Login with created user
      const loginResult = await login(userData.username, userData.password);
      expect(loginResult).toBeDefined();
      expect(loginResult?.user.username).toBe(userData.username);
      expect(loginResult?.token).toBeDefined();
    });
    
    it('should generate and verify JWT tokens', async () => {
      const user = {
        id: 'test-id',
        username: 'testuser',
        role: 'admin' as const,
        passwordHash: 'hash',
        createdAt: new Date()
      };
      
      const token = generateToken(user);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = verifyToken(token);
      expect(decoded.id).toBe(user.id);
      expect(decoded.username).toBe(user.username);
      expect(decoded.role).toBe(user.role);
    });
    
    it('should reject invalid tokens', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });
  });
  
  describe('Input Sanitization', () => {
    it('should sanitize malicious strings', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(1)">',
        'SELECT * FROM users; DROP TABLE users;',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];
      
      maliciousInputs.forEach(input => {
        const sanitized = sanitizeString(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('<iframe>');
      });
    });
    
    it('should sanitize objects recursively', () => {
      const maliciousObject = {
        name: '<script>alert("xss")</script>John',
        email: 'test@example.com',
        profile: {
          bio: 'javascript:alert("bio")',
          skills: ['<img onerror="alert(1)">', 'JavaScript', 'Node.js']
        }
      };
      
      const sanitized = sanitizeObject(maliciousObject);
      
      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.profile.bio).not.toContain('javascript:');
      expect(sanitized.profile.skills[0]).not.toContain('onerror=');
      expect(sanitized.email).toBe('test@example.com'); // Valid email should remain
    });
  });
  
  describe('External API Rate Limiting', () => {
    it('should initialize with correct limits', () => {
      expect(EXTERNAL_API_LIMITS.gemini.maxCalls).toBe(1000);
      expect(EXTERNAL_API_LIMITS.openai.maxCalls).toBe(500);
      expect(EXTERNAL_API_LIMITS.claude.maxCalls).toBe(300);
      expect(EXTERNAL_API_LIMITS.linkedin.maxCalls).toBe(100);
      expect(EXTERNAL_API_LIMITS.github.maxCalls).toBe(5000);
      expect(EXTERNAL_API_LIMITS.vapi.maxCalls).toBe(200);
    });
    
    it('should track API calls correctly', () => {
      const service = 'test-service';
      const maxCalls = 3;
      const windowMs = 60000;
      
      // First call should succeed
      expect(externalAPILimiter.canMakeCall(service, maxCalls, windowMs)).toBe(true);
      expect(externalAPILimiter.getRemainingCalls(service, maxCalls)).toBe(2);
      
      // Second call should succeed
      expect(externalAPILimiter.canMakeCall(service, maxCalls, windowMs)).toBe(true);
      expect(externalAPILimiter.getRemainingCalls(service, maxCalls)).toBe(1);
      
      // Third call should succeed
      expect(externalAPILimiter.canMakeCall(service, maxCalls, windowMs)).toBe(true);
      expect(externalAPILimiter.getRemainingCalls(service, maxCalls)).toBe(0);
      
      // Fourth call should fail
      expect(externalAPILimiter.canMakeCall(service, maxCalls, windowMs)).toBe(false);
      expect(externalAPILimiter.getRemainingCalls(service, maxCalls)).toBe(0);
    });
    
    it('should provide reset time information', () => {
      const service = 'reset-test-service';
      const maxCalls = 1;
      const windowMs = 60000;
      
      // Make a call to start the window
      externalAPILimiter.canMakeCall(service, maxCalls, windowMs);
      
      const resetTime = externalAPILimiter.getResetTime(service);
      expect(resetTime).toBeInstanceOf(Date);
      expect(resetTime!.getTime()).toBeGreaterThan(Date.now());
    });
  });
  
  describe('Configuration Validation', () => {
    it('should have required configuration values', () => {
      // These should be defined in the config
      expect(process.env.JWT_SECRET || 'default-secret-change-in-production').toBeDefined();
      expect(process.env.JWT_EXPIRATION || '24h').toBeDefined();
      expect(process.env.BCRYPT_ROUNDS || '10').toBeDefined();
    });
    
    it('should warn about default values in production', () => {
      if (process.env.NODE_ENV === 'production') {
        expect(process.env.JWT_SECRET).not.toBe('default-secret-change-in-production');
        expect(process.env.DEFAULT_ADMIN_PASSWORD).not.toBe('admin123');
      }
    });
  });
});