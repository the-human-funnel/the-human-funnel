import { InterviewSession, JobProfile, Candidate } from '../models/interfaces';
export interface VAPICallRequest {
    phoneNumber: string;
    assistant: {
        model: {
            provider: 'openai';
            model: 'gpt-4';
            temperature: number;
        };
        voice: {
            provider: 'elevenlabs' | 'azure' | 'playht';
            voiceId: string;
        };
        firstMessage: string;
        systemMessage: string;
        recordingEnabled: boolean;
        endCallMessage: string;
        maxDurationSeconds: number;
    };
    metadata?: Record<string, any>;
}
export interface VAPICallResponse {
    id: string;
    status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
    phoneNumber: string;
    startedAt?: string;
    endedAt?: string;
    duration?: number;
    transcript?: string;
    recordingUrl?: string;
    cost?: number;
    endedReason?: 'customer-ended-call' | 'assistant-ended-call' | 'phone-call-provider-closed-websocket' | 'assistant-not-responding' | 'exceeded-max-duration' | 'no-answer' | 'busy' | 'failed';
    metadata?: Record<string, any>;
}
export interface VAPIWebhookPayload {
    message: {
        type: 'status-update' | 'transcript' | 'hang' | 'speech-update' | 'function-call';
        call: VAPICallResponse;
        timestamp: string;
    };
}
export declare class VAPIInterviewService {
    private readonly baseUrl;
    private readonly apiKey;
    private readonly maxRetries;
    private readonly retryDelay;
    private readonly maxCallDuration;
    constructor();
    scheduleInterview(candidate: Candidate, jobProfile: JobProfile, phoneNumber: string): Promise<InterviewSession>;
    private initiateCall;
    getCallStatus(vapiCallId: string): Promise<VAPICallResponse>;
    updateInterviewSession(interviewSession: InterviewSession, vapiCallData: VAPICallResponse): Promise<InterviewSession>;
    retryInterview(interviewSession: InterviewSession, candidate: Candidate, jobProfile: JobProfile, phoneNumber: string): Promise<InterviewSession>;
    private generateInterviewQuestions;
    private generateSkillQuestions;
    private generateExperienceQuestions;
    private generateBackgroundQuestions;
    private buildCallRequest;
    private buildSystemMessage;
    private determineEndStatus;
    private assessCallQuality;
    processWebhook(payload: VAPIWebhookPayload): Promise<void>;
    private handleStatusUpdate;
    private handleTranscriptUpdate;
    private handleCallEnd;
    private isValidPhoneNumber;
    private formatPhoneNumber;
    private delay;
    testConnection(): Promise<boolean>;
    getAccountInfo(): Promise<{
        credits: number;
        callsThisMonth: number;
    } | null>;
    private classifyError;
    private getErrorStatusCode;
}
export declare const vapiInterviewService: VAPIInterviewService;
//# sourceMappingURL=vapiInterviewService.d.ts.map