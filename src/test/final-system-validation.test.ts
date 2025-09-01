import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { database } from '../utils/database';
import { redisClient } from '../utils/redis';
import { logger } from '../utils/logger';
import { performanceInitializationService } from '../services/performanceInitializationService';
import express from 'express';

// Import the app after setting up test environment
process.env.NODE_ENV = 'test';
process.env.SKIP_AUTH = 'true'; // Skip authentication for tests

let app: express.Application;

// Test data for comprehensive validation
const testJobProfile = {
  title: 'Full Stack Software Engineer',
  description: 'Senior full-stack developer with expertise in React, Node.js, and cloud technologies',
  requiredSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'MongoDB', 'AWS', 'Docker', 'Git'],
  experienceLevel: 'Senior',
  scoringWeights: {
    resumeAnalysis: 25,
    linkedInAnalysis: 20,
    githubAnalysis: 25,
    interviewPerformance: 30
  },
  interviewQuestions: [
    'Describe your experience with React and state management',
    'How do you approach API design and database optimization?',
    'Tell me about a challenging technical problem you solved',
    'How do you ensure code quality and testing in your projects?',
    'Describe your experience with cloud platforms and DevOps'
  ]
};

// Sample resume data for testing
const sampleResumes = [
  {
    name: 'john_doe_senior.pdf',
    content: `
John Doe
Senior Software Engineer
Email: john.doe@techcorp.com
Phone: (555) 123-4567
LinkedIn: https://www.linkedin.com/in/johndoe-senior
GitHub: https://github.com/johndoe-dev

PROFESSIONAL EXPERIENCE
Senior Software Engineer | TechCorp Inc. | 2020-2023
• Led development of React-based dashboard serving 10,000+ users
• Built scalable Node.js APIs handling 1M+ requests/day
• Implemented CI/CD pipelines using Docker and AWS
• Mentored team of 5 junior developers

Software Engineer | StartupXYZ | 2018-2020
• Full-stack development with JavaScript, React, and MongoDB
• Designed and implemented RESTful APIs
• Optimized database queries reducing response time by 40%

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, Java
Frontend: React, Vue.js, HTML5, CSS3, Redux
Backend: Node.js, Express, Django, Spring Boot
Databases: MongoDB, PostgreSQL, Redis
Cloud: AWS (EC2, S3, Lambda), Docker, Kubernetes
Tools: Git, Jenkins, Jest, Webpack

EDUCATION
Bachelor of Science in Computer Science | University of Technology | 2018

PROJECTS
E-commerce Platform: https://github.com/johndoe-dev/ecommerce-platform
• Full-stack application with React frontend and Node.js backend
• Integrated payment processing and inventory management
• Deployed on AWS with auto-scaling capabilities
    `
  },
  {
    name: 'jane_smith_mid.pdf',
    content: `
Jane Smith
Software Developer
Email: jane.smith@webdev.com
Phone: (555) 987-6543
LinkedIn: https://www.linkedin.com/in/janesmith-dev
GitHub: https://github.com/janesmith-code

EXPERIENCE
Software Developer | WebDev Solutions | 2021-2023
• Developed responsive web applications using React and TypeScript
• Created RESTful APIs with Node.js and Express
• Worked with MongoDB and implemented caching with Redis
• Collaborated in Agile development environment

Junior Developer | Digital Agency | 2019-2021
• Frontend development with HTML, CSS, JavaScript
• Basic backend work with Node.js
• Database management with MySQL

SKILLS
JavaScript, TypeScript, React, Node.js, Express, MongoDB, HTML, CSS, Git

EDUCATION
Bachelor of Computer Science | State University | 2019

PROJECTS
Task Management App: https://github.com/janesmith-code/task-manager
• React application with Node.js backend
• User authentication and task CRUD operations
    `
  },
  {
    name: 'bob_johnson_junior.pdf',
    content: `
Bob Johnson
Junior Software Developer
Email: bob.johnson@newgrad.com
Phone: (555) 456-7890
LinkedIn: https://www.linkedin.com/in/bobjohnson-newgrad
GitHub: https://github.com/bobjohnson-junior

EXPERIENCE
Junior Software Developer | CodeStart Inc. | 2022-2023
• Assisted in developing web applications using React
• Basic API development with Node.js
• Bug fixes and feature enhancements
• Unit testing with Jest

Intern | Tech Startup | Summer 2022
• Frontend development with HTML, CSS, JavaScript
• Learning React and modern web development practices

SKILLS
JavaScript, React, Node.js, HTML, CSS, Git, Basic MongoDB

EDUCATION
Bachelor of Science in Computer Science | Tech University | 2022

PROJECTS
Personal Portfolio: https://github.com/bobjohnson-junior/portfolio
• Simple React application showcasing projects
• Responsive design with CSS Grid and Flexbox
    `
  }
];

describe('Final System Integration and Validation', () => {
  let mongoServer: MongoMemoryServer;
  let jobProfileId: string;
  let candidateIds: string[] = [];
  let batchId: string;

  beforeAll(async () => {
    logger.info('Starting final system validation tests');
    
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Initialize performance services (includes database and Redis)
    await performanceInitializationService.initialize();
    
    // Connect to test database
    await database.connect();
    
    // Import app after environment setup
    const appModule = await import('../index');
    app = appModule.default || appModule;
    
    logger.info('Test environment initialized successfully');
  });

  afterAll(async () => {
    logger.info('Cleaning up test environment');
    
    // Cleanup
    await performanceInitializationService.shutdown();
    await database.disconnect();
    await mongoServer.stop();
    
    logger.info('Test environment cleanup completed');
  });

  beforeEach(async () => {
    // Clear test data before each test
    candidateIds = [];
  });

  describe('1. Complete Processing Pipeline Integration', () => {
    test('should integrate all services into complete processing pipeline', async () => {
      logger.info('Testing complete processing pipeline integration');
      
      // Step 1: Create job profile
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .send(testJobProfile)
        .expect(201);

      expect(jobProfileResponse.body.success).toBe(true);
      jobProfileId = jobProfileResponse.body.data.id;
      logger.info(`Created job profile: ${jobProfileId}`);

      // Step 2: Upload resumes for batch processing
      const uploadPromises = sampleResumes.map(async (resume) => {
        const resumeBuffer = Buffer.from(resume.content);
        return request(app)
          .post('/api/resume-processing/upload')
          .attach('files', resumeBuffer, resume.name)
          .field('jobProfileId', jobProfileId);
      });

      const uploadResponses = await Promise.all(uploadPromises);
      
      // Verify all uploads succeeded
      uploadResponses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        if (response.body.data.candidates && response.body.data.candidates[0]) {
          candidateIds.push(response.body.data.candidates[0].id);
          logger.info(`Uploaded resume ${sampleResumes[index]?.name}: ${response.body.data.candidates[0].id}`);
        }
      });

      // Step 3: Monitor processing pipeline completion
      let allProcessingComplete = false;
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes timeout

      while (!allProcessingComplete && attempts < maxAttempts) {
        const statusPromises = candidateIds.map(id =>
          request(app)
            .get(`/api/candidates/${id}/status`)
            .expect(200)
        );

        const statusResponses = await Promise.all(statusPromises);
        const completedCount = statusResponses.filter(
          response => response.body.data.candidate.processingStage === 'completed'
        ).length;

        allProcessingComplete = completedCount === candidateIds.length;
        
        if (!allProcessingComplete) {
          logger.info(`Processing progress: ${completedCount}/${candidateIds.length} candidates completed`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      expect(allProcessingComplete).toBe(true);
      logger.info('All candidates processed successfully through complete pipeline');

      // Step 4: Verify each processing stage completed
      for (const candidateId of candidateIds) {
        const candidateResponse = await request(app)
          .get(`/api/candidates/${candidateId}`)
          .expect(200);

        const candidate = candidateResponse.body.data;
        
        // Verify resume processing
        expect(candidate.resumeData).toBeDefined();
        expect(candidate.resumeData.extractedText).toBeTruthy();
        expect(candidate.resumeData.contactInfo).toBeDefined();
        
        // Verify AI analysis
        expect(candidate.aiAnalysis).toBeDefined();
        expect(candidate.aiAnalysis.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(candidate.aiAnalysis.relevanceScore).toBeLessThanOrEqual(100);
        
        // Verify LinkedIn analysis (may be limited due to test environment)
        expect(candidate.linkedInAnalysis).toBeDefined();
        
        // Verify GitHub analysis
        expect(candidate.githubAnalysis).toBeDefined();
        
        // Verify interview session (may be scheduled or completed)
        expect(candidate.interviewSession).toBeDefined();
        
        // Verify final scoring
        expect(candidate.finalScore).toBeDefined();
        expect(candidate.finalScore.compositeScore).toBeGreaterThanOrEqual(0);
        expect(candidate.finalScore.compositeScore).toBeLessThanOrEqual(100);
        expect(candidate.finalScore.recommendation).toMatch(/strong-hire|hire|maybe|no-hire/);
        
        logger.info(`Candidate ${candidateId} validation completed - Score: ${candidate.finalScore.compositeScore}`);
      }
    }, 180000); // 3 minute timeout
  });

  describe('2. End-to-End Processing with Real Resume Samples', () => {
    test('should process diverse resume samples with varying quality', async () => {
      logger.info('Testing end-to-end processing with diverse resume samples');
      
      // Create job profile
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .send(testJobProfile)
        .expect(201);

      jobProfileId = jobProfileResponse.body.data.id;

      // Process all sample resumes
      const batchUploadResponse = await request(app)
        .post('/api/resume-processing/batch')
        .attach('files', Buffer.from(sampleResumes[0]?.content || ''), sampleResumes[0]?.name || 'resume1.pdf')
        .attach('files', Buffer.from(sampleResumes[1]?.content || ''), sampleResumes[1]?.name || 'resume2.pdf')
        .attach('files', Buffer.from(sampleResumes[2]?.content || ''), sampleResumes[2]?.name || 'resume3.pdf')
        .field('jobProfileId', jobProfileId)
        .expect(200);

      expect(batchUploadResponse.body.success).toBe(true);
      expect(batchUploadResponse.body.data.totalCandidates).toBe(3);
      batchId = batchUploadResponse.body.data.batchId;

      // Monitor batch processing
      let batchComplete = false;
      let attempts = 0;
      const maxAttempts = 120;

      while (!batchComplete && attempts < maxAttempts) {
        const progressResponse = await request(app)
          .get(`/api/candidates/batch/${batchId}/progress`)
          .expect(200);

        const progress = progressResponse.body.data;
        batchComplete = progress.status === 'completed';
        
        if (!batchComplete) {
          logger.info(`Batch progress: ${progress.processedCandidates}/${progress.totalCandidates} processed`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      expect(batchComplete).toBe(true);

      // Verify processing results
      const candidatesResponse = await request(app)
        .post('/api/candidates/search')
        .send({
          filters: { jobProfileId },
          options: { limit: 10, sortBy: 'finalScore.compositeScore', sortOrder: 'desc' }
        })
        .expect(200);

      const candidates = candidatesResponse.body.data.candidates;
      expect(candidates).toHaveLength(3);

      // Verify ranking reflects experience levels
      const seniorCandidate = candidates.find((c: any) => 
        c.resumeData.extractedText.includes('John Doe')
      );
      const midCandidate = candidates.find((c: any) => 
        c.resumeData.extractedText.includes('Jane Smith')
      );
      const juniorCandidate = candidates.find((c: any) => 
        c.resumeData.extractedText.includes('Bob Johnson')
      );

      expect(seniorCandidate.finalScore.compositeScore).toBeGreaterThan(midCandidate.finalScore.compositeScore);
      expect(midCandidate.finalScore.compositeScore).toBeGreaterThan(juniorCandidate.finalScore.compositeScore);

      logger.info('Resume quality ranking validation completed successfully');
    }, 180000);
  });

  describe('3. AI Analysis Quality and Scoring Accuracy', () => {
    test('should validate AI analysis quality and scoring accuracy', async () => {
      logger.info('Testing AI analysis quality and scoring accuracy');
      
      // Create job profile
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .send(testJobProfile)
        .expect(201);

      jobProfileId = jobProfileResponse.body.data.id;

      // Process senior candidate resume
      const resumeBuffer = Buffer.from(sampleResumes[0]?.content || ''); // John Doe - Senior
      const uploadResponse = await request(app)
        .post('/api/resume-processing/upload')
        .attach('files', resumeBuffer, sampleResumes[0]?.name || 'senior_resume.pdf')
        .field('jobProfileId', jobProfileId)
        .expect(200);

      const candidateId = uploadResponse.body.data.candidates[0].id;

      // Wait for processing completion
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 60;

      while (!processingComplete && attempts < maxAttempts) {
        const statusResponse = await request(app)
          .get(`/api/candidates/${candidateId}/status`)
          .expect(200);

        processingComplete = statusResponse.body.data.candidate.processingStage === 'completed';
        
        if (!processingComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      expect(processingComplete).toBe(true);

      // Validate AI analysis quality
      const candidateResponse = await request(app)
        .get(`/api/candidates/${candidateId}`)
        .expect(200);

      const candidate = candidateResponse.body.data;
      const aiAnalysis = candidate.aiAnalysis;

      // Validate AI analysis structure and content
      expect(aiAnalysis.relevanceScore).toBeGreaterThan(70); // Senior candidate should score high
      expect(aiAnalysis.skillsMatch.matched).toContain('JavaScript');
      expect(aiAnalysis.skillsMatch.matched).toContain('React');
      expect(aiAnalysis.skillsMatch.matched).toContain('Node.js');
      expect(aiAnalysis.reasoning).toBeTruthy();
      expect(aiAnalysis.confidence).toBeGreaterThan(0.7);

      // Validate scoring accuracy
      const finalScore = candidate.finalScore;
      expect(finalScore.compositeScore).toBeGreaterThan(75); // Senior candidate should score high overall
      
      // Validate weighted scoring calculation
      const expectedScore = 
        (finalScore.stageScores.resumeAnalysis * finalScore.appliedWeights.resumeAnalysis / 100) +
        (finalScore.stageScores.linkedInAnalysis * finalScore.appliedWeights.linkedInAnalysis / 100) +
        (finalScore.stageScores.githubAnalysis * finalScore.appliedWeights.githubAnalysis / 100) +
        (finalScore.stageScores.interviewPerformance * finalScore.appliedWeights.interviewPerformance / 100);

      expect(Math.abs(finalScore.compositeScore - expectedScore)).toBeLessThan(1); // Allow for rounding

      // Validate recommendation logic
      if (finalScore.compositeScore >= 85) {
        expect(finalScore.recommendation).toBe('strong-hire');
      } else if (finalScore.compositeScore >= 70) {
        expect(finalScore.recommendation).toBe('hire');
      } else if (finalScore.compositeScore >= 50) {
        expect(finalScore.recommendation).toBe('maybe');
      } else {
        expect(finalScore.recommendation).toBe('no-hire');
      }

      logger.info(`AI analysis validation completed - Score: ${finalScore.compositeScore}, Recommendation: ${finalScore.recommendation}`);
    }, 120000);
  });

  describe('4. System Performance Under Load', () => {
    test('should handle 100 resume batch processing within performance requirements', async () => {
      logger.info('Testing system performance with 100 resume batch');
      
      // Create job profile
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .send(testJobProfile)
        .expect(201);

      jobProfileId = jobProfileResponse.body.data.id;

      // Generate 100 test resumes with variations
      const batchResumes = Array.from({ length: 100 }, (_, i) => {
        const baseResume = sampleResumes[i % 3]; // Cycle through base templates
        return {
          name: `candidate_${i + 1}.pdf`,
          content: (baseResume?.content || '')
            .replace(/John Doe|Jane Smith|Bob Johnson/, `Candidate ${i + 1}`)
            .replace(/john\.doe@|jane\.smith@|bob\.johnson@/, `candidate${i + 1}@`)
            .replace(/johndoe|janesmith|bobjohnson/, `candidate${i + 1}`)
        };
      });

      const startTime = Date.now();

      // Create batch upload request
      const batchRequest = request(app)
        .post('/api/resume-processing/batch')
        .field('jobProfileId', jobProfileId);

      // Attach all resume files
      batchResumes.forEach(resume => {
        batchRequest.attach('files', Buffer.from(resume.content), resume.name);
      });

      const batchResponse = await batchRequest.expect(200);
      
      expect(batchResponse.body.success).toBe(true);
      expect(batchResponse.body.data.totalCandidates).toBe(100);
      batchId = batchResponse.body.data.batchId;

      logger.info(`Batch upload completed in ${Date.now() - startTime}ms`);

      // Monitor batch processing with performance metrics
      let batchComplete = false;
      let attempts = 0;
      const maxAttempts = 1440; // 24 minutes (requirement: complete within 24 hours)
      const performanceMetrics = {
        startTime: Date.now(),
        progressChecks: 0,
        averageProcessingTime: 0
      };

      while (!batchComplete && attempts < maxAttempts) {
        const progressResponse = await request(app)
          .get(`/api/candidates/batch/${batchId}/progress`)
          .expect(200);

        const progress = progressResponse.body.data;
        batchComplete = progress.status === 'completed';
        performanceMetrics.progressChecks++;
        
        if (!batchComplete) {
          const elapsed = Date.now() - performanceMetrics.startTime;
          const processed = progress.processedCandidates;
          if (processed > 0) {
            performanceMetrics.averageProcessingTime = elapsed / processed;
          }
          
          logger.info(`Batch progress: ${processed}/${progress.totalCandidates} processed (${Math.round(elapsed / 1000)}s elapsed)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      const totalProcessingTime = Date.now() - performanceMetrics.startTime;
      
      expect(batchComplete).toBe(true);
      expect(totalProcessingTime).toBeLessThan(24 * 60 * 60 * 1000); // Less than 24 hours
      
      logger.info(`100 resume batch processing completed in ${Math.round(totalProcessingTime / 1000)}s`);

      // Verify all candidates were processed
      const candidatesResponse = await request(app)
        .post('/api/candidates/search')
        .send({
          filters: { jobProfileId },
          options: { limit: 100 }
        })
        .expect(200);

      expect(candidatesResponse.body.data.candidates).toHaveLength(100);
      
      // Verify processing quality wasn't compromised
      const completedCandidates = candidatesResponse.body.data.candidates.filter(
        (c: any) => c.processingStage === 'completed'
      );
      
      expect(completedCandidates.length).toBeGreaterThan(95); // At least 95% success rate
      
      logger.info(`Performance test completed - ${completedCandidates.length}/100 candidates processed successfully`);
    }, 1500000); // 25 minute timeout
  });

  describe('5. External API Integration Verification', () => {
    test('should verify all external API integrations work correctly', async () => {
      logger.info('Testing external API integrations');
      
      // Create job profile
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .send(testJobProfile)
        .expect(201);

      jobProfileId = jobProfileResponse.body.data.id;

      // Test with resume containing all external service URLs
      const comprehensiveResume = `
Senior Full Stack Developer
Email: test@example.com
Phone: (555) 123-4567
LinkedIn: https://www.linkedin.com/in/testuser
GitHub: https://github.com/testuser

EXPERIENCE
Senior Software Engineer | TechCorp | 2020-2023
• Led development of React applications
• Built scalable Node.js APIs
• Implemented CI/CD with Docker and AWS

SKILLS
JavaScript, TypeScript, React, Node.js, MongoDB, AWS, Docker

PROJECTS
E-commerce Platform: https://github.com/testuser/ecommerce
Portfolio Website: https://github.com/testuser/portfolio
      `;

      const uploadResponse = await request(app)
        .post('/api/resume-processing/upload')
        .attach('files', Buffer.from(comprehensiveResume), 'comprehensive_resume.pdf')
        .field('jobProfileId', jobProfileId)
        .expect(200);

      const candidateId = uploadResponse.body.data.candidates[0].id;

      // Wait for processing completion
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 60;

      while (!processingComplete && attempts < maxAttempts) {
        const statusResponse = await request(app)
          .get(`/api/candidates/${candidateId}/status`)
          .expect(200);

        processingComplete = statusResponse.body.data.candidate.processingStage === 'completed';
        
        if (!processingComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      const candidateResponse = await request(app)
        .get(`/api/candidates/${candidateId}`)
        .expect(200);

      const candidate = candidateResponse.body.data;

      // Verify AI Analysis Integration (Gemini/OpenAI/Claude)
      expect(candidate.aiAnalysis).toBeDefined();
      expect(candidate.aiAnalysis.provider).toMatch(/gemini|openai|claude/);
      expect(candidate.aiAnalysis.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(candidate.aiAnalysis.reasoning).toBeTruthy();

      // Verify LinkedIn Integration
      expect(candidate.linkedInAnalysis).toBeDefined();
      expect(candidate.linkedInAnalysis.profileAccessible).toBeDefined();
      if (candidate.linkedInAnalysis.profileAccessible) {
        expect(candidate.linkedInAnalysis.professionalScore).toBeGreaterThanOrEqual(0);
      }

      // Verify GitHub Integration
      expect(candidate.githubAnalysis).toBeDefined();
      expect(candidate.githubAnalysis.profileStats).toBeDefined();
      expect(candidate.githubAnalysis.technicalScore).toBeGreaterThanOrEqual(0);

      // Verify VAPI Integration
      expect(candidate.interviewSession).toBeDefined();
      expect(candidate.interviewSession.status).toMatch(/scheduled|in-progress|completed|failed|no-answer/);

      // Test API health endpoints
      const healthResponse = await request(app)
        .get('/api/health/external-services')
        .expect(200);

      expect(healthResponse.body.services).toBeDefined();
      expect(healthResponse.body.services.ai).toBeDefined();
      expect(healthResponse.body.services.linkedin).toBeDefined();
      expect(healthResponse.body.services.github).toBeDefined();
      expect(healthResponse.body.services.vapi).toBeDefined();

      logger.info('External API integration verification completed');
    }, 120000);
  });

  describe('6. Final System Validation Against Requirements', () => {
    test('should validate system meets all functional requirements', async () => {
      logger.info('Conducting final system validation against all requirements');
      
      // Requirement 1: Job Profile Management
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .send(testJobProfile)
        .expect(201);

      jobProfileId = jobProfileResponse.body.data.id;
      expect(jobProfileResponse.body.data.title).toBe(testJobProfile.title);
      expect(jobProfileResponse.body.data.scoringWeights).toEqual(testJobProfile.scoringWeights);

      // Requirement 2: Bulk Resume Processing
      const batchUploadResponse = await request(app)
        .post('/api/resume-processing/batch')
        .attach('files', Buffer.from(sampleResumes[0]?.content || ''), sampleResumes[0]?.name || 'resume1.pdf')
        .attach('files', Buffer.from(sampleResumes[1]?.content || ''), sampleResumes[1]?.name || 'resume2.pdf')
        .field('jobProfileId', jobProfileId)
        .expect(200);

      expect(batchUploadResponse.body.data.totalCandidates).toBe(2);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Requirement 8: Comprehensive Scoring and Filtering
      const candidatesResponse = await request(app)
        .post('/api/candidates/search')
        .send({
          filters: { jobProfileId, minScore: 50 },
          options: { limit: 10, sortBy: 'finalScore.compositeScore', sortOrder: 'desc' }
        })
        .expect(200);

      const candidates = candidatesResponse.body.data.candidates;
      expect(candidates.length).toBeGreaterThan(0);

      // Verify each candidate has complete scoring
      candidates.forEach((candidate: any) => {
        expect(candidate.finalScore).toBeDefined();
        expect(candidate.finalScore.compositeScore).toBeGreaterThanOrEqual(0);
        expect(candidate.finalScore.compositeScore).toBeLessThanOrEqual(100);
        expect(candidate.finalScore.stageScores).toBeDefined();
        expect(candidate.finalScore.recommendation).toMatch(/strong-hire|hire|maybe|no-hire/);
      });

      // Requirement 9: Report Generation
      const reportResponse = await request(app)
        .post(`/api/reports/candidate/${candidates[0].id}/pdf`)
        .send({ candidate: candidates[0], jobProfile: testJobProfile })
        .expect(200);

      expect(reportResponse.body.success).toBe(true);
      expect(reportResponse.body.data.reportPath).toContain('.pdf');

      // Requirement 10: System Performance
      const healthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.services.database.status).toBe('connected');
      expect(healthResponse.body.services.redis.status).toBe('connected');

      logger.info('Final system validation completed successfully');
    }, 180000);

    test('should validate system error handling and recovery', async () => {
      logger.info('Testing system error handling and recovery mechanisms');
      
      // Test invalid file handling
      const invalidFileResponse = await request(app)
        .post('/api/resume-processing/upload')
        .attach('files', Buffer.from('Invalid PDF content'), 'invalid.pdf')
        .field('jobProfileId', 'invalid-job-id')
        .expect(404); // Should handle invalid job profile

      // Test rate limiting
      const rateLimitPromises = Array.from({ length: 20 }, () =>
        request(app).get('/api/health')
      );

      const rateLimitResponses = await Promise.all(rateLimitPromises);
      const rateLimitedResponses = rateLimitResponses.filter(r => r.status === 429);
      
      // Should have some rate limiting in effect
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Test system recovery after errors
      const recoveryHealthResponse = await request(app)
        .get('/api/health')
        .expect(200);

      expect(recoveryHealthResponse.body.status).toBe('healthy');

      logger.info('Error handling and recovery validation completed');
    }, 60000);
  });

  describe('7. Performance and Scalability Validation', () => {
    test('should validate UI response times under load', async () => {
      logger.info('Testing UI response times under concurrent load');
      
      // Create job profile for testing
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .send(testJobProfile)
        .expect(201);

      jobProfileId = jobProfileResponse.body.data.id;

      // Test concurrent API requests
      const concurrentRequests = Array.from({ length: 10 }, () => {
        const startTime = Date.now();
        return request(app)
          .get(`/api/job-profiles/${jobProfileId}`)
          .expect(200)
          .then(response => ({
            responseTime: Date.now() - startTime,
            success: response.status === 200
          }));
      });

      const results = await Promise.all(concurrentRequests);
      
      // Verify all requests succeeded
      expect(results.every(r => r.success)).toBe(true);
      
      // Verify response times are under 5 seconds (requirement)
      const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      expect(averageResponseTime).toBeLessThan(5000);

      logger.info(`Average response time under load: ${averageResponseTime}ms`);
    }, 60000);

    test('should validate memory management during large batch processing', async () => {
      logger.info('Testing memory management during batch processing');
      
      const initialMemory = process.memoryUsage();
      
      // Create job profile
      const jobProfileResponse = await request(app)
        .post('/api/job-profiles')
        .send(testJobProfile)
        .expect(201);

      jobProfileId = jobProfileResponse.body.data.id;

      // Process a smaller batch to test memory management
      const batchSize = 20;
      const batchResumes = Array.from({ length: batchSize }, (_, i) => ({
        name: `memory_test_${i}.pdf`,
        content: (sampleResumes[0]?.content || '').replace('John Doe', `Test Candidate ${i}`)
      }));

      const batchRequest = request(app)
        .post('/api/resume-processing/batch')
        .field('jobProfileId', jobProfileId);

      batchResumes.forEach(resume => {
        batchRequest.attach('files', Buffer.from(resume.content), resume.name);
      });

      const batchResponse = await batchRequest.expect(200);
      batchId = batchResponse.body.data.batchId;

      // Monitor memory usage during processing
      let processingComplete = false;
      let attempts = 0;
      const maxAttempts = 120;
      let maxMemoryUsage = initialMemory.heapUsed;

      while (!processingComplete && attempts < maxAttempts) {
        const currentMemory = process.memoryUsage();
        maxMemoryUsage = Math.max(maxMemoryUsage, currentMemory.heapUsed);

        const progressResponse = await request(app)
          .get(`/api/candidates/batch/${batchId}/progress`)
          .expect(200);

        processingComplete = progressResponse.body.data.status === 'completed';
        
        if (!processingComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerCandidate = memoryIncrease / batchSize;

      // Memory increase should be reasonable (less than 10MB per candidate)
      expect(memoryIncreasePerCandidate).toBeLessThan(10 * 1024 * 1024);

      logger.info(`Memory usage - Initial: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB, Final: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB, Increase per candidate: ${Math.round(memoryIncreasePerCandidate / 1024)}KB`);
    }, 180000);
  });
});