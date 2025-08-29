// Input validation middleware for API requests
import { Request, Response, NextFunction } from 'express';
import { CreateJobProfileRequest } from '../services/jobProfileService';

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
  const { id } = req.params;
  
  // Simple validation for our custom ID format (we're using string IDs, not ObjectIds)
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  next();
}