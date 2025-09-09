import * as express from 'express';
import { Request, Response } from 'express';
import { githubAnalysisService } from '../services/githubAnalysisService';
import { JobProfile } from '../models/interfaces';

const router = express.Router();

/**
 * POST /api/github-analysis/analyze
 * Analyze a GitHub profile for a candidate
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId, githubUrl, jobProfile, resumeProjectUrls } = req.body;

    // Validate required fields
    if (!candidateId || !githubUrl || !jobProfile) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: candidateId, githubUrl, and jobProfile are required',
      });
      return;
    }

    // Validate job profile structure
    if (!jobProfile.title || !jobProfile.requiredSkills || !Array.isArray(jobProfile.requiredSkills)) {
      res.status(400).json({
        success: false,
        error: 'Invalid job profile: title and requiredSkills array are required',
      });
      return;
    }

    console.log(`Received GitHub analysis request for candidate ${candidateId}`);

    // Perform GitHub analysis
    const analysis = await githubAnalysisService.analyzeGitHubProfile(
      candidateId,
      githubUrl,
      jobProfile as JobProfile,
      resumeProjectUrls || []
    );

    res.json({
      success: true,
      data: analysis,
    });

  } catch (error) {
    console.error('GitHub analysis endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error during GitHub analysis',
    });
  }
});

/**
 * POST /api/github-analysis/batch
 * Analyze GitHub profiles for multiple candidates
 */
router.post('/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidates, jobProfile } = req.body;

    // Validate required fields
    if (!candidates || !Array.isArray(candidates) || !jobProfile) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: candidates array and jobProfile are required',
      });
      return;
    }

    // Validate job profile structure
    if (!jobProfile.title || !jobProfile.requiredSkills || !Array.isArray(jobProfile.requiredSkills)) {
      res.status(400).json({
        success: false,
        error: 'Invalid job profile: title and requiredSkills array are required',
      });
      return;
    }

    console.log(`Received batch GitHub analysis request for ${candidates.length} candidates`);

    const results = [];
    const errors = [];

    // Process each candidate
    for (const candidate of candidates) {
      try {
        if (!candidate.candidateId || !candidate.githubUrl) {
          errors.push({
            candidateId: candidate.candidateId || 'unknown',
            error: 'Missing candidateId or githubUrl',
          });
          continue;
        }

        const analysis = await githubAnalysisService.analyzeGitHubProfile(
          candidate.candidateId,
          candidate.githubUrl,
          jobProfile as JobProfile,
          candidate.resumeProjectUrls || []
        );

        results.push(analysis);

        // Add small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Batch GitHub analysis failed for candidate ${candidate.candidateId}:`, error);
        errors.push({
          candidateId: candidate.candidateId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      data: {
        results,
        errors,
        summary: {
          total: candidates.length,
          successful: results.length,
          failed: errors.length,
        },
      },
    });

  } catch (error) {
    console.error('Batch GitHub analysis endpoint error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error during batch GitHub analysis',
    });
  }
});

/**
 * GET /api/github-analysis/test-connection
 * Test GitHub API connectivity
 */
router.get('/test-connection', async (req: Request, res: Response) => {
  try {
    console.log('Testing GitHub API connection...');
    
    const isConnected = await githubAnalysisService.testConnection();
    
    if (isConnected) {
      // Also get rate limit status
      const rateLimitStatus = await githubAnalysisService.getRateLimitStatus();
      
      res.json({
        success: true,
        connected: true,
        message: 'GitHub API connection successful',
        rateLimit: rateLimitStatus,
      });
    } else {
      res.status(503).json({
        success: false,
        connected: false,
        message: 'GitHub API connection failed',
      });
    }

  } catch (error) {
    console.error('GitHub API connection test error:', error);
    
    res.status(500).json({
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Connection test failed',
    });
  }
});

/**
 * GET /api/github-analysis/rate-limit
 * Get current GitHub API rate limit status
 */
router.get('/rate-limit', async (req: Request, res: Response) => {
  try {
    const rateLimitStatus = await githubAnalysisService.getRateLimitStatus();
    
    if (rateLimitStatus) {
      res.json({
        success: true,
        data: rateLimitStatus,
      });
    } else {
      res.status(503).json({
        success: false,
        error: 'Unable to retrieve rate limit status - GitHub token may not be configured',
      });
    }

  } catch (error) {
    console.error('GitHub rate limit check error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check rate limit',
    });
  }
});

/**
 * POST /api/github-analysis/validate-url
 * Validate a GitHub URL and extract user information
 */
router.post('/validate-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { githubUrl } = req.body;

    if (!githubUrl) {
      res.status(400).json({
        success: false,
        error: 'GitHub URL is required',
      });
      return;
    }

    // Basic URL validation
    const githubRegex = /^https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9-_]+)\/?([a-zA-Z0-9-_]+\/?)?$/;
    const match = githubUrl.match(githubRegex);

    if (!match) {
      res.json({
        success: true,
        valid: false,
        message: 'Invalid GitHub URL format',
      });
      return;
    }

    const username = match[2];
    const repository = match[3];

    res.json({
      success: true,
      valid: true,
      data: {
        username,
        repository: repository || null,
        type: repository ? 'repository' : 'profile',
      },
    });

  } catch (error) {
    console.error('GitHub URL validation error:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'URL validation failed',
    });
  }
});

export default router;