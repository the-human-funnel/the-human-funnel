import { JobProfile } from '../models/interfaces';
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
export declare class JobProfileService {
    createJobProfile(data: CreateJobProfileRequest): Promise<JobProfile>;
    getJobProfileById(id: string): Promise<JobProfile | null>;
    getJobProfiles(filters?: JobProfileFilters): Promise<JobProfile[]>;
    updateJobProfile(data: UpdateJobProfileRequest): Promise<JobProfile | null>;
    deleteJobProfile(id: string): Promise<boolean>;
    jobProfileExists(id: string): Promise<boolean>;
    getJobProfilesCount(filters?: JobProfileFilters): Promise<number>;
    private validateScoringWeights;
    private validateRequiredFields;
    private toJobProfile;
}
export declare const jobProfileService: JobProfileService;
//# sourceMappingURL=jobProfileService.d.ts.map