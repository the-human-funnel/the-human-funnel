import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { database } from '../utils/database';
import { redis } from '../utils/redis';
import app from '../index';

// Test data
const testJobProfile = {
  title: 'Senior Software Engineer',
  description: 'Full-stack developer with React and Node.js experience',
  requiredSkills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
  experienceLevel: 'Senior',
  scoringWeights: {
    resumeAnalysis: 25,
    linkedInAnalysis: 20,
    githubAnalysis: 25,
    interviewPerformance: 30
  },
  interviewQuestions: [
    'Tell me about your experience with React',
    'How do you handle state management?',
    'Describe your testing approach'
  ]
};

const testResumeText = `
John Doe
Senior Software Engineer
Email: john.doe@example.com
Phone: (555) 123-4567
LinkedIn: https://www.linkedin.com/in/johndoe
GitHub: https://github.com/johndoe

EXPERIENCE
Senior Software Engineer at TechCorp (2020-2023)
- Developed React applications with TypeScript
- Built Node.js APIs with Express and MongoDB
- Led team of 5 developers

Software Engineer at StartupXYZ (2018-2020)
- Full-stack development with JavaScript
- Database design and optimization
- Agile development practices

SKILLS
JavaScript, TypeScript, React, Node.js, MongoDB, Express, Git, AWS
`;

describe('Integration Tests - Critical Workflows', () => {
  let mongoServer: MongoMemoryServer;
  let authToken: string;
  let jobProfileId: string;
  let candidateId: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to test database
    await database.connect(mongoUri);
    
    // Connect to Redis (use test database)
    await redis.connect({ db: 15 }); // Use test database
    
    // Get auth token for API requests
    const authResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'admin123'
      });
    
    authToken = authResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await database.disconnect();
    await redis.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await database.clearTestData();
    await redis.flushdb();
  });

  describe('Complete Candidate Processing Workflow', () => {
    test('should process a candidate through the complete pipeline', async () => {
      // Step 1: Create job profile
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testJobProfile)
        .expect(201);

      expect(jobProfileResponse.body.success).toBe(true);
      jobProfileId = jobProfileResponse.body.data.id;

      // Step 2: Upload and process resume
      const resumeBuffer = Buffer.from(testResumeText);
      const uploadResponse = await request(app)
        .post('/api/resume-processing/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', resumeBuffer, 'john_doe_resume.pdf')
        .field('jobProfileId', jobProfileId)
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.processedFiles).toBe(1);
      candidateId = uploadResponse.body.data.candidates[0].id;

      // Step 3: Wait for processing to complete (with timeout)
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds timeout

      while (!processingComplete && attempts < maxAttempts) {
        const statusResponse = await request(app)
          .get(`/api/candidates/${candidateId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const candidate = statusResponse.body.data.candidate;
        processingComplete = candidate.processingStage === 'completed';
        
        if (!processingComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          attempts++;
        }
      }

      expect(processingComplete).toBe(true);

      // Step 4: Verify candidate data
      const candidateResponse = await request(app)
        .get(`/api/candidates/${candidateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const candidate = candidateResponse.body.data;
      
      // Verify resume processing
      expect(candidate.resumeData.extractedText).toContain('John Doe');
      expect(candidate.resumeData.contactInfo.email).toBe('john.doe@example.com');
      expect(candidate.resumeData.contactInfo.phone).toBe('(555) 123-4567');
      expect(candidate.resumeData.contactInfo.linkedInUrl).toContain('linkedin.com');
      expect(candidate.resumeData.contactInfo.githubUrl).toContain('github.com');

      // Verify AI analysis
      expect(candidate.aiAnalysis).toBeDefined();
      expect(candidate.aiAnalysis.relevanceScore).toBeGreaterThan(0);
      expect(candidate.aiAnalysis.skillsMatch.matched).toContain('JavaScript');

      // Verify final scoring
      expect(candidate.finalScore).toBeDefined();
      expect(candidate.finalScore.compositeScore).toBeGreaterThan(0);
      expect(candidate.finalScore.recommendation).toMatch(/strong-hire|hire|maybe|no-hire/);

      // Step 5: Generate and verify report
      const reportResponse = await request(app)
        .post(`/api/reports/candidate/${candidateId}/pdf`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ candidate, jobProfile: testJobProfile })
        .expect(200);

      expect(reportResponse.body.success).toBe(true);
      expect(reportResponse.body.data.reportPath).toContain('.pdf');
    }, 60000); // 60 second timeout for complete workflow

    test('should handle batch processing of multiple candidates', async () => {
      // Create job profile
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testJobProfile)
        .expect(201);

      jobProfileId = jobProfileResponse.body.data.id;

      // Create multiple test resumes
      const resume1 = Buffer.from(testResumeText.replace('John Doe', 'Jane Smith'));
      const resume2 = Buffer.from(testResumeText.replace('John Doe', 'Bob Johnson'));
      const resume3 = Buffer.from(testResumeText.replace('John Doe', 'Alice Brown'));

      // Upload batch
      const batchResponse = await request(app)
        .post('/api/resume-processing/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', resume1, 'jane_smith_resume.pdf')
        .attach('files', resume2, 'bob_johnson_resume.pdf')
        .attach('files', resume3, 'alice_brown_resume.pdf')
        .field('jobProfileId', jobProfileId)
        .expect(200);

      expect(batchResponse.body.success).toBe(true);
      expect(batchResponse.body.data.totalCandidates).toBe(3);

      const batchId = batchResponse.body.data.batchId;

      // Monitor batch progress
      let batchComplete = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout

      while (!batchComplete && attempts < maxAttempts) {
        const progressResponse = await request(app)
          .get(`/api/candidates/batch/${batchId}/progress`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const progress = progressResponse.body.data;
        batchComplete = progress.status === 'completed';
        
        if (!batchComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      expect(batchComplete).toBe(true);

      // Verify all candidates were processed
      const candidatesResponse = await request(app)
        .post('/api/candidates/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filters: { jobProfileId },
          options: { limit: 10 }
        })
        .expect(200);

      expect(candidatesResponse.body.data.candidates).toHaveLength(3);
      
      // Verify each candidate has complete data
      candidatesResponse.body.data.candidates.forEach((candidate: any) => {
        expect(candidate.processingStage).toBe('completed');
        expect(candidate.finalScore).toBeDefined();
        expect(candidate.finalScore.compositeScore).toBeGreaterThan(0);
      });
    }, 120000); // 2 minute timeout for batch processing
  });

  describe('API Endpoint Integration', () => {
    beforeEach(async () => {
      // Create test job profile for API tests
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testJobProfile);
      
      jobProfileId = jobProfileResponse.body.data.id;
    });

    test('should handle job profile CRUD operations', async () => {
      // Create
      const createResponse = await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...testJobProfile,
          title: 'Frontend Developer'
        })
        .expect(201);

      const profileId = createResponse.body.data.id;

      // Read
      const getResponse = await request(app)
        .get(`/api/job-profiles/${profileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.data.title).toBe('Frontend Developer');

      // Update
      const updateResponse = await request(app)
        .put(`/api/job-profiles/${profileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Senior Frontend Developer',
          description: 'Updated description'
        })
        .expect(200);

      expect(updateResponse.body.data.title).toBe('Senior Frontend Developer');

      // Delete
      await request(app)
        .delete(`/api/job-profiles/${profileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(app)
        .get(`/api/job-profiles/${profileId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    test('should validate job profile data', async () => {
      // Test invalid scoring weights
      await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...testJobProfile,
          scoringWeights: {
            resumeAnalysis: 30,
            linkedInAnalysis: 20,
            githubAnalysis: 25,
            interviewPerformance: 20 // Total = 95, should be 100
          }
        })
        .expect(400);

      // Test missing required fields
      await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Job'
          // Missing other required fields
        })
        .expect(400);

      // Test empty required skills
      await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...testJobProfile,
          requiredSkills: []
        })
        .expect(400);
    });

    test('should handle candidate search and filtering', async () => {
      // Create test candidates first
      const resumeBuffer = Buffer.from(testResumeText);
      await request(app)
        .post('/api/resume-processing/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', resumeBuffer, 'test_resume.pdf')
        .field('jobProfileId', jobProfileId);

      // Wait a moment for processing to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test basic search
      const searchResponse = await request(app)
        .post('/api/candidates/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filters: { jobProfileId },
          options: { page: 1, limit: 10 }
        })
        .expect(200);

      expect(searchResponse.body.data.candidates).toBeDefined();
      expect(searchResponse.body.data.pagination).toBeDefined();

      // Test filtering by processing stage
      const stageFilterResponse = await request(app)
        .post('/api/candidates/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filters: { 
            jobProfileId,
            processingStage: 'resume'
          },
          options: { limit: 10 }
        })
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
    });

    test('should handle report generation', async () => {
      // Create and process a candidate first
      const resumeBuffer = Buffer.from(testResumeText);
      const uploadResponse = await request(app)
        .post('/api/resume-processing/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', resumeBuffer, 'test_resume.pdf')
        .field('jobProfileId', jobProfileId);

      candidateId = uploadResponse.body.data.candidates[0].id;

      // Wait for some processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Test candidate report data generation
      const reportDataResponse = await request(app)
        .post(`/api/reports/candidate/${candidateId}/data`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          candidate: { id: candidateId },
          jobProfile: testJobProfile
        })
        .expect(200);

      expect(reportDataResponse.body.success).toBe(true);
      expect(reportDataResponse.body.data.candidate).toBeDefined();

      // Test CSV export
      const csvResponse = await request(app)
        .post('/api/reports/candidates/csv')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          filters: { jobProfileId },
          options: { includeDetails: true }
        })
        .expect(200);

      expect(csvResponse.body.success).toBe(true);
      expect(csvResponse.body.data.csvPath).toContain('.csv');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid PDF files gracefully', async () => {
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testJobProfile);

      jobProfileId = jobProfileResponse.body.data.id;

      // Upload invalid file
      const invalidBuffer = Buffer.from('This is not a PDF file');
      const uploadResponse = await request(app)
        .post('/api/resume-processing/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', invalidBuffer, 'invalid.pdf')
        .field('jobProfileId', jobProfileId)
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.failedFiles).toBe(1);
    });

    test('should handle missing job profile gracefully', async () => {
      const resumeBuffer = Buffer.from(testResumeText);
      
      await request(app)
        .post('/api/resume-processing/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', resumeBuffer, 'test_resume.pdf')
        .field('jobProfileId', 'non-existent-id')
        .expect(404);
    });

    test('should handle unauthorized access', async () => {
      // Test without auth token
      await request(app)
        .get('/api/job-profiles')
        .expect(401);

      // Test with invalid token
      await request(app)
        .get('/api/job-profiles')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    test('should handle database connection issues', async () => {
      // Temporarily disconnect database
      await database.disconnect();

      // Try to create job profile
      await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testJobProfile)
        .expect(500);

      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await database.connect(mongoUri);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle concurrent requests', async () => {
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testJobProfile);

      jobProfileId = jobProfileResponse.body.data.id;

      // Create multiple concurrent requests
      const promises = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/api/job-profiles')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...testJobProfile,
            title: `Concurrent Job ${i + 1}`
          })
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });
    });

    test('should handle large file uploads', async () => {
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testJobProfile);

      jobProfileId = jobProfileResponse.body.data.id;

      // Create a larger resume text (simulate large PDF)
      const largeResumeText = testResumeText.repeat(100); // ~50KB
      const largeBuffer = Buffer.from(largeResumeText);

      const uploadResponse = await request(app)
        .post('/api/resume-processing/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('files', largeBuffer, 'large_resume.pdf')
        .field('jobProfileId', jobProfileId)
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
    });
  });

  describe('Health Checks and Monitoring', () => {
    test('should provide system health status', async () => {
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.timestamp).toBeDefined();
      expect(healthResponse.body.services).toBeDefined();
    });

    test('should provide database health status', async () => {
      const dbHealthResponse = await request(app)
        .get('/api/health/database')
        .expect(200);

      expect(dbHealthResponse.body.status).toBe('connected');
      expect(dbHealthResponse.body.responseTime).toBeDefined();
    });

    test('should provide Redis health status', async () => {
      const redisHealthResponse = await request(app)
        .get('/api/health/redis')
        .expect(200);

      expect(redisHealthResponse.body.status).toBe('connected');
      expect(redisHealthResponse.body.responseTime).toBeDefined();
    });
  });
});