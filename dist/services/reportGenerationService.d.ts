import { Candidate, JobProfile, ProcessingBatch, InterviewAnalysisResult } from '../models/interfaces';
export interface CandidateReport {
    candidate: Candidate;
    jobProfile: JobProfile;
    completionStatus: {
        resumeProcessed: boolean;
        aiAnalysisCompleted: boolean;
        linkedInAnalysisCompleted: boolean;
        githubAnalysisCompleted: boolean;
        interviewCompleted: boolean;
        scoringCompleted: boolean;
    };
    reportGeneratedAt: Date;
}
export interface BatchSummaryReport {
    batch: ProcessingBatch;
    jobProfile: JobProfile;
    candidateReports: CandidateReport[];
    summary: {
        totalCandidates: number;
        completedCandidates: number;
        failedCandidates: number;
        averageScore: number;
        topCandidates: Candidate[];
        processingTime: number;
    };
    reportGeneratedAt: Date;
}
export declare class ReportGenerationService {
    private reportsDir;
    constructor();
    private ensureReportsDirectory;
    generateCandidateReport(candidate: Candidate, jobProfile: JobProfile, interviewAnalysis?: InterviewAnalysisResult): Promise<CandidateReport>;
    generateCandidatePDF(candidate: Candidate, jobProfile: JobProfile, interviewAnalysis?: InterviewAnalysisResult): Promise<string>;
    generateBatchSummaryReport(batch: ProcessingBatch, candidates: Candidate[], jobProfile: JobProfile, interviewAnalyses?: InterviewAnalysisResult[]): Promise<BatchSummaryReport>;
    generateBatchSummaryPDF(batch: ProcessingBatch, candidates: Candidate[], jobProfile: JobProfile, interviewAnalyses?: InterviewAnalysisResult[]): Promise<string>;
    exportCandidatesCSV(candidates: Candidate[], jobProfile: JobProfile, interviewAnalyses?: InterviewAnalysisResult[]): Promise<string>;
    private escapeCsvValue;
    private assessCompletionStatus;
    private generateCandidateHTML;
    private generateBatchSummaryHTML;
    private generateScoreSection;
    private generateAIAnalysisSection;
    private generateLinkedInSection;
    private generateGitHubSection;
    private generateInterviewSection;
    private generateRecommendationSection;
    private getScoreClass;
    private getRecommendationClass;
}
//# sourceMappingURL=reportGenerationService.d.ts.map