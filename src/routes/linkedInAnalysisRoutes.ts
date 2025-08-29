import { Router, Request, Response } from 'express';
import { linkedInAnalysisService } from '../services/linkedInAnalysisService';
import { CandidateModel } from '../models/schemas';
import { LinkedInAnalysis } from '../models/interfaces';

const router = Router();

/**
 * POST /api/linkedin/analyze
 * Analyze a LinkedIn profile for a candidate
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId, linkedInUrl, jobProfileId } = req.body;

    // Validate required fields
    if (!candidateId || !linkedInUrl || !jobProfileId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: candidateId, linkedInUrl, jobProfileId',
      });
      return;
    }

    // Find the candidate
    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) {
      res.status(404).json({
        success: false,
        error: 'Candidate not found',
      });
      return;
    }

    // Get job profile (assuming it's embedded or referenced)
    // For now, we'll create a mock job profile - in real implementation,
    // this would be fetched from the database
    const mockJobProfile = {
      id: jobProfileId,
      title: 'Software Engineer',
      description: 'Full-stack software engineer position',
      requiredSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL'],
      experienceLevel: 'Mid-level',
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

    // Perform LinkedIn analysis
    const analysis = await linkedInAnalysisService.analyzeLinkedInProfile(
      candidateId,
      linkedInUrl,
      mockJobProfile
    );

    // Update candidate with LinkedIn analysis
    candidate.linkedInAnalysis = analysis;
    candidate.processingStage = 'github'; // Move to next stage
    await candidate.save();

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('LinkedIn analysis API error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/linkedin/candidate/:candidateId
 * Get LinkedIn analysis for a specific candidate
 */
router.get('/candidate/:candidateId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId } = req.params;

    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) {
      res.status(404).json({
        success: false,
        error: 'Candidate not found',
      });
      return;
    }

    if (!candidate.linkedInAnalysis) {
      res.status(404).json({
        success: false,
        error: 'LinkedIn analysis not found for this candidate',
      });
      return;
    }

    res.json({
      success: true,
      data: candidate.linkedInAnalysis,
    });
  } catch (error) {
    console.error('Get LinkedIn analysis API error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * POST /api/linkedin/batch-analyze
 * Analyze LinkedIn profiles for multiple candidates
 */
router.post('/batch-analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateIds, jobProfileId } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'candidateIds must be a non-empty array',
      });
      return;
    }

    if (!jobProfileId) {
      res.status(400).json({
        success: false,
        error: 'jobProfileId is required',
      });
      return;
    }

    // Find candidates with LinkedIn URLs
    const candidates = await CandidateModel.find({
      _id: { $in: candidateIds },
      'resumeData.contactInfo.linkedInUrl': { $exists: true, $ne: null },
    });

    if (candidates.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No candidates found with LinkedIn URLs',
      });
      return;
    }

    // Mock job profile for batch processing
    const mockJobProfile = {
      id: jobProfileId,
      title: 'Software Engineer',
      description: 'Full-stack software engineer position',
      requiredSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL'],
      experienceLevel: 'Mid-level',
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

    const results: Array<{
      candidateId: string;
      success: boolean;
      analysis?: LinkedInAnalysis;
      error?: string;
    }> = [];

    // Process candidates sequentially to avoid rate limiting
    for (const candidate of candidates) {
      try {
        const linkedInUrl = candidate.resumeData.contactInfo.linkedInUrl;
        if (!linkedInUrl) {
          results.push({
            candidateId: candidate.id,
            success: false,
            error: 'No LinkedIn URL found',
          });
          continue;
        }

        const analysis = await linkedInAnalysisService.analyzeLinkedInProfile(
          candidate.id,
          linkedInUrl,
          mockJobProfile
        );

        // Update candidate
        candidate.linkedInAnalysis = analysis;
        candidate.processingStage = 'github';
        await candidate.save();

        results.push({
          candidateId: candidate.id,
          success: true,
          analysis,
        });

        // Add delay between requests to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          candidateId: candidate.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: true,
      data: {
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        results,
      },
    });
  } catch (error) {
    console.error('Batch LinkedIn analysis API error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/linkedin/test-connection
 * Test LinkedIn scraper API connectivity
 */
router.get('/test-connection', async (req: Request, res: Response) => {
  try {
    const isConnected = await linkedInAnalysisService.testConnection();
    
    res.json({
      success: true,
      data: {
        connected: isConnected,
        message: isConnected 
          ? 'LinkedIn scraper API is accessible' 
          : 'LinkedIn scraper API is not accessible',
      },
    });
  } catch (error) {
    console.error('LinkedIn connection test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/linkedin/usage
 * Get LinkedIn API usage statistics
 */
router.get('/usage', async (req: Request, res: Response): Promise<void> => {
  try {
    const usage = await linkedInAnalysisService.getApiUsage();
    
    if (!usage) {
      res.status(503).json({
        success: false,
        error: 'LinkedIn API usage information not available',
      });
      return;
    }

    res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    console.error('LinkedIn usage API error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;