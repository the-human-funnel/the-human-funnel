import { GitHubAnalysis, JobProfile } from '../models/interfaces';
export interface GitHubProfileData {
    profile: {
        login: string;
        id: number;
        name?: string;
        company?: string;
        blog?: string;
        location?: string;
        email?: string;
        bio?: string;
        public_repos: number;
        public_gists: number;
        followers: number;
        following: number;
        created_at: string;
        updated_at: string;
    };
    repositories: Array<{
        id: number;
        name: string;
        full_name: string;
        description?: string;
        private: boolean;
        html_url: string;
        clone_url: string;
        language?: string;
        size: number;
        stargazers_count: number;
        watchers_count: number;
        forks_count: number;
        open_issues_count: number;
        created_at: string;
        updated_at: string;
        pushed_at: string;
        default_branch: string;
    }>;
    events: Array<{
        type: string;
        created_at: string;
        repo?: {
            name: string;
        };
    }>;
}
export interface GitHubCommitData {
    sha: string;
    commit: {
        author: {
            name: string;
            email: string;
            date: string;
        };
        committer: {
            name: string;
            email: string;
            date: string;
        };
        message: string;
    };
    author?: {
        login: string;
    };
    committer?: {
        login: string;
    };
}
export interface GitHubBranchData {
    name: string;
    commit: {
        sha: string;
    };
    protected: boolean;
}
export declare class GitHubAnalysisService {
    private readonly baseUrl;
    private readonly token;
    private readonly maxRetries;
    private readonly retryDelay;
    constructor();
    analyzeGitHubProfile(candidateId: string, githubUrl: string, jobProfile: JobProfile, resumeProjectUrls?: string[]): Promise<GitHubAnalysis>;
    private fetchGitHubProfileData;
    private makeGitHubRequest;
    private analyzeProfileData;
    private calculateProfileStats;
    private calculateContributionStreak;
    private estimateTotalCommits;
    private extractSkillsEvidence;
    private extractTechKeywords;
    private analyzeProjectAuthenticity;
    private analyzeRepositoryCommits;
    private hasConsistentCommitActivity;
    private analyzeRepositoryBranches;
    private assessCodeQuality;
    private calculateTechnicalScore;
    private isValidGitHubUrl;
    private extractUsernameFromUrl;
    private extractRepoInfoFromUrl;
    private createFailedAnalysis;
    private delay;
    testConnection(): Promise<boolean>;
    getRateLimitStatus(): Promise<{
        remaining: number;
        reset: Date;
    } | null>;
    private classifyError;
    private getErrorStatusCode;
}
export declare const githubAnalysisService: GitHubAnalysisService;
//# sourceMappingURL=githubAnalysisService.d.ts.map