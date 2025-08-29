import express, { Request, Response } from 'express';
import { vapiInterviewService, VAPIWebhookPayload } from '../services/vapiInterviewService';
import { InterviewSession, Candidate, JobProfile } from '../models/interfaces';

const router = express.Router();

/**
 * POST /api/vapi/schedule-interview
 * Schedule an AI phone interview for a candidate
 */
router.post('/schedule-interview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId, jobProfileId, phoneNumber } = req.body;

    // Validate required fields
    if (!candidateId || !jobProfileId || !phoneNumber) {
      res.status(400).json({
        error: 'Missing required fields: candidateId, jobProfileId, phoneNumber',
      });
      return;
    }

    // In a real implementation, you would fetch these from the database
    // For now, we'll create mock objects for demonstration
    const mockCandidate: Candidate = {
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

    const mockJobProfile: JobProfile = {
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

    // Schedule the interview
    const interviewSession = await vapiInterviewService.scheduleInterview(
      mockCandidate,
      mockJobProfile,
      phoneNumber
    );

    res.status(201).json({
      success: true,
      data: interviewSession,
      message: 'Interview scheduled successfully',
    });

  } catch (error) {
    console.error('Failed to schedule interview:', error);
    res.status(500).json({
      error: 'Failed to schedule interview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/vapi/interview/:sessionId/status
 * Get interview session status and details
 */
router.get('/interview/:sessionId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({
        error: 'Session ID is required',
      });
      return;
    }

    // In a real implementation, you would fetch the session from the database
    // and then get the current VAPI call status
    
    // For demonstration, we'll create a mock session
    const mockSession: InterviewSession = {
      candidateId: 'candidate-123',
      jobProfileId: 'job-456',
      vapiCallId: sessionId,
      scheduledAt: new Date(),
      status: 'scheduled',
      callQuality: 'good',
      retryCount: 0,
    };

    // Get current call status from VAPI
    const vapiCallData = await vapiInterviewService.getCallStatus(mockSession.vapiCallId);
    
    // Update session based on VAPI data
    const updatedSession = await vapiInterviewService.updateInterviewSession(
      mockSession,
      vapiCallData
    );

    res.json({
      success: true,
      data: {
        session: updatedSession,
        vapiCall: vapiCallData,
      },
    });

  } catch (error) {
    console.error('Failed to get interview status:', error);
    res.status(500).json({
      error: 'Failed to get interview status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/vapi/interview/:sessionId/retry
 * Retry a failed or unanswered interview
 */
router.post('/interview/:sessionId/retry', async (req: Request, res: Response): Promise<void> => {
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

    // In a real implementation, you would fetch the session and related data from the database
    const mockSession: InterviewSession = {
      candidateId: 'candidate-123',
      jobProfileId: 'job-456',
      vapiCallId: sessionId,
      scheduledAt: new Date(),
      status: 'no-answer',
      callQuality: 'poor',
      retryCount: 1,
    };

    const mockCandidate: Candidate = {
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

    const mockJobProfile: JobProfile = {
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

    // Check if retry is allowed
    if (mockSession.retryCount >= 2) {
      res.status(400).json({
        error: 'Maximum retry attempts reached',
        message: 'This interview has already been retried the maximum number of times',
      });
      return;
    }

    // Retry the interview
    const updatedSession = await vapiInterviewService.retryInterview(
      mockSession,
      mockCandidate,
      mockJobProfile,
      phoneNumber
    );

    res.json({
      success: true,
      data: updatedSession,
      message: 'Interview retry scheduled successfully',
    });

  } catch (error) {
    console.error('Failed to retry interview:', error);
    res.status(500).json({
      error: 'Failed to retry interview',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/vapi/webhook
 * Handle VAPI webhooks for real-time call updates
 */
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookPayload: VAPIWebhookPayload = req.body;

    // Validate webhook payload
    if (!webhookPayload.message || !webhookPayload.message.call) {
      res.status(400).json({
        error: 'Invalid webhook payload',
      });
      return;
    }

    // Process the webhook
    await vapiInterviewService.processWebhook(webhookPayload);

    // Respond quickly to VAPI
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });

  } catch (error) {
    console.error('Failed to process VAPI webhook:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/vapi/test-connection
 * Test VAPI API connectivity
 */
router.get('/test-connection', async (req: Request, res: Response): Promise<void> => {
  try {
    const isConnected = await vapiInterviewService.testConnection();
    
    if (isConnected) {
      const accountInfo = await vapiInterviewService.getAccountInfo();
      
      res.json({
        success: true,
        connected: true,
        accountInfo,
        message: 'VAPI connection successful',
      });
    } else {
      res.status(503).json({
        success: false,
        connected: false,
        message: 'VAPI connection failed',
      });
    }

  } catch (error) {
    console.error('VAPI connection test failed:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: 'Connection test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/vapi/account-info
 * Get VAPI account information and usage
 */
router.get('/account-info', async (req: Request, res: Response): Promise<void> => {
  try {
    const accountInfo = await vapiInterviewService.getAccountInfo();
    
    if (accountInfo) {
      res.json({
        success: true,
        data: accountInfo,
      });
    } else {
      res.status(503).json({
        success: false,
        error: 'Unable to retrieve account information',
      });
    }

  } catch (error) {
    console.error('Failed to get VAPI account info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get account information',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;