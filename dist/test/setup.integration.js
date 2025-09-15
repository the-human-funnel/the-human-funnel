"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.PORT = '0';
process.env.LOG_LEVEL = 'error';
globals_1.jest.mock('../services/aiAnalysisService', () => ({
    AIAnalysisService: globals_1.jest.fn().mockImplementation(() => ({
        analyzeResume: globals_1.jest.fn().mockResolvedValue({
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
        testProviderConnectivity: globals_1.jest.fn().mockResolvedValue({
            gemini: { status: 'connected', responseTime: 150 },
            openai: { status: 'connected', responseTime: 200 },
            claude: { status: 'connected', responseTime: 180 }
        })
    }))
}));
globals_1.jest.mock('../services/linkedInAnalysisService', () => ({
    LinkedInAnalysisService: globals_1.jest.fn().mockImplementation(() => ({
        analyzeProfile: globals_1.jest.fn().mockResolvedValue({
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
        testConnection: globals_1.jest.fn().mockResolvedValue({ status: 'connected' })
    }))
}));
globals_1.jest.mock('../services/githubAnalysisService', () => ({
    GitHubAnalysisService: globals_1.jest.fn().mockImplementation(() => ({
        analyzeProfile: globals_1.jest.fn().mockResolvedValue({
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
        testConnection: globals_1.jest.fn().mockResolvedValue({ status: 'connected' })
    }))
}));
globals_1.jest.mock('../services/vapiInterviewService', () => ({
    VAPIInterviewService: globals_1.jest.fn().mockImplementation(() => ({
        scheduleInterview: globals_1.jest.fn().mockResolvedValue({
            candidateId: 'test-candidate',
            jobProfileId: 'test-job-profile',
            vapiCallId: 'vapi-call-123',
            scheduledAt: new Date(),
            status: 'scheduled',
            retryCount: 0
        }),
        getInterviewStatus: globals_1.jest.fn().mockResolvedValue({
            status: 'completed',
            transcript: 'Mock interview transcript...',
            duration: 900,
            callQuality: 'good'
        }),
        testConnection: globals_1.jest.fn().mockResolvedValue({ status: 'connected' })
    }))
}));
globals_1.jest.mock('../services/interviewAnalysisService', () => ({
    InterviewAnalysisService: globals_1.jest.fn().mockImplementation(() => ({
        analyzeTranscript: globals_1.jest.fn().mockResolvedValue({
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
        testProviderConnectivity: globals_1.jest.fn().mockResolvedValue({
            gemini: { status: 'connected', responseTime: 150 }
        })
    }))
}));
globals_1.jest.setTimeout(120000);
if (process.env.LOG_LEVEL !== 'debug') {
    global.console = {
        ...console,
        log: globals_1.jest.fn(),
        debug: globals_1.jest.fn(),
        info: globals_1.jest.fn(),
        warn: globals_1.jest.fn(),
        error: globals_1.jest.fn(),
    };
}
afterEach(() => {
    globals_1.jest.clearAllMocks();
});
//# sourceMappingURL=setup.integration.js.map