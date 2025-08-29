// Job Profile REST API Routes
import { Router, Request, Response } from 'express';
import { jobProfileService, CreateJobProfileRequest, UpdateJobProfileRequest, JobProfileFilters } from '../services/jobProfileService';
import { DatabaseError } from '../utils/database';
import { validateCreateJobProfile, validateUpdateJobProfile, validateObjectId } from '../middleware/validation';

const router = Router();

/**
 * POST /api/job-profiles
 * Create a new job profile
 */
router.post('/', validateCreateJobProfile, async (req: Request, res: Response) => {
  try {
    const jobProfileData: CreateJobProfileRequest = req.body;
    
    const jobProfile = await jobProfileService.createJobProfile(jobProfileData);
    
    res.status(201).json({
      success: true,
      data: jobProfile,
      message: 'Job profile created successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/job-profiles
 * Get all job profiles with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: JobProfileFilters = {};
    
    // Parse query parameters
    if (req.query.title) {
      filters.title = req.query.title as string;
    }
    
    if (req.query.experienceLevel) {
      filters.experienceLevel = req.query.experienceLevel as string;
    }
    
    if (req.query.createdAfter) {
      filters.createdAfter = new Date(req.query.createdAfter as string);
    }
    
    if (req.query.createdBefore) {
      filters.createdBefore = new Date(req.query.createdBefore as string);
    }

    const jobProfiles = await jobProfileService.getJobProfiles(filters);
    const totalCount = await jobProfileService.getJobProfilesCount(filters);
    
    res.status(200).json({
      success: true,
      data: jobProfiles,
      meta: {
        total: totalCount,
        count: jobProfiles.length
      },
      message: 'Job profiles retrieved successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/job-profiles/:id
 * Get job profile by ID
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
    
    const jobProfile = await jobProfileService.getJobProfileById(id);
    
    if (!jobProfile) {
      return res.status(404).json({
        success: false,
        message: 'Job profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: jobProfile,
      message: 'Job profile retrieved successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * PUT /api/job-profiles/:id
 * Update job profile by ID
 */
router.put('/:id', validateObjectId, validateUpdateJobProfile, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID parameter is required'
      });
    }
    
    const updateData: UpdateJobProfileRequest = { ...req.body, id };
    
    const jobProfile = await jobProfileService.updateJobProfile(updateData);
    
    if (!jobProfile) {
      return res.status(404).json({
        success: false,
        message: 'Job profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: jobProfile,
      message: 'Job profile updated successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * DELETE /api/job-profiles/:id
 * Delete job profile by ID
 */
router.delete('/:id', validateObjectId, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID parameter is required'
      });
    }
    
    const deleted = await jobProfileService.deleteJobProfile(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Job profile not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Job profile deleted successfully'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * GET /api/job-profiles/:id/exists
 * Check if job profile exists
 */
router.get('/:id/exists', validateObjectId, async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID parameter is required'
      });
    }
    
    const exists = await jobProfileService.jobProfileExists(id);
    
    res.status(200).json({
      success: true,
      data: { exists },
      message: exists ? 'Job profile exists' : 'Job profile does not exist'
    });
  } catch (error) {
    handleRouteError(error, res);
  }
});

/**
 * Handle route errors consistently
 */
function handleRouteError(error: any, res: Response): void {
  console.error('Job Profile Route Error:', error);
  
  if (error instanceof DatabaseError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      code: error.code
    });
  } else if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.message
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