import { LinkedInAnalysis, JobProfile } from '../models/interfaces';
export interface LinkedInProfileData {
    profile: {
        firstName?: string;
        lastName?: string;
        headline?: string;
        summary?: string;
        location?: string;
        connections?: number;
        followers?: number;
        profileUrl?: string;
    };
    experience?: Array<{
        title: string;
        company: string;
        duration: string;
        description?: string;
        startDate?: string;
        endDate?: string;
    }>;
    education?: Array<{
        school: string;
        degree?: string;
        field?: string;
        startYear?: number;
        endYear?: number;
    }>;
    skills?: Array<{
        name: string;
        endorsements?: number;
    }>;
    endorsements?: Array<{
        skill: string;
        count: number;
    }>;
    recommendations?: Array<{
        text: string;
        recommender: string;
    }>;
}
export interface LinkedInScraperResponse {
    success: boolean;
    data?: LinkedInProfileData;
    error?: string;
    message?: string;
    rateLimitRemaining?: number;
    rateLimitReset?: number;
}
export declare class LinkedInAnalysisService {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly maxRetries;
    private readonly retryDelay;
    constructor();
    analyzeLinkedInProfile(candidateId: string, linkedInUrl: string, jobProfile: JobProfile): Promise<LinkedInAnalysis>;
    private scrapeLinkedInProfile;
    private analyzeProfileData;
    private analyzeExperience;
    private analyzeNetwork;
    private assessCredibility;
    private calculateProfessionalScore;
    private isValidLinkedInUrl;
    private parseDuration;
    private isRelevantRole;
    private assessCompanyQuality;
    private determineOverallCompanyQuality;
    private getMatchedSkills;
    private getCompanyQualityScore;
    private createFailedAnalysis;
    private delay;
    testConnection(): Promise<boolean>;
    getApiUsage(): Promise<{
        remaining: number;
        reset: Date;
    } | null>;
    private classifyError;
    private getErrorStatusCode;
}
export declare const linkedInAnalysisService: LinkedInAnalysisService;
//# sourceMappingURL=linkedInAnalysisService.d.ts.map