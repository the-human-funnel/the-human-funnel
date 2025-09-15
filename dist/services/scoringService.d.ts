import { CandidateScore, Candidate, JobProfile } from '../models/interfaces';
export interface ScoringThresholds {
    strongHire: number;
    hire: number;
    maybe: number;
}
export interface RankingOptions {
    thresholds?: ScoringThresholds;
    minStageScores?: {
        resumeAnalysis?: number;
        linkedInAnalysis?: number;
        githubAnalysis?: number;
        interviewPerformance?: number;
    };
}
export interface ScoringBreakdown {
    candidateId: string;
    stageContributions: {
        resumeAnalysis: {
            rawScore: number;
            weight: number;
            weightedScore: number;
        };
        linkedInAnalysis: {
            rawScore: number;
            weight: number;
            weightedScore: number;
        };
        githubAnalysis: {
            rawScore: number;
            weight: number;
            weightedScore: number;
        };
        interviewPerformance: {
            rawScore: number;
            weight: number;
            weightedScore: number;
        };
    };
    compositeScore: number;
    missingStages: string[];
}
export declare class ScoringService {
    private defaultThresholds;
    calculateCandidateScore(candidate: Candidate, jobProfile: JobProfile, thresholds?: ScoringThresholds): Promise<CandidateScore>;
    calculateScoringBreakdown(candidate: Candidate, jobProfile: JobProfile): ScoringBreakdown;
    rankCandidates(candidates: Candidate[], jobProfile: JobProfile, options?: RankingOptions): Promise<CandidateScore[]>;
    filterByThreshold(candidateScores: CandidateScore[], minScore: number): CandidateScore[];
    getCandidatesByRecommendation(candidateScores: CandidateScore[], recommendation: 'strong-hire' | 'hire' | 'maybe' | 'no-hire'): CandidateScore[];
    private extractResumeScore;
    private extractLinkedInScore;
    private extractGitHubScore;
    private extractInterviewScore;
    private calculateAvailableWeight;
    private generateRecommendation;
    private generateReasoning;
    private formatStageName;
    private applyStageFilters;
}
//# sourceMappingURL=scoringService.d.ts.map