// Comprehensive API endpoints test
import request from 'supertest';
import express from 'express';
import apiRoutes from '../routes';

// Mock the database connection to avoid connection issues in tests
jest.mock('../utils/database', () => ({
  database: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isDbConnected: jest.fn().mockReturnValue(false),
    healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' }),
    createIndexes: jest.fn()
  },
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string, public code: string = 'DATABASE_ERROR', public statusCode: number = 500) {
      super(message);
      this.name = 'DatabaseError';
    }
  }
}));

// Mock the candidate service
jest.mock('../services/candidateService', () => ({
  candidateService: {
    getCandidateById: jest.fn().mockResolvedValue(null),
    searchCandidates: jest.fn().mockResolvedValue({ candidates: [], total: 0, page: 1, totalPages: 0 }),
    getCandidateStatus: jest.fn().mockResolvedValue(null),
    getBatchProgress: jest.fn().mockResolvedValue(null),
    getTopCandidates: jest.fn().mockResolvedValue([]),
    exportCandidates: jest.fn().mockResolvedValue(''),
    getCandidatesCount: jest.fn().mockResolvedValue(0)
  }
}));

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('API Endpoints', () => {
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'API is healthy',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Job Profile Routes', () => {
    it('should validate job profile creation', async () => {
      const invalidJobProfile = {
        title: '',
        description: 'Test description'
      };

      const response = await request(app)
        .post('/api/job-profiles')
        .send(invalidJobProfile)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Title is required and must be a non-empty string');
    });

    it('should validate scoring weights sum to 100', async () => {
      const invalidJobProfile = {
        title: 'Test Job',
        description: 'Test description',
        requiredSkills: ['JavaScript'],
        experienceLevel: 'Mid-level',
        scoringWeights: {
          resumeAnalysis: 30,
          linkedInAnalysis: 20,
          githubAnalysis: 25,
          interviewPerformance: 20 // Sum = 95, not 100
        },
        interviewQuestions: ['Tell me about yourself']
      };

      const response = await request(app)
        .post('/api/job-profiles')
        .send(invalidJobProfile)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Scoring weights must sum to 100%. Current total: 95%');
    });
  });

  describe('Resume Upload Routes', () => {
    it('should reject non-PDF files', async () => {
      const response = await request(app)
        .post('/api/resumes/upload-single')
        .attach('resume', Buffer.from('not a pdf'), 'test.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('File validation error');
    });

    it('should require job profile ID for batch upload', async () => {
      const response = await request(app)
        .post('/api/resumes/upload-batch')
        .attach('resumes', Buffer.from('%PDF-1.4'), 'test.pdf')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Missing job profile ID');
    });
  });

  describe('Candidate Routes', () => {
    it('should validate search parameters', async () => {
      const response = await request(app)
        .get('/api/candidates?page=0&limit=2000&minScore=150')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Page must be a positive integer');
      expect(response.body.errors).toContain('Limit must be an integer between 1 and 1000');
      expect(response.body.errors).toContain('minScore must be a number between 0 and 100');
    });

    it('should validate recommendation filter', async () => {
      const response = await request(app)
        .get('/api/candidates?recommendation=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('recommendation must be one of: strong-hire, hire, maybe, no-hire');
    });

    it('should validate processing stage filter', async () => {
      const response = await request(app)
        .get('/api/candidates?processingStage=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('processingStage must be one of: resume, ai-analysis, linkedin, github, interview, scoring, completed');
    });

    it('should validate sort parameters', async () => {
      const response = await request(app)
        .get('/api/candidates?sortBy=invalid&sortOrder=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('sortBy must be one of: score, createdAt, name');
      expect(response.body.errors).toContain('sortOrder must be either asc or desc');
    });

    it('should validate export format', async () => {
      const response = await request(app)
        .get('/api/candidates/export?format=xml')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.errors).toContain('format must be either csv or json');
    });

    it('should validate candidate ID format', async () => {
      const response = await request(app)
        .get('/api/candidates/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid ID format');
    });

    it('should validate top candidates limit', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/candidates/top/${validObjectId}?limit=150`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Limit cannot exceed 100');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/job-profiles')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/job-profiles')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain('Title is required and must be a non-empty string');
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent success response format', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return consistent error response format', async () => {
      const response = await request(app)
        .get('/api/candidates?page=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return 400 for validation errors', async () => {
      await request(app)
        .post('/api/job-profiles')
        .send({ title: '' })
        .expect(400);
    });

    it('should return 404 for non-existent resources', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/candidates/${validObjectId}`)
        .expect(404);
    });

    it('should return 200 for successful GET requests', async () => {
      await request(app)
        .get('/api/health')
        .expect(200);
    });
  });
});