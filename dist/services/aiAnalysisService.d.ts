import { AIAnalysisResult, JobProfile, ResumeData } from '../models/interfaces';
export type AIProvider = 'gemini' | 'openai' | 'claude';
export interface AIProviderConfig {
    name: AIProvider;
    maxRetries: number;
    timeout: number;
}
export interface AnalysisPromptData {
    resumeText: string;
    jobProfile: JobProfile;
}
export declare class AIAnalysisService {
    private geminiClient;
    private openaiClient;
    private claudeClient;
    private providerConfigs;
    constructor();
    analyzeResume(candidateId: string, resumeData: ResumeData, jobProfile: JobProfile): Promise<AIAnalysisResult>;
    private analyzeWithProvider;
    private callProvider;
    private analyzeWithGemini;
    private analyzeWithOpenAI;
    private analyzeWithClaude;
    private buildAnalysisPrompt;
    private parseAIResponse;
    private createTimeoutPromise;
    testProviders(): Promise<Record<AIProvider, boolean>>;
    private classifyError;
    private getErrorStatusCode;
}
export declare const aiAnalysisService: AIAnalysisService;
//# sourceMappingURL=aiAnalysisService.d.ts.map