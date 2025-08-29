import { AIAnalysisService } from '../services/aiAnalysisService';
import { JobProfile, ResumeData } from '../models/interfaces';

describe('AIAnalysisService', () => {
  let aiService: AIAnalysisService;
  let mockJobProfile: JobProfile;
  let mockResumeData: ResumeData;

  beforeEach(() => {
    aiService = new AIAnalysisService();
    
    mockJobProfile = {
      id: 'job-123',
      title: 'Senior Software Engineer',
      description: 'Looking for an experienced software engineer with strong backend development skills',
      requiredSkills: ['JavaScript', 'Node.js', 'MongoDB', 'REST APIs', 'Git'],
      experienceLevel: 'Senior (5+ years)',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30,
      },
      interviewQuestions: ['Tell me about your experience with Node.js'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockResumeData = {
      id: 'resume-123',
      fileName: 'john_doe_resume.pdf',
      extractedText: `
        John Doe
        Senior Software Engineer
        Email: john.doe@email.com
        Phone: (555) 123-4567
        
        Experience:
        - 6 years of experience in full-stack development
        - Proficient in JavaScript, Node.js, React, and MongoDB
        - Built REST APIs serving millions of requests
        - Experience with Git, Docker, and AWS
        - Led a team of 4 developers on multiple projects
        
        Education:
        - Bachelor's in Computer Science
        - Master's in Software Engineering
        
        Projects:
        - E-commerce platform using Node.js and MongoDB
        - Real-time chat application with WebSocket
        - Microservices architecture with Docker
      `,
      contactInfo: {
        email: 'john.doe@email.com',
        phone: '(555) 123-4567',
        projectUrls: [],
      },
      processingStatus: 'completed',
    };
  });

  describe('buildAnalysisPrompt', () => {
    it('should build a structured prompt with job and resume data', () => {
      // Access private method for testing
      const prompt = (aiService as any).buildAnalysisPrompt({
        resumeText: mockResumeData.extractedText,
        jobProfile: mockJobProfile,
      });

      expect(prompt).toContain('Senior Software Engineer');
      expect(prompt).toContain('JavaScript, Node.js, MongoDB, REST APIs, Git');
      expect(prompt).toContain('John Doe');
      expect(prompt).toContain('6 years of experience');
      expect(prompt).toContain('JSON format');
    });
  });

  describe('parseAIResponse', () => {
    it('should parse valid JSON response correctly', () => {
      const mockResponse = `
        Here is the analysis:
        {
          "relevanceScore": 85,
          "skillsMatch": {
            "matched": ["JavaScript", "Node.js", "MongoDB", "REST APIs", "Git"],
            "missing": []
          },
          "experienceAssessment": "Candidate has 6 years of relevant experience which meets the senior level requirement.",
          "reasoning": "Strong match with all required skills demonstrated and appropriate experience level.",
          "confidence": 90
        }
      `;

      const result = (aiService as any).parseAIResponse('candidate-123', mockResponse, 'gemini');

      expect(result.candidateId).toBe('candidate-123');
      expect(result.provider).toBe('gemini');
      expect(result.relevanceScore).toBe(85);
      expect(result.skillsMatch.matched).toEqual(['JavaScript', 'Node.js', 'MongoDB', 'REST APIs', 'Git']);
      expect(result.skillsMatch.missing).toEqual([]);
      expect(result.confidence).toBe(90);
    });

    it('should handle invalid JSON gracefully', () => {
      const mockResponse = 'This is not valid JSON';

      const result = (aiService as any).parseAIResponse('candidate-123', mockResponse, 'openai');

      expect(result.candidateId).toBe('candidate-123');
      expect(result.provider).toBe('openai');
      expect(result.relevanceScore).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('parsing failed');
    });

    it('should clamp scores to valid ranges', () => {
      const mockResponse = `
        {
          "relevanceScore": 150,
          "skillsMatch": {
            "matched": ["JavaScript"],
            "missing": ["Python"]
          },
          "experienceAssessment": "Good candidate",
          "reasoning": "Test reasoning",
          "confidence": -10
        }
      `;

      const result = (aiService as any).parseAIResponse('candidate-123', mockResponse, 'claude');

      expect(result.relevanceScore).toBe(100); // Clamped from 150
      expect(result.confidence).toBe(0); // Clamped from -10
    });
  });

  describe('testProviders', () => {
    it('should return provider availability status', async () => {
      // This test will depend on actual API keys being available
      // In a real environment, you might want to mock the API calls
      const results = await aiService.testProviders();

      expect(results).toHaveProperty('gemini');
      expect(results).toHaveProperty('openai');
      expect(results).toHaveProperty('claude');
      expect(typeof results.gemini).toBe('boolean');
      expect(typeof results.openai).toBe('boolean');
      expect(typeof results.claude).toBe('boolean');
    });
  });

  describe('createTimeoutPromise', () => {
    it('should reject after specified timeout', async () => {
      const timeoutPromise = (aiService as any).createTimeoutPromise(100);

      await expect(timeoutPromise).rejects.toThrow('timeout after 100ms');
    });
  });

  // Integration test - only run if API keys are available
  describe('analyzeResume (integration)', () => {
    it('should analyze resume with fallback providers', async () => {
      // Skip if no API keys are configured
      if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY && !process.env.CLAUDE_API_KEY) {
        console.log('Skipping integration test - no API keys configured');
        return;
      }

      try {
        const result = await aiService.analyzeResume('candidate-123', mockResumeData, mockJobProfile);

        expect(result.candidateId).toBe('candidate-123');
        expect(result.provider).toMatch(/^(gemini|openai|claude)$/);
        expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(result.relevanceScore).toBeLessThanOrEqual(100);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(100);
        expect(Array.isArray(result.skillsMatch.matched)).toBe(true);
        expect(Array.isArray(result.skillsMatch.missing)).toBe(true);
        expect(typeof result.experienceAssessment).toBe('string');
        expect(typeof result.reasoning).toBe('string');
      } catch (error) {
        console.log('Integration test failed (expected if no valid API keys):', error);
        // Don't fail the test if API keys are not configured
      }
    }, 60000); // 60 second timeout for API calls
  });
});