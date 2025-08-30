// Candidate management service
import { CandidateModel, ProcessingBatchModel } from '../models/schemas';
import { Candidate, CandidateScore, ProcessingBatch } from '../models/interfaces';

export interface CandidateFilters {
  jobProfileId?: string;
  processingStage?: string;
  minScore?: number;
  maxScore?: number;
  recommendation?: 'strong-hire' | 'hire' | 'maybe' | 'no-hire';
  createdAfter?: Date;
  createdBefore?: Date;
  hasLinkedIn?: boolean;
  hasGitHub?: boolean;
  interviewCompleted?: boolean;
}

export interface CandidateSearchOptions {
  page?: number;
  limit?: number;
  sortBy?: 'score' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface CandidateExportOptions {
  format: 'csv' | 'json';
  includeDetails?: boolean;
  fields?: string[];
}

export class CandidateService {

  /**
   * Get candidate by ID
   */
  async getCandidateById(candidateId: string): Promise<Candidate | null> {
    try {
      // Validate ObjectId format
      if (!this.isValidObjectId(candidateId)) {
        return null;
      }
      
      const candidate = await CandidateModel.findOne({ _id: candidateId }).lean();
      return candidate ? { ...candidate, id: candidate._id.toString() } : null;
    } catch (error) {
      console.error('Error getting candidate by ID:', error);
      throw new Error('Failed to retrieve candidate');
    }
  }

  /**
   * Search and filter candidates
   */
  async searchCandidates(
    filters: CandidateFilters = {},
    options: CandidateSearchOptions = {}
  ): Promise<{ candidates: Candidate[]; total: number; page: number; totalPages: number }> {
    try {
      const {
        page = 1,
        limit = 50,
        sortBy = 'score',
        sortOrder = 'desc'
      } = options;

      // Build MongoDB query
      const query: any = {};

      if (filters.jobProfileId) {
        query['finalScore.jobProfileId'] = filters.jobProfileId;
      }

      if (filters.processingStage) {
        query.processingStage = filters.processingStage;
      }

      if (filters.minScore !== undefined || filters.maxScore !== undefined) {
        query['finalScore.compositeScore'] = {};
        if (filters.minScore !== undefined) {
          query['finalScore.compositeScore'].$gte = filters.minScore;
        }
        if (filters.maxScore !== undefined) {
          query['finalScore.compositeScore'].$lte = filters.maxScore;
        }
      }

      if (filters.recommendation) {
        query['finalScore.recommendation'] = filters.recommendation;
      }

      if (filters.createdAfter || filters.createdBefore) {
        query.createdAt = {};
        if (filters.createdAfter) {
          query.createdAt.$gte = filters.createdAfter;
        }
        if (filters.createdBefore) {
          query.createdAt.$lte = filters.createdBefore;
        }
      }

      if (filters.hasLinkedIn !== undefined) {
        if (filters.hasLinkedIn) {
          query['resumeData.contactInfo.linkedInUrl'] = { $exists: true, $ne: null };
        } else {
          query['resumeData.contactInfo.linkedInUrl'] = { $exists: false };
        }
      }

      if (filters.hasGitHub !== undefined) {
        if (filters.hasGitHub) {
          query['resumeData.contactInfo.githubUrl'] = { $exists: true, $ne: null };
        } else {
          query['resumeData.contactInfo.githubUrl'] = { $exists: false };
        }
      }

      if (filters.interviewCompleted !== undefined) {
        if (filters.interviewCompleted) {
          query['interviewSession.status'] = 'completed';
        } else {
          query['interviewSession.status'] = { $ne: 'completed' };
        }
      }

      // Build sort criteria
      const sort: any = {};
      switch (sortBy) {
        case 'score':
          sort['finalScore.compositeScore'] = sortOrder === 'desc' ? -1 : 1;
          break;
        case 'createdAt':
          sort.createdAt = sortOrder === 'desc' ? -1 : 1;
          break;
        case 'name':
          sort['resumeData.fileName'] = sortOrder === 'desc' ? -1 : 1;
          break;
        default:
          sort['finalScore.compositeScore'] = -1;
      }

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [candidatesRaw, total] = await Promise.all([
        CandidateModel.find(query).sort(sort).skip(skip).limit(limit).lean(),
        CandidateModel.countDocuments(query)
      ]);

      // Convert MongoDB documents to interface format
      const candidates = candidatesRaw.map(candidate => ({
        ...candidate,
        id: candidate._id.toString()
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        candidates,
        total,
        page,
        totalPages
      };
    } catch (error) {
      console.error('Error searching candidates:', error);
      throw new Error('Failed to search candidates');
    }
  }

  /**
   * Get candidate processing status
   */
  async getCandidateStatus(candidateId: string): Promise<{
    candidate: Candidate;
    progress: {
      stage: string;
      completed: boolean;
      error?: string;
    }[];
  } | null> {
    try {
      const candidate = await this.getCandidateById(candidateId);
      if (!candidate) {
        return null;
      }

      const stages = [
        'resume',
        'ai-analysis',
        'linkedin',
        'github',
        'interview',
        'scoring'
      ];

      const progress = stages.map(stage => {
        const completed = this.isStageCompleted(candidate, stage);
        const error = this.getStageError(candidate, stage);

        return {
          stage,
          completed,
          ...(error && { error })
        };
      });

      return {
        candidate,
        progress
      };
    } catch (error) {
      console.error('Error getting candidate status:', error);
      throw new Error('Failed to get candidate status');
    }
  }

  /**
   * Get batch processing progress
   */
  async getBatchProgress(batchId: string): Promise<{
    batch: ProcessingBatch;
    candidateProgress: Array<{
      candidateId: string;
      stage: string;
      completed: boolean;
    }>;
  } | null> {
    try {
      const batchRaw = await ProcessingBatchModel.findOne({ _id: batchId }).lean();
      if (!batchRaw) {
        return null;
      }

      const batch = { ...batchRaw, id: batchRaw._id.toString() };

      const candidatesRaw = await CandidateModel
        .find({ _id: { $in: batch.candidateIds } })
        .lean();

      const candidateProgress = candidatesRaw.map((candidate: any) => ({
        candidateId: candidate._id.toString(),
        stage: candidate.processingStage,
        completed: candidate.processingStage === 'completed'
      }));

      return {
        batch,
        candidateProgress
      };
    } catch (error) {
      console.error('Error getting batch progress:', error);
      throw new Error('Failed to get batch progress');
    }
  }

  /**
   * Export candidates data
   */
  async exportCandidates(
    filters: CandidateFilters = {},
    options: CandidateExportOptions
  ): Promise<string> {
    try {
      const { candidates } = await this.searchCandidates(filters, { limit: 10000 });

      if (options.format === 'csv') {
        return this.exportToCsv(candidates, options);
      } else {
        return this.exportToJson(candidates, options);
      }
    } catch (error) {
      console.error('Error exporting candidates:', error);
      throw new Error('Failed to export candidates');
    }
  }

  /**
   * Get candidates count by filters
   */
  async getCandidatesCount(filters: CandidateFilters = {}): Promise<number> {
    try {
      const query: any = {};

      if (filters.jobProfileId) {
        query['finalScore.jobProfileId'] = filters.jobProfileId;
      }

      if (filters.processingStage) {
        query.processingStage = filters.processingStage;
      }

      if (filters.recommendation) {
        query['finalScore.recommendation'] = filters.recommendation;
      }

      return await CandidateModel.countDocuments(query);
    } catch (error) {
      console.error('Error getting candidates count:', error);
      throw new Error('Failed to get candidates count');
    }
  }

  /**
   * Get top candidates by score
   */
  async getTopCandidates(
    jobProfileId: string,
    limit: number = 10
  ): Promise<Candidate[]> {
    try {
      const candidatesRaw = await CandidateModel
        .find({
          'finalScore.jobProfileId': jobProfileId,
          processingStage: 'completed'
        })
        .sort({ 'finalScore.compositeScore': -1 })
        .limit(limit)
        .lean();

      return candidatesRaw.map(candidate => ({
        ...candidate,
        id: candidate._id.toString()
      }));
    } catch (error) {
      console.error('Error getting top candidates:', error);
      throw new Error('Failed to get top candidates');
    }
  }

  /**
   * Check if a processing stage is completed for a candidate
   */
  private isStageCompleted(candidate: Candidate, stage: string): boolean {
    switch (stage) {
      case 'resume':
        return candidate.resumeData.processingStatus === 'completed';
      case 'ai-analysis':
        return !!candidate.aiAnalysis;
      case 'linkedin':
        return !!candidate.linkedInAnalysis;
      case 'github':
        return !!candidate.githubAnalysis;
      case 'interview':
        return !!candidate.interviewSession && candidate.interviewSession.status === 'completed';
      case 'scoring':
        return !!candidate.finalScore;
      default:
        return false;
    }
  }

  /**
   * Get error for a processing stage
   */
  private getStageError(candidate: Candidate, stage: string): string | undefined {
    switch (stage) {
      case 'resume':
        return candidate.resumeData.processingStatus === 'failed' 
          ? candidate.resumeData.extractionErrors?.join(', ')
          : undefined;
      case 'interview':
        return candidate.interviewSession?.status === 'failed'
          ? 'Interview failed or candidate did not answer'
          : undefined;
      default:
        return undefined;
    }
  }

  /**
   * Export candidates to CSV format
   */
  private exportToCsv(candidates: Candidate[], options: CandidateExportOptions): string {
    const headers = [
      'ID',
      'File Name',
      'Email',
      'Phone',
      'LinkedIn',
      'GitHub',
      'Processing Stage',
      'Composite Score',
      'Recommendation',
      'Created At'
    ];

    if (options.includeDetails) {
      headers.push(
        'Resume Score',
        'LinkedIn Score',
        'GitHub Score',
        'Interview Score',
        'AI Reasoning'
      );
    }

    const rows = candidates.map(candidate => {
      const row = [
        candidate.id,
        candidate.resumeData.fileName,
        candidate.resumeData.contactInfo.email || '',
        candidate.resumeData.contactInfo.phone || '',
        candidate.resumeData.contactInfo.linkedInUrl || '',
        candidate.resumeData.contactInfo.githubUrl || '',
        candidate.processingStage,
        candidate.finalScore?.compositeScore?.toString() || '',
        candidate.finalScore?.recommendation || '',
        candidate.createdAt.toISOString()
      ];

      if (options.includeDetails && candidate.finalScore) {
        row.push(
          candidate.finalScore.stageScores.resumeAnalysis?.toString() || '',
          candidate.finalScore.stageScores.linkedInAnalysis?.toString() || '',
          candidate.finalScore.stageScores.githubAnalysis?.toString() || '',
          candidate.finalScore.stageScores.interviewPerformance?.toString() || '',
          candidate.aiAnalysis?.reasoning || ''
        );
      }

      return row;
    });

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  /**
   * Export candidates to JSON format
   */
  private exportToJson(candidates: Candidate[], options: CandidateExportOptions): string {
    let exportData = candidates;

    if (options.fields && options.fields.length > 0) {
      exportData = candidates.map(candidate => {
        const filtered: any = {};
        options.fields!.forEach(field => {
          if (field.includes('.')) {
            // Handle nested fields
            const parts = field.split('.');
            let value = candidate as any;
            for (const part of parts) {
              value = value?.[part];
            }
            this.setNestedProperty(filtered, field, value);
          } else {
            filtered[field] = (candidate as any)[field];
          }
        });
        return filtered;
      });
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Validate if string is a valid MongoDB ObjectId
   */
  private isValidObjectId(id: string): boolean {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  /**
   * Set nested property in object
   */
  private setNestedProperty(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part && !current[part]) {
        current[part] = {};
      }
      if (part) {
        current = current[part];
      }
    }
    
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
  }
}

export const candidateService = new CandidateService();