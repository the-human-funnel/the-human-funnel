// Job Profile Management Service
import { JobProfileModel } from '../models/schemas';
import { JobProfile } from '../models/interfaces';
import { DatabaseError, handleMongoError } from '../utils/database';
import { Types } from 'mongoose';

export interface CreateJobProfileRequest {
  title: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: string;
  scoringWeights: {
    resumeAnalysis: number;
    linkedInAnalysis: number;
    githubAnalysis: number;
    interviewPerformance: number;
  };
  interviewQuestions: string[];
}

export interface UpdateJobProfileRequest extends Partial<CreateJobProfileRequest> {
  id: string;
}

export interface JobProfileFilters {
  title?: string;
  experienceLevel?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export class JobProfileService {
  /**
   * Create a new job profile with validation
   */
  async createJobProfile(data: CreateJobProfileRequest): Promise<JobProfile> {
    try {
      // Validate scoring weights sum to 100%
      this.validateScoringWeights(data.scoringWeights);
      
      // Validate required fields
      this.validateRequiredFields(data);
      
      const jobProfile = new JobProfileModel({
        ...data,
        id: new Types.ObjectId().toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const savedProfile = await jobProfile.save();
      return this.toJobProfile(savedProfile);
    } catch (error) {
      throw handleMongoError(error);
    }
  }

  /**
   * Get job profile by ID
   */
  async getJobProfileById(id: string): Promise<JobProfile | null> {
    try {
      const profile = await JobProfileModel.findOne({ id }).exec();
      return profile ? this.toJobProfile(profile) : null;
    } catch (error) {
      throw handleMongoError(error);
    }
  }

  /**
   * Get all job profiles with optional filtering
   */
  async getJobProfiles(filters?: JobProfileFilters): Promise<JobProfile[]> {
    try {
      const query: any = {};
      
      if (filters?.title) {
        query.title = { $regex: filters.title, $options: 'i' };
      }
      
      if (filters?.experienceLevel) {
        query.experienceLevel = filters.experienceLevel;
      }
      
      if (filters?.createdAfter || filters?.createdBefore) {
        query.createdAt = {};
        if (filters.createdAfter) {
          query.createdAt.$gte = filters.createdAfter;
        }
        if (filters.createdBefore) {
          query.createdAt.$lte = filters.createdBefore;
        }
      }

      const profiles = await JobProfileModel.find(query)
        .sort({ createdAt: -1 })
        .exec();
      
      return profiles.map(profile => this.toJobProfile(profile));
    } catch (error) {
      throw handleMongoError(error);
    }
  }

  /**
   * Update job profile by ID
   */
  async updateJobProfile(data: UpdateJobProfileRequest): Promise<JobProfile | null> {
    try {
      // Validate scoring weights if provided
      if (data.scoringWeights) {
        this.validateScoringWeights(data.scoringWeights);
      }

      const { id, ...updateData } = data;
      (updateData as any).updatedAt = new Date();

      const updatedProfile = await JobProfileModel.findOneAndUpdate(
        { id },
        { $set: updateData },
        { new: true, runValidators: true }
      ).exec();

      return updatedProfile ? this.toJobProfile(updatedProfile) : null;
    } catch (error) {
      throw handleMongoError(error);
    }
  }

  /**
   * Delete job profile by ID
   * Note: Should check if profile is being used in active processing
   */
  async deleteJobProfile(id: string): Promise<boolean> {
    try {
      // TODO: Add check for active processing batches using this profile
      // This will be implemented when we have the ProcessingBatch service
      
      const result = await JobProfileModel.deleteOne({ id }).exec();
      return result.deletedCount > 0;
    } catch (error) {
      throw handleMongoError(error);
    }
  }

  /**
   * Check if job profile exists
   */
  async jobProfileExists(id: string): Promise<boolean> {
    try {
      const count = await JobProfileModel.countDocuments({ id }).exec();
      return count > 0;
    } catch (error) {
      throw handleMongoError(error);
    }
  }

  /**
   * Get job profiles count
   */
  async getJobProfilesCount(filters?: JobProfileFilters): Promise<number> {
    try {
      const query: any = {};
      
      if (filters?.title) {
        query.title = { $regex: filters.title, $options: 'i' };
      }
      
      if (filters?.experienceLevel) {
        query.experienceLevel = filters.experienceLevel;
      }
      
      if (filters?.createdAfter || filters?.createdBefore) {
        query.createdAt = {};
        if (filters.createdAfter) {
          query.createdAt.$gte = filters.createdAfter;
        }
        if (filters.createdBefore) {
          query.createdAt.$lte = filters.createdBefore;
        }
      }

      return await JobProfileModel.countDocuments(query).exec();
    } catch (error) {
      throw handleMongoError(error);
    }
  }

  /**
   * Validate scoring weights sum to 100%
   */
  private validateScoringWeights(weights: {
    resumeAnalysis: number;
    linkedInAnalysis: number;
    githubAnalysis: number;
    interviewPerformance: number;
  }): void {
    const total = weights.resumeAnalysis + weights.linkedInAnalysis + 
                  weights.githubAnalysis + weights.interviewPerformance;
    
    if (Math.abs(total - 100) > 0.01) {
      throw new DatabaseError(
        `Scoring weights must sum to 100%. Current total: ${total}%`,
        'VALIDATION_ERROR',
        400
      );
    }

    // Validate individual weights are non-negative
    Object.entries(weights).forEach(([key, value]) => {
      if (value < 0 || value > 100) {
        throw new DatabaseError(
          `Scoring weight for ${key} must be between 0 and 100. Got: ${value}`,
          'VALIDATION_ERROR',
          400
        );
      }
    });
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(data: CreateJobProfileRequest): void {
    const requiredFields = ['title', 'description', 'requiredSkills', 'experienceLevel', 'scoringWeights', 'interviewQuestions'];
    
    for (const field of requiredFields) {
      if (!data[field as keyof CreateJobProfileRequest]) {
        throw new DatabaseError(
          `Required field missing: ${field}`,
          'VALIDATION_ERROR',
          400
        );
      }
    }

    if (data.requiredSkills.length === 0) {
      throw new DatabaseError(
        'At least one required skill must be specified',
        'VALIDATION_ERROR',
        400
      );
    }

    if (data.interviewQuestions.length === 0) {
      throw new DatabaseError(
        'At least one interview question must be specified',
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * Convert MongoDB document to JobProfile interface
   */
  private toJobProfile(doc: any): JobProfile {
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      requiredSkills: doc.requiredSkills,
      experienceLevel: doc.experienceLevel,
      scoringWeights: doc.scoringWeights,
      interviewQuestions: doc.interviewQuestions,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }
}

// Export singleton instance
export const jobProfileService = new JobProfileService();