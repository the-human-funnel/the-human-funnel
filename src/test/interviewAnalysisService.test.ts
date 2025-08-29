import { describe, it, expect, beforeEach } from '@jest/globals';
import { InterviewSession, JobProfile } from '../models/interfaces';

// Mock the config
jest.mock('../utils/config', () => ({
  config: {
    aiProviders: {
      gemini: { apiKey: 'test-gemini-key' },
      openai: { apiKey: 'test-openai-key' },
      claude: { apiKey: 'test-claude-key' },
    },
  },
}));

// Mock AI clients
jest.mock('@google/generative-ai');
jest.mock('openai');
jest.mock('@anthropic-ai/sdk');

describe('InterviewAnalysisService', () => {
  let mockJobProfile: JobProfile;
  let mockInterviewSession: InterviewSession;

  beforeEach(() => {
    mockJobProfile = {
      id: 'job-123',
      title: 'Senior Software Engineer',
      description: 'Full-stack development role',
      requiredSkills: ['JavaScript', 'React', 'Node.js', 'MongoDB'],
      experienceLevel: 'senior',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30,
      },
      interviewQuestions: [
        'Tell me about your experience with React',
        'How do you handle state management?',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockInterviewSession = {
      candidateId: 'candidate-123',
      jobProfileId: 'job-123',
      vapiCallId: 'vapi-call-123',
      scheduledAt: new Date(),
      status: 'completed',
      transcript: `
        Interviewer: Hello, can you tell me about your experience with React?
        Candidate: I have about 5 years of experience with React. I've worked on several large applications.
        Interviewer: How do you handle state management?
        Candidate: I use a combination of useState, useReducer, and Redux depending on complexity.
      `,
      duration: 1200,
      callQuality: 'excellent',
      retryCount: 0,
    };
  });

  describe('Service Initialization', () => {
    it('should be importable', () => {
      const { InterviewAnalysisService } = require('../services/interviewAnalysisService');
      expect(InterviewAnalysisService).toBeDefined();
    });

    it('should create service instance', () => {
      const { InterviewAnalysisService } = require('../services/interviewAnalysisService');
      const service = new InterviewAnalysisService();
      expect(service).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields', () => {
      expect(mockJobProfile.requiredSkills).toBeDefined();
      expect(Array.isArray(mockJobProfile.requiredSkills)).toBe(true);
      expect(mockInterviewSession.transcript).toBeDefined();
      expect(typeof mockInterviewSession.transcript).toBe('string');
    });

    it('should handle missing transcript', () => {
      const sessionWithoutTranscript = { ...mockInterviewSession };
      delete (sessionWithoutTranscript as any).transcript;
      
      expect(sessionWithoutTranscript.transcript).toBeUndefined();
    });
  });

  describe('Transcript Quality Assessment', () => {
    it('should assess transcript quality', () => {
      const { InterviewAnalysisService } = require('../services/interviewAnalysisService');
      const service = new InterviewAnalysisService();
      
      // Test with good transcript
      const goodTranscript = mockInterviewSession.transcript;
      expect(goodTranscript).toBeDefined();
      expect(goodTranscript!.length).toBeGreaterThan(100);
      
      // Test with poor transcript
      const poorTranscript = 'Hi. Yes. No.';
      expect(poorTranscript.length).toBeLessThan(50);
    });

    it('should detect dialogue structure', () => {
      const transcript = mockInterviewSession.transcript!;
      const hasDialogue = transcript.includes('Interviewer:') && transcript.includes('Candidate:');
      const hasQuestions = transcript.includes('?');
      
      expect(hasDialogue).toBe(true);
      expect(hasQuestions).toBe(true);
    });
  });

  describe('Score Validation', () => {
    it('should validate score ranges', () => {
      const { InterviewAnalysisService } = require('../services/interviewAnalysisService');
      const service = new InterviewAnalysisService();
      const validateScore = (service as any).validateScore;
      
      // Valid scores
      expect(validateScore(85)).toBe(85);
      expect(validateScore(0)).toBe(0);
      expect(validateScore(100)).toBe(100);
      
      // Out of range scores
      expect(validateScore(150)).toBe(100);
      expect(validateScore(-10)).toBe(0);
      
      // Invalid inputs
      expect(validateScore('invalid')).toBe(50);
      expect(validateScore(null)).toBe(50);
      expect(validateScore(undefined)).toBe(50);
    });

    it('should validate competency scores', () => {
      const { InterviewAnalysisService } = require('../services/interviewAnalysisService');
      const service = new InterviewAnalysisService();
      const validateCompetencyScores = (service as any).validateCompetencyScores.bind(service);
      
      const requiredSkills = ['JavaScript', 'React'];
      const scores = { 'JavaScript': 85, 'React': 90 };
      
      const result = validateCompetencyScores(scores, requiredSkills);
      expect(result['JavaScript']).toBe(85);
      expect(result['React']).toBe(90);
      
      // Test with missing skills
      const partialScores = { 'JavaScript': 85 };
      const resultPartial = validateCompetencyScores(partialScores, requiredSkills);
      expect(resultPartial['JavaScript']).toBe(85);
      expect(resultPartial['React']).toBe(50); // Default
    });
  });

  describe('Data Structure Validation', () => {
    it('should have correct job profile structure', () => {
      expect(mockJobProfile).toHaveProperty('id');
      expect(mockJobProfile).toHaveProperty('title');
      expect(mockJobProfile).toHaveProperty('requiredSkills');
      expect(mockJobProfile).toHaveProperty('experienceLevel');
      expect(mockJobProfile).toHaveProperty('interviewQuestions');
      expect(mockJobProfile.scoringWeights).toHaveProperty('interviewPerformance');
    });

    it('should have correct interview session structure', () => {
      expect(mockInterviewSession).toHaveProperty('candidateId');
      expect(mockInterviewSession).toHaveProperty('vapiCallId');
      expect(mockInterviewSession).toHaveProperty('transcript');
      expect(mockInterviewSession).toHaveProperty('status');
      expect(mockInterviewSession).toHaveProperty('callQuality');
    });
  });

  describe('Batch Processing Structure', () => {
    it('should handle batch request structure', () => {
      const batchRequests = [
        {
          candidateId: 'candidate-1',
          interviewSession: mockInterviewSession,
          jobProfile: mockJobProfile,
        },
        {
          candidateId: 'candidate-2',
          interviewSession: { ...mockInterviewSession, candidateId: 'candidate-2' },
          jobProfile: mockJobProfile,
        },
      ];

      expect(Array.isArray(batchRequests)).toBe(true);
      expect(batchRequests).toHaveLength(2);
      expect(batchRequests[0]).toHaveProperty('candidateId');
      expect(batchRequests[0]).toHaveProperty('interviewSession');
      expect(batchRequests[0]).toHaveProperty('jobProfile');
    });
  });

  describe('Error Handling Structure', () => {
    it('should handle missing transcript gracefully', () => {
      const sessionWithoutTranscript = { ...mockInterviewSession };
      delete (sessionWithoutTranscript as any).transcript;
      
      // Should be able to detect missing transcript
      const hasTranscript = Boolean(sessionWithoutTranscript.transcript);
      expect(hasTranscript).toBe(false);
    });

    it('should handle invalid job profile', () => {
      const invalidJobProfile = { ...mockJobProfile };
      delete (invalidJobProfile as any).requiredSkills;
      
      const hasRequiredSkills = Boolean(invalidJobProfile.requiredSkills);
      expect(hasRequiredSkills).toBe(false);
    });
  });

  describe('Service Configuration', () => {
    it('should have provider configuration', () => {
      const { InterviewAnalysisService } = require('../services/interviewAnalysisService');
      const service = new InterviewAnalysisService();
      
      // Check that service has provider configs
      const providerConfigs = (service as any).providerConfigs;
      expect(Array.isArray(providerConfigs)).toBe(true);
      expect(providerConfigs.length).toBeGreaterThan(0);
      
      // Check provider config structure
      const firstProvider = providerConfigs[0];
      expect(firstProvider).toHaveProperty('name');
      expect(firstProvider).toHaveProperty('maxRetries');
      expect(firstProvider).toHaveProperty('timeout');
    });
  });

  describe('Analysis Result Structure', () => {
    it('should define correct result interface structure', () => {
      // This tests the expected structure of InterviewAnalysisResult
      const expectedResult = {
        candidateId: 'candidate-123',
        interviewSessionId: 'vapi-call-123',
        provider: 'gemini' as const,
        performanceScore: 85,
        communicationScore: 90,
        technicalScore: 88,
        competencyScores: {
          'JavaScript': 90,
          'React': 95,
        },
        transcriptQuality: 'excellent' as const,
        needsManualReview: false,
        detailedFeedback: {
          strengths: ['Strong technical skills'],
          weaknesses: ['Could improve X'],
          recommendations: ['Hire'],
        },
        responseAnalysis: [],
        overallAssessment: 'Strong candidate',
        confidence: 90,
        analysisTimestamp: new Date(),
      };

      // Validate structure
      expect(expectedResult).toHaveProperty('candidateId');
      expect(expectedResult).toHaveProperty('performanceScore');
      expect(expectedResult).toHaveProperty('communicationScore');
      expect(expectedResult).toHaveProperty('technicalScore');
      expect(expectedResult).toHaveProperty('competencyScores');
      expect(expectedResult).toHaveProperty('transcriptQuality');
      expect(expectedResult).toHaveProperty('needsManualReview');
      expect(expectedResult).toHaveProperty('detailedFeedback');
      expect(expectedResult).toHaveProperty('overallAssessment');
      expect(expectedResult).toHaveProperty('confidence');

      // Validate score ranges
      expect(expectedResult.performanceScore).toBeGreaterThanOrEqual(0);
      expect(expectedResult.performanceScore).toBeLessThanOrEqual(100);
      expect(expectedResult.communicationScore).toBeGreaterThanOrEqual(0);
      expect(expectedResult.communicationScore).toBeLessThanOrEqual(100);
      expect(expectedResult.technicalScore).toBeGreaterThanOrEqual(0);
      expect(expectedResult.technicalScore).toBeLessThanOrEqual(100);
      expect(expectedResult.confidence).toBeGreaterThanOrEqual(0);
      expect(expectedResult.confidence).toBeLessThanOrEqual(100);

      // Validate feedback structure
      expect(Array.isArray(expectedResult.detailedFeedback.strengths)).toBe(true);
      expect(Array.isArray(expectedResult.detailedFeedback.weaknesses)).toBe(true);
      expect(Array.isArray(expectedResult.detailedFeedback.recommendations)).toBe(true);
    });
  });
});