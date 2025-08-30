// Input validation and sanitization middleware for API requests
import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CreateJobProfileRequest } from '../services/jobProfileService';
import { logger } from '../utils/logger';

/**
 * Sanitize string input - remove HTML tags and trim whitespace
 */
export const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return '';
  
  // Remove HTML tags and script content
  const withoutHtml = str.replace(/<[^>]*>/g, '');
  
  // Remove potentially dangerous characters
  const sanitized = withoutHtml
    .replace(/[<>'"&]/g, '') // Remove HTML special characters
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
  
  return sanitized;
};

/**
 * Sanitize object recursively
 */
export const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * General input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters - only if they exist and are writable
    if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
      try {
        const sanitizedQuery = sanitizeObject(req.query);
        // Only update if we can write to the query object
        const descriptor = Object.getOwnPropertyDescriptor(req, 'query');
        if (descriptor && descriptor.writable !== false) {
          req.query = sanitizedQuery;
        }
      } catch (queryError) {
        // If we can't sanitize query, just log and continue
        logger.debug('Query sanitization skipped (read-only)', {
          method: req.method,
          path: req.path
        });
      }
    }
    
    // Log sanitization for security monitoring
    logger.debug('Input sanitized', {
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      ip: req.ip
    });
    
    next();
  } catch (error) {
    logger.error('Input sanitization failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    
    res.status(400).json({
      success: false,
      message: 'Invalid input format'
    });
  }
};

/**
 * Handle validation errors from express-validator
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): Response | void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation failed', {
      errors: errors.array(),
      method: req.method,
      path: req.path,
      userId: req.user?.id,
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  
  next();
};

/**
 * Express-validator rules for common validations
 */
export const validateLogin = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Password must be between 6 and 100 characters'),
  handleValidationErrors
];

export const validateCreateUser = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  body('password')
    .isLength({ min: 8, max: 100 })
    .withMessage('Password must be between 8 and 100 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('role')
    .isIn(['admin', 'recruiter', 'viewer'])
    .withMessage('Role must be admin, recruiter, or viewer'),
  handleValidationErrors
];

export const validateObjectIdParam = [
  param('id')
    .matches(/^[0-9a-fA-F]{24}$/)
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

export const validatePaginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limit must be between 1 and 1000'),
  handleValidationErrors
];

/**
 * Validate job profile creation request
 */
export function validateCreateJobProfile(req: Request, res: Response, next: NextFunction): Response | void {
  const { title, description, requiredSkills, experienceLevel, scoringWeights, interviewQuestions } = req.body;
  
  const errors: string[] = [];
  
  // Validate required fields
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required and must be a non-empty string');
  }
  
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    errors.push('Description is required and must be a non-empty string');
  }
  
  if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
    errors.push('Required skills must be a non-empty array');
  } else {
    requiredSkills.forEach((skill, index) => {
      if (typeof skill !== 'string' || skill.trim().length === 0) {
        errors.push(`Required skill at index ${index} must be a non-empty string`);
      }
    });
  }
  
  if (!experienceLevel || typeof experienceLevel !== 'string' || experienceLevel.trim().length === 0) {
    errors.push('Experience level is required and must be a non-empty string');
  }
  
  // Validate scoring weights
  if (!scoringWeights || typeof scoringWeights !== 'object') {
    errors.push('Scoring weights are required and must be an object');
  } else {
    const requiredWeights = ['resumeAnalysis', 'linkedInAnalysis', 'githubAnalysis', 'interviewPerformance'];
    
    requiredWeights.forEach(weight => {
      if (typeof scoringWeights[weight] !== 'number' || scoringWeights[weight] < 0 || scoringWeights[weight] > 100) {
        errors.push(`${weight} must be a number between 0 and 100`);
      }
    });
    
    // Check if weights sum to 100
    const total = requiredWeights.reduce((sum, weight) => sum + (scoringWeights[weight] || 0), 0);
    if (Math.abs(total - 100) > 0.01) {
      errors.push(`Scoring weights must sum to 100%. Current total: ${total}%`);
    }
  }
  
  if (!Array.isArray(interviewQuestions) || interviewQuestions.length === 0) {
    errors.push('Interview questions must be a non-empty array');
  } else {
    interviewQuestions.forEach((question, index) => {
      if (typeof question !== 'string' || question.trim().length === 0) {
        errors.push(`Interview question at index ${index} must be a non-empty string`);
      }
    });
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  next();
}

/**
 * Validate job profile update request
 */
export function validateUpdateJobProfile(req: Request, res: Response, next: NextFunction): Response | void {
  const { title, description, requiredSkills, experienceLevel, scoringWeights, interviewQuestions } = req.body;
  
  const errors: string[] = [];
  
  // Validate optional fields if provided
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
    errors.push('Title must be a non-empty string if provided');
  }
  
  if (description !== undefined && (typeof description !== 'string' || description.trim().length === 0)) {
    errors.push('Description must be a non-empty string if provided');
  }
  
  if (requiredSkills !== undefined) {
    if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      errors.push('Required skills must be a non-empty array if provided');
    } else {
      requiredSkills.forEach((skill, index) => {
        if (typeof skill !== 'string' || skill.trim().length === 0) {
          errors.push(`Required skill at index ${index} must be a non-empty string`);
        }
      });
    }
  }
  
  if (experienceLevel !== undefined && (typeof experienceLevel !== 'string' || experienceLevel.trim().length === 0)) {
    errors.push('Experience level must be a non-empty string if provided');
  }
  
  // Validate scoring weights if provided
  if (scoringWeights !== undefined) {
    if (typeof scoringWeights !== 'object') {
      errors.push('Scoring weights must be an object if provided');
    } else {
      const requiredWeights = ['resumeAnalysis', 'linkedInAnalysis', 'githubAnalysis', 'interviewPerformance'];
      
      requiredWeights.forEach(weight => {
        if (scoringWeights[weight] !== undefined && 
            (typeof scoringWeights[weight] !== 'number' || scoringWeights[weight] < 0 || scoringWeights[weight] > 100)) {
          errors.push(`${weight} must be a number between 0 and 100 if provided`);
        }
      });
      
      // Check if all weights are provided and sum to 100
      const providedWeights = requiredWeights.filter(weight => scoringWeights[weight] !== undefined);
      if (providedWeights.length === requiredWeights.length) {
        const total = requiredWeights.reduce((sum, weight) => sum + (scoringWeights[weight] || 0), 0);
        if (Math.abs(total - 100) > 0.01) {
          errors.push(`Scoring weights must sum to 100% when all weights are provided. Current total: ${total}%`);
        }
      }
    }
  }
  
  if (interviewQuestions !== undefined) {
    if (!Array.isArray(interviewQuestions) || interviewQuestions.length === 0) {
      errors.push('Interview questions must be a non-empty array if provided');
    } else {
      interviewQuestions.forEach((question, index) => {
        if (typeof question !== 'string' || question.trim().length === 0) {
          errors.push(`Interview question at index ${index} must be a non-empty string`);
        }
      });
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  next();
}

/**
 * Validate MongoDB ObjectId format
 */
export function validateObjectId(req: Request, res: Response, next: NextFunction): Response | void {
  const { id, candidateId, jobProfileId, batchId } = req.params;
  const idToValidate = id || candidateId || jobProfileId || batchId;
  
  if (!idToValidate || typeof idToValidate !== 'string' || idToValidate.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  // Validate ObjectId format (24 character hex string)
  if (!/^[0-9a-fA-F]{24}$/.test(idToValidate)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  next();
}

/**
 * Validate candidate search parameters
 */
export function validateCandidateSearch(req: Request, res: Response, next: NextFunction): Response | void {
  const errors: string[] = [];
  
  // Validate page parameter
  if (req.query.page && (!Number.isInteger(Number(req.query.page)) || Number(req.query.page) < 1)) {
    errors.push('Page must be a positive integer');
  }
  
  // Validate limit parameter
  if (req.query.limit) {
    const limit = Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      errors.push('Limit must be an integer between 1 and 1000');
    }
  }
  
  // Validate score parameters
  if (req.query.minScore) {
    const minScore = Number(req.query.minScore);
    if (isNaN(minScore) || minScore < 0 || minScore > 100) {
      errors.push('minScore must be a number between 0 and 100');
    }
  }
  
  if (req.query.maxScore) {
    const maxScore = Number(req.query.maxScore);
    if (isNaN(maxScore) || maxScore < 0 || maxScore > 100) {
      errors.push('maxScore must be a number between 0 and 100');
    }
  }
  
  // Validate min/max score relationship
  if (req.query.minScore && req.query.maxScore) {
    const minScore = Number(req.query.minScore);
    const maxScore = Number(req.query.maxScore);
    if (minScore > maxScore) {
      errors.push('minScore cannot be greater than maxScore');
    }
  }
  
  // Validate recommendation parameter
  if (req.query.recommendation) {
    const validRecommendations = ['strong-hire', 'hire', 'maybe', 'no-hire'];
    if (!validRecommendations.includes(req.query.recommendation as string)) {
      errors.push('recommendation must be one of: strong-hire, hire, maybe, no-hire');
    }
  }
  
  // Validate processing stage parameter
  if (req.query.processingStage) {
    const validStages = ['resume', 'ai-analysis', 'linkedin', 'github', 'interview', 'scoring', 'completed'];
    if (!validStages.includes(req.query.processingStage as string)) {
      errors.push('processingStage must be one of: resume, ai-analysis, linkedin, github, interview, scoring, completed');
    }
  }
  
  // Validate sort parameters
  if (req.query.sortBy) {
    const validSortFields = ['score', 'createdAt', 'name'];
    if (!validSortFields.includes(req.query.sortBy as string)) {
      errors.push('sortBy must be one of: score, createdAt, name');
    }
  }
  
  if (req.query.sortOrder) {
    const validSortOrders = ['asc', 'desc'];
    if (!validSortOrders.includes(req.query.sortOrder as string)) {
      errors.push('sortOrder must be either asc or desc');
    }
  }
  
  // Validate date parameters
  if (req.query.createdAfter) {
    const date = new Date(req.query.createdAfter as string);
    if (isNaN(date.getTime())) {
      errors.push('createdAfter must be a valid date');
    }
  }
  
  if (req.query.createdBefore) {
    const date = new Date(req.query.createdBefore as string);
    if (isNaN(date.getTime())) {
      errors.push('createdBefore must be a valid date');
    }
  }
  
  // Validate boolean parameters
  if (req.query.hasLinkedIn && !['true', 'false'].includes(req.query.hasLinkedIn as string)) {
    errors.push('hasLinkedIn must be true or false');
  }
  
  if (req.query.hasGitHub && !['true', 'false'].includes(req.query.hasGitHub as string)) {
    errors.push('hasGitHub must be true or false');
  }
  
  if (req.query.interviewCompleted && !['true', 'false'].includes(req.query.interviewCompleted as string)) {
    errors.push('interviewCompleted must be true or false');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  next();
}

/**
 * Validate export parameters
 */
export function validateExportParams(req: Request, res: Response, next: NextFunction): Response | void {
  const errors: string[] = [];
  
  // Validate format parameter
  if (req.query.format && !['csv', 'json'].includes(req.query.format as string)) {
    errors.push('format must be either csv or json');
  }
  
  // Validate includeDetails parameter
  if (req.query.includeDetails && !['true', 'false'].includes(req.query.includeDetails as string)) {
    errors.push('includeDetails must be true or false');
  }
  
  // Validate fields parameter
  if (req.query.fields) {
    const fields = (req.query.fields as string).split(',');
    const validFields = [
      'id', 'resumeData.fileName', 'resumeData.contactInfo.email', 'resumeData.contactInfo.phone',
      'resumeData.contactInfo.linkedInUrl', 'resumeData.contactInfo.githubUrl', 'processingStage',
      'finalScore.compositeScore', 'finalScore.recommendation', 'createdAt', 'finalScore.stageScores.resumeAnalysis',
      'finalScore.stageScores.linkedInAnalysis', 'finalScore.stageScores.githubAnalysis',
      'finalScore.stageScores.interviewPerformance', 'aiAnalysis.reasoning'
    ];
    
    const invalidFields = fields.filter(field => !validFields.includes(field.trim()));
    if (invalidFields.length > 0) {
      errors.push(`Invalid fields: ${invalidFields.join(', ')}`);
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  next();
}