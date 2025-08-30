import { Router, Request, Response } from 'express';
import { ScoringService, RankingOptions, ScoringThresholds } from '../services/scoringService';
import { JobProfileService } from '../services/jobProfileService';
import { DatabaseError } from '../utils/database';

const router = Router();
const scoringService = new ScoringService();
const jobProfileService = new JobProfileService();

/**
 * Calculate score for a single candidate
 * POST /api/scoring/candidate/:candidateId
 */
router.post('/candidate/:candidateId', async (req: Request, res: Response) => {
  try {
    const { candidateId } = req.params;
    const { jobProfileId } = req.body;

    if (!jobProfileId) {
      return res.status(400).json({
        error: 'Job profile ID is required'
      });
    }

    // In a real implementation, you would fetch the candidate from database
    // For now, we'll expect it to be provided in the request body
    const { candidate } = req.body;
    
    if (!candidate) {
      return res.status(400).json({
        error: 'Candidate data is required'
      });
    }

    const jobProfile = await jobProfileService.getJobProfile(jobProfileId);
    if (!jobProfile) {
      return res.status(404).json({
        error: 'Job profile not found'
      });
    }

    const candidateScore = await scoringService.calculateCandidateScore(candidate, jobProfile);

    res.json({
      success: true,
      data: candidateScore
    });

  } catch (error) {
    console.error('Error calculating candidate score:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Internal server error while calculating candidate score'
    });
  }
});

/**
 * Get detailed scoring breakdown for a candidate
 * GET /api/scoring/breakdown/:candidateId/:jobProfileId
 */
router.get('/breakdown/:candidateId/:jobProfileId', async (req: Request, res: Response) => {
  try {
    const { candidateId, jobProfileId } = req.params;

    // In a real implementation, fetch candidate from database
    const { candidate } = req.body;
    
    if (!candidate) {
      return res.status(400).json({
        error: 'Candidate data is required'
      });
    }

    const jobProfile = await jobProfileService.getJobProfile(jobProfileId);
    if (!jobProfile) {
      return res.status(404).json({
        error: 'Job profile not found'
      });
    }

    const breakdown = scoringService.calculateScoringBreakdown(candidate, jobProfile);

    res.json({
      success: true,
      data: breakdown
    });

  } catch (error) {
    console.error('Error calculating scoring breakdown:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Internal server error while calculating scoring breakdown'
    });
  }
});

/**
 * Rank multiple candidates for a job profile
 * POST /api/scoring/rank
 */
router.post('/rank', async (req: Request, res: Response) => {
  try {
    const { candidates, jobProfileId, options } = req.body;

    if (!candidates || !Array.isArray(candidates)) {
      return res.status(400).json({
        error: 'Candidates array is required'
      });
    }

    if (!jobProfileId) {
      return res.status(400).json({
        error: 'Job profile ID is required'
      });
    }

    const jobProfile = await jobProfileService.getJobProfile(jobProfileId);
    if (!jobProfile) {
      return res.status(404).json({
        error: 'Job profile not found'
      });
    }

    const rankingOptions: RankingOptions = options || {};
    const rankedCandidates = await scoringService.rankCandidates(candidates, jobProfile, rankingOptions);

    res.json({
      success: true,
      data: {
        totalCandidates: candidates.length,
        rankedCandidates: rankedCandidates.length,
        candidates: rankedCandidates
      }
    });

  } catch (error) {
    console.error('Error ranking candidates:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Internal server error while ranking candidates'
    });
  }
});

/**
 * Filter candidates by minimum score threshold
 * POST /api/scoring/filter/threshold
 */
router.post('/filter/threshold', async (req: Request, res: Response) => {
  try {
    const { candidateScores, minScore } = req.body;

    if (!candidateScores || !Array.isArray(candidateScores)) {
      return res.status(400).json({
        error: 'Candidate scores array is required'
      });
    }

    if (typeof minScore !== 'number' || minScore < 0 || minScore > 100) {
      return res.status(400).json({
        error: 'Minimum score must be a number between 0 and 100'
      });
    }

    const filteredCandidates = scoringService.filterByThreshold(candidateScores, minScore);

    res.json({
      success: true,
      data: {
        originalCount: candidateScores.length,
        filteredCount: filteredCandidates.length,
        minScore,
        candidates: filteredCandidates
      }
    });

  } catch (error) {
    console.error('Error filtering candidates by threshold:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Internal server error while filtering candidates'
    });
  }
});

/**
 * Get candidates by recommendation level
 * POST /api/scoring/filter/recommendation
 */
router.post('/filter/recommendation', async (req: Request, res: Response) => {
  try {
    const { candidateScores, recommendation } = req.body;

    if (!candidateScores || !Array.isArray(candidateScores)) {
      return res.status(400).json({
        error: 'Candidate scores array is required'
      });
    }

    const validRecommendations = ['strong-hire', 'hire', 'maybe', 'no-hire'];
    if (!validRecommendations.includes(recommendation)) {
      return res.status(400).json({
        error: `Recommendation must be one of: ${validRecommendations.join(', ')}`
      });
    }

    const filteredCandidates = scoringService.getCandidatesByRecommendation(candidateScores, recommendation);

    res.json({
      success: true,
      data: {
        originalCount: candidateScores.length,
        filteredCount: filteredCandidates.length,
        recommendation,
        candidates: filteredCandidates
      }
    });

  } catch (error) {
    console.error('Error filtering candidates by recommendation:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Internal server error while filtering candidates'
    });
  }
});

/**
 * Batch scoring for multiple candidates with different job profiles
 * POST /api/scoring/batch
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { scoringRequests } = req.body;

    if (!scoringRequests || !Array.isArray(scoringRequests)) {
      return res.status(400).json({
        error: 'Scoring requests array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const request of scoringRequests) {
      try {
        const { candidate, jobProfileId } = request;
        
        if (!candidate || !jobProfileId) {
          errors.push({
            candidateId: candidate?.id || 'unknown',
            error: 'Missing candidate or job profile ID'
          });
          continue;
        }

        const jobProfile = await jobProfileService.getJobProfile(jobProfileId);
        if (!jobProfile) {
          errors.push({
            candidateId: candidate.id,
            error: 'Job profile not found'
          });
          continue;
        }

        const candidateScore = await scoringService.calculateCandidateScore(candidate, jobProfile);
        results.push(candidateScore);

      } catch (error) {
        errors.push({
          candidateId: request.candidate?.id || 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalRequests: scoringRequests.length,
        successfulScores: results.length,
        errors: errors.length,
        results,
        errors
      }
    });

  } catch (error) {
    console.error('Error in batch scoring:', error);
    
    if (error instanceof DatabaseError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({
      error: 'Internal server error during batch scoring'
    });
  }
});

export default router;