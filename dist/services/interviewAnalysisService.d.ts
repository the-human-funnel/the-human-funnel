import { InterviewAnalysisResult, JobProfile, InterviewSession } from '../models/interfaces';
export type AIProvider = 'gemini' | 'openai' | 'claude';
export interface AIProviderConfig {
    name: AIProvider;
    maxRetries: number;
    timeout: number;
}
export interface TranscriptAnalysisData {
    transcript: string;
    jobProfile: JobProfile;
    interviewSession: InterviewSession;
}
export declare class InterviewAnalysisService {
    private geminiClient;
    private openaiClient;
    private claudeClient;
    private providerConfigs;
    constructor();
    analyzeTranscript(candidateId: string, interviewSession: InterviewSession, jobProfile: JobProfile): Promise<InterviewAnalysisResult>;
    private analyzeWithProvider;
    private callProvider;
    private analyzeWithGemini;
    private analyzeWithOpenAI;
    private analyzeWithClaude;
    private buildAnalysisPrompt;
    private parseAIResponse;
    private createFallbackResult;
    private assessTranscriptQuality;
    private assessCoherence;
    private validateScore;
    private validateCompetencyScores;
    private createTimeoutPromise;
    batchAnalyzeTranscripts(analysisRequests: Array<{
        candidateId: string;
        interviewSession: InterviewSession;
        jobProfile: JobProfile;
    }>): Promise<Array<{
        candidateId: string;
        result?: InterviewAnalysisResult;
        error?: string;
    }>>;
    testProviders(): Promise<{
        [provider: string]: boolean;
    }>;
}
export declare const interviewAnalysisService: InterviewAnalysisService;
//# sourceMappingURL=interviewAnalysisService.d.ts.map