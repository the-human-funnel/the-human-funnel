import { Candidate, ProcessingBatch } from '../models/interfaces';
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
export declare class CandidateService {
    getCandidateById(candidateId: string): Promise<Candidate | null>;
    searchCandidates(filters?: CandidateFilters, options?: CandidateSearchOptions): Promise<{
        candidates: Candidate[];
        total: number;
        page: number;
        totalPages: number;
    }>;
    getCandidateStatus(candidateId: string): Promise<{
        candidate: Candidate;
        progress: {
            stage: string;
            completed: boolean;
            error?: string;
        }[];
    } | null>;
    getBatchProgress(batchId: string): Promise<{
        batch: ProcessingBatch;
        candidateProgress: Array<{
            candidateId: string;
            stage: string;
            completed: boolean;
        }>;
    } | null>;
    exportCandidates(filters: CandidateFilters | undefined, options: CandidateExportOptions): Promise<string>;
    getCandidatesCount(filters?: CandidateFilters): Promise<number>;
    getTopCandidates(jobProfileId: string, limit?: number): Promise<Candidate[]>;
    private isStageCompleted;
    private getStageError;
    private exportToCsv;
    private exportToJson;
    private isValidObjectId;
    private setNestedProperty;
}
export declare const candidateService: CandidateService;
//# sourceMappingURL=candidateService.d.ts.map