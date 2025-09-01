import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.PORT = '0'; // Use random available port
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock external services for integration tests
jest.mock('../services/aiAnalysisService', () => ({
  AIAnalysisService: jest.fn().mockImplementation(() => ({
    analyzeResume: jest.fn().mockResolvedValue({
      candidateId: 'test-candidate',
      provider: 'gemini',
      relevanceScore: 85,
      skillsMatch: {
        matched: ['JavaScript', 'React', 'Node.js'],
        missing: ['Python']
      },
      experienceAssessment: 'Strong experience in full-stack development',
      reasoning: 'Candidate demonstrates excellent technical skills',
      confidence: 90
    }),
    testProviderConnectivity: jest.fn().mockResolvedValue({
      gemini: { status: 'connected', responseTime: 150 },
      openai: { status: 'connected', responseTime: 200 },
      claude: { status: 'connected', responseTime: 180 }
    })
  }))
}));

jest.mock('../services/linkedInAnalysisService', () => ({
  LinkedInAnalysisService: jest.fn().mockImplementation(() => ({
    analyzeProfile: jest.fn().mockResolvedValue({
      candidateId: 'test-candidate',
      profileAccessible: true,
      professionalScore: 78,
      experience: {
        totalYears: 5,
        relevantRoles: 3,
        companyQuality: 'high'
      },
      network: {
        connections: 500,
        endorsements: 25
      },
      credibilityIndicators: ['Verified experience', 'Strong network']
    }),
    testConnection: jest.fn().mockResolvedValue({ status: 'connected' })
  }))
}));

jest.mock('../services/githubAnalysisService', () => ({
  GitHubAnalysisService: jest.fn().mockImplementation(() => ({
    analyzeProfile: jest.fn().mockResolvedValue({
      candidateId: 'test-candidate',
      profileStats: {
        publicRepos: 25,
        followers: 50,
        contributionStreak: 180,
        totalCommits: 1200
      },
      technicalScore: 82,
      projectAuthenticity: {
        resumeProjects: [{
          url: 'https://github.com/johndoe/project1',
          isAuthentic: true,
          commitHistory: 45,
          branchingPattern: 'feature-based',
          codeQuality: 'high'
        }]
      },
      skillsEvidence: ['JavaScript', 'React', 'Node.js', 'MongoDB']
    }),
    testConnection: jest.fn().mockResolvedValue({ status: 'connected' })
  }))
}));

jest.mock('../services/vapiInterviewService', () => ({
  VAPIInterviewService: jest.fn().mockImplementation(() => ({
    scheduleInterview: jest.fn().mockResolvedValue({
      candidateId: 'test-candidate',
      jobProfileId: 'test-job-profile',
      vapiCallId: 'vapi-call-123',
      scheduledAt: new Date(),
      status: 'scheduled',
      retryCount: 0
    }),
    getInterviewStatus: jest.fn().mockResolvedValue({
      status: 'completed',
      transcript: 'Mock interview transcript...',
      duration: 900,
      callQuality: 'good'
    }),
    testConnection: jest.fn().mockResolvedValue({ status: 'connected' })
  }))
}));

jest.mock('../services/interviewAnalysisService', () => ({
  InterviewAnalysisService: jest.fn().mockImplementation(() => ({
    analyzeTranscript: jest.fn().mockResolvedValue({
      candidateId: 'test-candidate',
      interviewSessionId: 'session-123',
      provider: 'gemini',
      performanceScore: 80,
      communicationScore: 85,
      technicalScore: 75,
      competencyScores: {
        'JavaScript': 85,
        'React': 80,
        'Problem Solving': 75
      },
      transcriptQuality: 'good',
      needsManualReview: false,
      detailedFeedback: {
        strengths: ['Clear communication', 'Strong technical knowledge'],
        weaknesses: ['Could improve on system design'],
        recommendations: ['Consider for next round']
      },
      responseAnalysis: [{
        question: 'Tell me about your React experience',
        response: 'I have 3 years of React experience...',
        score: 85,
        feedback: 'Comprehensive answer with good examples'
      }],
      overallAssessment: 'Strong candidate with good technical and communication skills',
      confidence: 88,
      analysisTimestamp: new Date()
    }),
    testProviderConnectivity: jest.fn().mockResolvedValue({
      gemini: { status: 'connected', responseTime: 150 }
    })
  }))
}));

// Global test timeout
jest.setTimeout(120000);

// Suppress console logs during tests unless LOG_LEVEL is debug
if (process.env.LOG_LEVEL !== 'debug') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Clean up after tests
afterEach(() => {
  jest.clearAllMocks();
});

export {};