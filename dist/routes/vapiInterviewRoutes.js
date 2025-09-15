"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const vapiInterviewService_1 = require("../services/vapiInterviewService");
const router = express_1.default.Router();
router.post('/schedule-interview', async (req, res) => {
    try {
        const { candidateId, jobProfileId, phoneNumber } = req.body;
        if (!candidateId || !jobProfileId || !phoneNumber) {
            res.status(400).json({
                error: 'Missing required fields: candidateId, jobProfileId, phoneNumber',
            });
            return;
        }
        const mockCandidate = {
            id: candidateId,
            resumeData: {
                id: `resume-${candidateId}`,
                fileName: 'resume.pdf',
                extractedText: 'Mock resume text',
                contactInfo: {
                    phone: phoneNumber,
                    email: 'candidate@example.com',
                    projectUrls: [],
                },
                processingStatus: 'completed',
            },
            processingStage: 'interview',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const mockJobProfile = {
            id: jobProfileId,
            title: 'Software Engineer',
            description: 'Full-stack software engineer position',
            requiredSkills: ['JavaScript', 'React', 'Node.js'],
            experienceLevel: 'Mid-level',
            scoringWeights: {
                resumeAnalysis: 25,
                linkedInAnalysis: 20,
                githubAnalysis: 25,
                interviewPerformance: 30,
            },
            interviewQuestions: [
                'Can you describe your experience with full-stack development?',
                'How do you approach debugging complex issues?',
                'Tell me about a challenging project you worked on recently.',
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const interviewSession = await vapiInterviewService_1.vapiInterviewService.scheduleInterview(mockCandidate, mockJobProfile, phoneNumber);
        res.status(201).json({
            success: true,
            data: interviewSession,
            message: 'Interview scheduled successfully',
        });
    }
    catch (error) {
        console.error('Failed to schedule interview:', error);
        res.status(500).json({
            error: 'Failed to schedule interview',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/interview/:sessionId/status', async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            res.status(400).json({
                error: 'Session ID is required',
            });
            return;
        }
        const mockSession = {
            candidateId: 'candidate-123',
            jobProfileId: 'job-456',
            vapiCallId: sessionId,
            scheduledAt: new Date(),
            status: 'scheduled',
            callQuality: 'good',
            retryCount: 0,
        };
        const vapiCallData = await vapiInterviewService_1.vapiInterviewService.getCallStatus(mockSession.vapiCallId);
        const updatedSession = await vapiInterviewService_1.vapiInterviewService.updateInterviewSession(mockSession, vapiCallData);
        res.json({
            success: true,
            data: {
                session: updatedSession,
                vapiCall: vapiCallData,
            },
        });
    }
    catch (error) {
        console.error('Failed to get interview status:', error);
        res.status(500).json({
            error: 'Failed to get interview status',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/interview/:sessionId/retry', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { phoneNumber } = req.body;
        if (!sessionId) {
            res.status(400).json({
                error: 'Session ID is required',
            });
            return;
        }
        if (!phoneNumber) {
            res.status(400).json({
                error: 'Phone number is required for retry',
            });
            return;
        }
        const mockSession = {
            candidateId: 'candidate-123',
            jobProfileId: 'job-456',
            vapiCallId: sessionId,
            scheduledAt: new Date(),
            status: 'no-answer',
            callQuality: 'poor',
            retryCount: 1,
        };
        const mockCandidate = {
            id: mockSession.candidateId,
            resumeData: {
                id: `resume-${mockSession.candidateId}`,
                fileName: 'resume.pdf',
                extractedText: 'Mock resume text',
                contactInfo: {
                    phone: phoneNumber,
                    email: 'candidate@example.com',
                    projectUrls: [],
                },
                processingStatus: 'completed',
            },
            processingStage: 'interview',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const mockJobProfile = {
            id: mockSession.jobProfileId,
            title: 'Software Engineer',
            description: 'Full-stack software engineer position',
            requiredSkills: ['JavaScript', 'React', 'Node.js'],
            experienceLevel: 'Mid-level',
            scoringWeights: {
                resumeAnalysis: 25,
                linkedInAnalysis: 20,
                githubAnalysis: 25,
                interviewPerformance: 30,
            },
            interviewQuestions: [
                'Can you describe your experience with full-stack development?',
                'How do you approach debugging complex issues?',
                'Tell me about a challenging project you worked on recently.',
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        if (mockSession.retryCount >= 2) {
            res.status(400).json({
                error: 'Maximum retry attempts reached',
                message: 'This interview has already been retried the maximum number of times',
            });
            return;
        }
        const updatedSession = await vapiInterviewService_1.vapiInterviewService.retryInterview(mockSession, mockCandidate, mockJobProfile, phoneNumber);
        res.json({
            success: true,
            data: updatedSession,
            message: 'Interview retry scheduled successfully',
        });
    }
    catch (error) {
        console.error('Failed to retry interview:', error);
        res.status(500).json({
            error: 'Failed to retry interview',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/webhook', async (req, res) => {
    try {
        const webhookPayload = req.body;
        if (!webhookPayload.message || !webhookPayload.message.call) {
            res.status(400).json({
                error: 'Invalid webhook payload',
            });
            return;
        }
        await vapiInterviewService_1.vapiInterviewService.processWebhook(webhookPayload);
        res.status(200).json({
            success: true,
            message: 'Webhook processed successfully',
        });
    }
    catch (error) {
        console.error('Failed to process VAPI webhook:', error);
        res.status(500).json({
            error: 'Failed to process webhook',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/test-connection', async (req, res) => {
    try {
        const isConnected = await vapiInterviewService_1.vapiInterviewService.testConnection();
        if (isConnected) {
            const accountInfo = await vapiInterviewService_1.vapiInterviewService.getAccountInfo();
            res.json({
                success: true,
                connected: true,
                accountInfo,
                message: 'VAPI connection successful',
            });
        }
        else {
            res.status(503).json({
                success: false,
                connected: false,
                message: 'VAPI connection failed',
            });
        }
    }
    catch (error) {
        console.error('VAPI connection test failed:', error);
        res.status(500).json({
            success: false,
            connected: false,
            error: 'Connection test failed',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/account-info', async (req, res) => {
    try {
        const accountInfo = await vapiInterviewService_1.vapiInterviewService.getAccountInfo();
        if (accountInfo) {
            res.json({
                success: true,
                data: accountInfo,
            });
        }
        else {
            res.status(503).json({
                success: false,
                error: 'Unable to retrieve account information',
            });
        }
    }
    catch (error) {
        console.error('Failed to get VAPI account info:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get account information',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=vapiInterviewRoutes.js.map