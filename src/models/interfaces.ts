// Core TypeScript interfaces for the Job Candidate Filtering Funnel System

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
  relevanceScore: number; // 0-100
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
  professionalScore: number; // 0-100
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
  technicalScore: number; // 0-100
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
  compositeScore: number; // 0-100
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