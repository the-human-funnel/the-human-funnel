import express, { Request, Response } from 'express';
import { interviewAnalysisService } from '../services/interviewAnalysisService';
import { InterviewSession, JobProfile, InterviewAnalysisResult } from '../models/interfaces';

const router = express.Router();

/**
 * Analyze a single interview transcript
 * POST /api/interview-analysis/analyze
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId, interviewSession, jobProfile } = req.body;

    // Validate required fields
    if (!candidateId || !interviewSession || !jobProfile) {
      res.status(400).json({
        error: 'Missing required fields: candidateId, interviewSession, and jobProfile are required',
      });
      return;
    }

    // Validate interview session has transcript
    if (!interviewSession.transcript) {
      res.status(400).json({
        error: 'Interview session must have a transcript for analysis',
      });
      return;
    }

    // Validate job profile has required fields
    if (!jobProfile.requiredSkills || !Array.isArray(jobProfile.requiredSkills)) {
      res.status(400).json({
        error: 'Job profile must have requiredSkills array',
      });
      return;
    }

    console.log(`Starting interview analysis for candidate ${candidateId}`);

    const analysisResult = await interviewAnalysisService.analyzeTranscript(
      candidateId,
      interviewSession as InterviewSession,
      jobProfile as JobProfile
    );

    console.log(`Completed interview analysis for candidate ${candidateId}`);

    res.json({
      success: true,
      data: analysisResult,
    });

  } catch (error) {
    console.error('Interview analysis failed:', error);
    
    res.status(500).json({
      error: 'Interview analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * Batch analyze multiple interview transcripts
 * POST /api/interview-analysis/batch-analyze
 */
router.post('/batch-analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { analysisRequests } = req.body;

    // Validate input
    if (!Array.isArray(analysisRequests) || analysisRequests.length === 0) {
      res.status(400).json({
        error: 'analysisRequests must be a non-empty array',
      });
      return;
    }

    // Validate each request
    for (let i = 0; i < analysisRequests.length; i++) {
      const request = analysisRequests[i];
      if (!request.candidateId || !request.interviewSession || !request.jobProfile) {
        res.status(400).json({
          error: `Invalid request at index ${i}: missing candidateId, interviewSession, or jobProfile`,
        });
        return;
      }

      if (!request.interviewSession.transcript) {
        res.status(400).json({
          error: `Invalid request at index ${i}: interview session must have a transcript`,
        });
        return;
      }
    }

    console.log(`Starting batch interview analysis for ${analysisRequests.length} candidates`);

    const results = await interviewAnalysisService.batchAnalyzeTranscripts(analysisRequests);

    const successCount = results.filter(r => r.result).length;
    const errorCount = results.filter(r => r.error).length;

    console.log(`Completed batch interview analysis: ${successCount} successful, ${errorCount} failed`);

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
        },
      },
    });

  } catch (error) {
    console.error('Batch interview analysis failed:', error);
    
    res.status(500).json({
      error: 'Batch interview analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * Get analysis result by candidate ID
 * GET /api/interview-analysis/candidate/:candidateId
 */
router.get('/candidate/:candidateId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId } = req.params;

    if (!candidateId) {
      res.status(400).json({
        error: 'Candidate ID is required',
      });
      return;
    }

    // This would typically fetch from database
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Analysis retrieval not yet implemented - requires database integration',
      candidateId,
    });

  } catch (error) {
    console.error('Failed to retrieve interview analysis:', error);
    
    res.status(500).json({
      error: 'Failed to retrieve interview analysis',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * Test AI provider connectivity
 * GET /api/interview-analysis/test-providers
 */
router.get('/test-providers', async (req: Request, res: Response) => {
  try {
    console.log('Testing AI provider connectivity for interview analysis');

    const providerStatus = await interviewAnalysisService.testProviders();

    const allProvidersWorking = Object.values(providerStatus).some(status => status);
    const workingProviders = Object.entries(providerStatus)
      .filter(([_, status]) => status)
      .map(([provider, _]) => provider);

    res.json({
      success: true,
      data: {
        providerStatus,
        allProvidersWorking,
        workingProviders,
        message: allProvidersWorking 
          ? `Interview analysis service ready with providers: ${workingProviders.join(', ')}`
          : 'No AI providers are currently working - interview analysis will fail',
      },
    });

  } catch (error) {
    console.error('Provider test failed:', error);
    
    res.status(500).json({
      error: 'Provider test failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * Validate transcript quality
 * POST /api/interview-analysis/validate-transcript
 */
router.post('/validate-transcript', async (req: Request, res: Response): Promise<void> => {
  try {
    const { transcript } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      res.status(400).json({
        error: 'Transcript is required and must be a string',
      });
      return;
    }

    // Use the private method through a test analysis
    const mockInterviewSession: InterviewSession = {
      candidateId: 'test',
      jobProfileId: 'test',
      vapiCallId: 'test',
      scheduledAt: new Date(),
      status: 'completed',
      transcript,
      callQuality: 'good',
      retryCount: 0,
    };

    const mockJobProfile: JobProfile = {
      id: 'test',
      title: 'Test Position',
      description: 'Test',
      requiredSkills: ['test'],
      experienceLevel: 'mid',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30,
      },
      interviewQuestions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // This is a workaround to access the private method
    // In a real implementation, you might make assessTranscriptQuality public
    const service = interviewAnalysisService as any;
    const quality = service.assessTranscriptQuality ? service.assessTranscriptQuality(transcript) : 'good';

    const wordCount = transcript.split(/\s+/).length;
    const hasDialogue = transcript.includes(':') || transcript.includes('Interviewer') || transcript.includes('Candidate');
    const hasQuestionMarkers = /\?/.test(transcript);

    res.json({
      success: true,
      data: {
        quality,
        metrics: {
          wordCount,
          hasDialogue,
          hasQuestionMarkers,
          length: transcript.length,
        },
        recommendations: quality === 'poor' 
          ? ['Transcript quality is poor - manual review strongly recommended']
          : quality === 'good'
          ? ['Transcript quality is adequate for automated analysis']
          : ['Transcript quality is excellent for automated analysis'],
      },
    });

  } catch (error) {
    console.error('Transcript validation failed:', error);
    
    res.status(500).json({
      error: 'Transcript validation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

/**
 * Health check endpoint
 * GET /api/interview-analysis/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      service: 'Interview Analysis Service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

export default router;