export interface JobProfile {
    id: string;
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
    createdAt: Date;
    updatedAt: Date;
}
export interface ResumeData {
    id: string;
    fileName: string;
    extractedText: string;
    contactInfo: {
        phone?: string;
        email?: string;
        linkedInUrl?: string;
        githubUrl?: string;
        projectUrls: string[];
    };
    processingStatus: 'pending' | 'completed' | 'failed';
    extractionErrors?: string[];
}
export interface AIAnalysisResult {
    candidateId: string;
    provider: 'gemini' | 'openai' | 'claude';
    relevanceScore: number;
    skillsMatch: {
        matched: string[];
        missing: string[];
    };
    experienceAssessment: string;
    reasoning: string;
    confidence: number;
}
export interface LinkedInAnalysis {
    candidateId: string;
    profileAccessible: boolean;
    professionalScore: number;
    experience: {
        totalYears: number;
        relevantRoles: number;
        companyQuality: string;
    };
    network: {
        connections: number;
        endorsements: number;
    };
    credibilityIndicators: string[];
}
export interface GitHubAnalysis {
    candidateId: string;
    profileStats: {
        publicRepos: number;
        followers: number;
        contributionStreak: number;
        totalCommits: number;
    };
    technicalScore: number;
    projectAuthenticity: {
        resumeProjects: Array<{
            url: string;
            isAuthentic: boolean;
            commitHistory: number;
            branchingPattern: string;
            codeQuality: string;
        }>;
    };
    skillsEvidence: string[];
}
export interface InterviewSession {
    candidateId: string;
    jobProfileId: string;
    vapiCallId: string;
    scheduledAt: Date;
    status: 'scheduled' | 'in-progress' | 'completed' | 'failed' | 'no-answer';
    transcript?: string;
    duration?: number;
    callQuality: 'excellent' | 'good' | 'poor';
    retryCount: number;
}
export interface CandidateScore {
    candidateId: string;
    jobProfileId: string;
    compositeScore: number;
    stageScores: {
        resumeAnalysis: number;
        linkedInAnalysis: number;
        githubAnalysis: number;
        interviewPerformance: number;
    };
    appliedWeights: {
        resumeAnalysis: number;
        linkedInAnalysis: number;
        githubAnalysis: number;
        interviewPerformance: number;
    };
    rank: number;
    recommendation: 'strong-hire' | 'hire' | 'maybe' | 'no-hire';
    reasoning: string;
}
export interface Candidate {
    id: string;
    resumeData: ResumeData;
    aiAnalysis?: AIAnalysisResult;
    linkedInAnalysis?: LinkedInAnalysis;
    githubAnalysis?: GitHubAnalysis;
    interviewSession?: InterviewSession;
    finalScore?: CandidateScore;
    processingStage: 'resume' | 'ai-analysis' | 'linkedin' | 'github' | 'interview' | 'scoring' | 'completed';
    createdAt: Date;
    updatedAt: Date;
}
export interface InterviewAnalysisResult {
    candidateId: string;
    interviewSessionId: string;
    provider: 'gemini' | 'openai' | 'claude';
    performanceScore: number;
    communicationScore: number;
    technicalScore: number;
    competencyScores: {
        [competency: string]: number;
    };
    transcriptQuality: 'excellent' | 'good' | 'poor';
    needsManualReview: boolean;
    detailedFeedback: {
        strengths: string[];
        weaknesses: string[];
        recommendations: string[];
    };
    responseAnalysis: Array<{
        question: string;
        response: string;
        score: number;
        feedback: string;
    }>;
    overallAssessment: string;
    confidence: number;
    analysisTimestamp: Date;
}
export interface ProcessingBatch {
    id: string;
    jobProfileId: string;
    totalCandidates: number;
    processedCandidates: number;
    failedCandidates: number;
    status: 'processing' | 'completed' | 'failed';
    startedAt: Date;
    completedAt?: Date;
    candidateIds: string[];
}
export interface JobData {
    candidateId: string;
    jobProfileId: string;
    batchId: string;
    stage: 'resume' | 'ai-analysis' | 'linkedin' | 'github' | 'interview' | 'scoring';
    priority?: number;
    metadata?: Record<string, any>;
}
export interface JobProgress {
    jobId: string;
    candidateId: string;
    stage: string;
    progress: number;
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    result?: any;
}
export interface QueueStats {
    queueName: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
}
export interface BatchProgress {
    batchId: string;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
    progress: number;
    estimatedTimeRemaining?: number;
    stages: {
        [stage: string]: {
            total: number;
            completed: number;
            failed: number;
            progress: number;
        };
    };
}
//# sourceMappingURL=interfaces.d.ts.map