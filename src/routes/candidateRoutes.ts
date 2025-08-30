// Candidate REST API Routes
import { Router, Request, Response } from 'express';
import { candidateService, CandidateFilters, CandidateSearchOptions, CandidateExportOptions } from '../services/candidateService';
import { validateObjectId, validateCandidateSearch, validateExportParams } from '../middleware/validation';

const router = Router();

/**
 * GET /api/candidates/export
 * Export candidates data in CSV or JSON format
 */
router.get('/export', validateCandidateSearch, validateExportParams, async (req: Request, res: Response) => {
  try {
    // Parse filters (same as search endpoint)
    const filters: CandidateFilters = {};
    
    if (req.query.jobProfileId) {
      filters.jobProfileId = req.query.jobProfileId as string;
    }
    
    if (req.query.processingStage) {
      filters.processingStage = req.query.processingStage as string;
    }
    
    if (req.query.minScore) {
      filters.minScore = parseFloat(req.query.minScore as string);
    }
    
    if (req.query.maxScore) {
      filters.maxScore = parseFloat(req.query.maxScore as string);
    }
    
    if (req.query.recommendation) {
      filters.recommendation = req.query.recommendation as 'strong-hire' | 'hire' | 'maybe' | 'no-hire';
    }

    // Parse export options
    const exportOptions: CandidateExportOptions = {
      format: (req.query.format as 'csv' | 'json') || 'csv',
      includeDetails: req.query.includeDetails === 'true'
    };
    
    if (req.query.fields) {
      exportOptions.fields = (req.query.fields as string).split(',');
    }

    const exportData = await candidateService.exportCandidates(filters, exportOptions);
    
    // Set appropriate headers
    const filename = `candidates_export_${new Date().toISOString().split('T')[0]}`;
    const contentType = exportOptions.format === 'csv' 
      ? 'text/csv' 
      : 'application/json';
    const fileExtension = exportOptions.format === 'csv' ? 'csv' : 'json';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.${fileExtension}"`);
    
    res.status(200).send(exportData);
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/candidates/stats
 * Get candidate statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const jobProfileId = req.query.jobProfileId as string;
    
    const [
      totalCount,
      completedCount,
      strongHireCount,
      hireCount,
      maybeCount,
      noHireCount
    ] = await Promise.all([
      candidateService.getCandidatesCount({ jobProfileId }),
      candidateService.getCandidatesCount({ jobProfileId, processingStage: 'completed' }),
      candidateService.getCandidatesCount({ jobProfileId, recommendation: 'strong-hire' }),
      candidateService.getCandidatesCount({ jobProfileId, recommendation: 'hire' }),
      candidateService.getCandidatesCount({ jobProfileId, recommendation: 'maybe' }),
      candidateService.getCandidatesCount({ jobProfileId, recommendation: 'no-hire' })
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        total: totalCount,
        completed: completedCount,
        inProgress: totalCount - completedCount,
        recommendations: {
          strongHire: strongHireCount,
          hire: hireCount,
          maybe: maybeCount,
          noHire: noHireCount
        },
        completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
      },
      message: 'Candidate statistics retrieved successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/candidates/batch/:batchId/progress
 * Get batch processing progress
 */
router.get('/batch/:batchId/progress', validateObjectId, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { batchId } = req.params;
    
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'Batch ID parameter is required'
      });
    }
    
    const progress = await candidateService.getBatchProgress(batchId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }
    
    const completedCount = progress.candidateProgress.filter(c => c.completed).length;
    const overallProgress = (completedCount / progress.candidateProgress.length) * 100;
    
    res.status(200).json({
      success: true,
      data: {
        batchId,
        batch: progress.batch,
        candidateProgress: progress.candidateProgress,
        summary: {
          totalCandidates: progress.candidateProgress.length,
          completedCandidates: completedCount,
          overallProgress: Math.round(overallProgress * 100) / 100
        }
      },
      message: 'Batch progress retrieved successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/candidates/top/:jobProfileId
 * Get top candidates for a job profile
 */
router.get('/top/:jobProfileId', validateObjectId, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { jobProfileId } = req.params;
    
    if (!jobProfileId) {
      return res.status(400).json({
        success: false,
        message: 'Job Profile ID parameter is required'
      });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    
    if (limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit cannot exceed 100'
      });
    }
    
    const topCandidates = await candidateService.getTopCandidates(jobProfileId, limit);
    
    res.status(200).json({
      success: true,
      data: topCandidates,
      meta: {
        jobProfileId,
        count: topCandidates.length,
        limit
      },
      message: 'Top candidates retrieved successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/candidates
 * Search and filter candidates with pagination
 */
router.get('/', validateCandidateSearch, async (req: Request, res: Response) => {
  try {
    // Parse filters from query parameters
    const filters: CandidateFilters = {};
    
    if (req.query.jobProfileId) {
      filters.jobProfileId = req.query.jobProfileId as string;
    }
    
    if (req.query.processingStage) {
      filters.processingStage = req.query.processingStage as string;
    }
    
    if (req.query.minScore) {
      filters.minScore = parseFloat(req.query.minScore as string);
    }
    
    if (req.query.maxScore) {
      filters.maxScore = parseFloat(req.query.maxScore as string);
    }
    
    if (req.query.recommendation) {
      filters.recommendation = req.query.recommendation as 'strong-hire' | 'hire' | 'maybe' | 'no-hire';
    }
    
    if (req.query.createdAfter) {
      filters.createdAfter = new Date(req.query.createdAfter as string);
    }
    
    if (req.query.createdBefore) {
      filters.createdBefore = new Date(req.query.createdBefore as string);
    }
    
    if (req.query.hasLinkedIn) {
      filters.hasLinkedIn = req.query.hasLinkedIn === 'true';
    }
    
    if (req.query.hasGitHub) {
      filters.hasGitHub = req.query.hasGitHub === 'true';
    }
    
    if (req.query.interviewCompleted) {
      filters.interviewCompleted = req.query.interviewCompleted === 'true';
    }

    // Parse search options
    const options: CandidateSearchOptions = {};
    
    if (req.query.page) {
      options.page = parseInt(req.query.page as string, 10);
    }
    
    if (req.query.limit) {
      options.limit = Math.min(parseInt(req.query.limit as string, 10), 1000); // Max 1000 per page
    }
    
    if (req.query.sortBy) {
      options.sortBy = req.query.sortBy as 'score' | 'createdAt' | 'name';
    }
    
    if (req.query.sortOrder) {
      options.sortOrder = req.query.sortOrder as 'asc' | 'desc';
    }

    const result = await candidateService.searchCandidates(filters, options);
    
    res.status(200).json({
      success: true,
      data: result.candidates,
      meta: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        limit: options.limit || 50
      },
      message: 'Candidates retrieved successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/candidates/:id
 * Get candidate by ID with full details
 */
router.get('/:id', validateObjectId, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID parameter is required'
      });
    }
    
    const candidate = await candidateService.getCandidateById(id);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: candidate,
      message: 'Candidate retrieved successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/candidates/:id/status
 * Get candidate processing status and progress
 */
router.get('/:id/status', validateObjectId, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID parameter is required'
      });
    }
    
    const status = await candidateService.getCandidateStatus(id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        candidateId: id,
        currentStage: status.candidate.processingStage,
        progress: status.progress,
        overallProgress: calculateOverallProgress(status.progress)
      },
      message: 'Candidate status retrieved successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * Calculate overall progress percentage
 */
function calculateOverallProgress(progress: Array<{ stage: string; completed: boolean }>): number {
  const completedStages = progress.filter(p => p.completed).length;
  return Math.round((completedStages / progress.length) * 100);
}

/**
 * Handle route errors consistently
 */
function handleRouteError(error: any, res: Response): void {
  console.error('Candidate Route Error:', error);
  
  if (error.message.includes('not found')) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  } else if (error.message.includes('validation') || error.message.includes('invalid')) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  } else if (error.message.includes('Failed to retrieve candidate') || 
             error.message.includes('Failed to search candidates')) {
    res.status(404).json({
      success: false,
      message: 'Candidate not found'
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

export default router;