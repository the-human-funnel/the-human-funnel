import axios, { AxiosResponse } from 'axios';
import { config } from '../utils/config';
import { InterviewSession, JobProfile, Candidate } from '../models/interfaces';
import { logger } from '../utils/logger';
import { monitoringService } from './monitoringService';
import { errorRecoveryService } from './errorRecoveryService';

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

export class VAPIInterviewService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 5000; // 5 seconds
  private readonly maxCallDuration: number = 1800; // 30 minutes

  constructor() {
    this.baseUrl = config.vapi.baseUrl;
    this.apiKey = config.vapi.apiKey;

    if (!this.apiKey) {
      console.warn('VAPI API key not configured. Interview functionality will be disabled.');
    }
  }

  /**
   * Schedule and initiate an AI phone interview for a candidate
   */
  async scheduleInterview(
    candidate: Candidate,
    jobProfile: JobProfile,
    phoneNumber: string
  ): Promise<InterviewSession> {
    const startTime = Date.now();
    
    logger.info(`Scheduling VAPI interview`, {
      service: 'vapiInterview',
      operation: 'scheduleInterview',
      candidateId: candidate.id,
      jobProfileId: jobProfile.id,
      phoneNumber: phoneNumber.substring(0, 6) + '***' // Mask phone number for privacy
    });

    if (!this.apiKey) {
      const error = 'VAPI API key not configured';
      logger.error(error, undefined, {
        service: 'vapiInterview',
        operation: 'scheduleInterview',
        candidateId: candidate.id
      });
      throw new Error(error);
    }

    if (!phoneNumber || !this.isValidPhoneNumber(phoneNumber)) {
      const error = 'Invalid or missing phone number';
      logger.error(error, undefined, {
        service: 'vapiInterview',
        operation: 'scheduleInterview',
        candidateId: candidate.id,
        phoneNumber: phoneNumber.substring(0, 6) + '***'
      });
      throw new Error(error);
    }

    try {
      // Generate dynamic questions based on job profile
      const interviewQuestions = this.generateInterviewQuestions(jobProfile, candidate);
      
      // Create VAPI call request
      const callRequest = this.buildCallRequest(phoneNumber, jobProfile, interviewQuestions);
      
      // Initiate the call
      const vapiCall = await this.initiateCall(callRequest);
      
      // Create interview session record
      const interviewSession: InterviewSession = {
        candidateId: candidate.id,
        jobProfileId: jobProfile.id,
        vapiCallId: vapiCall.id,
        scheduledAt: new Date(),
        status: 'scheduled',
        callQuality: 'good', // Will be updated based on actual call
        retryCount: 0,
      };

      const duration = Date.now() - startTime;
      
      // Record successful API usage
      monitoringService.recordApiUsage({
        service: 'vapi',
        endpoint: '/call',
        method: 'POST',
        statusCode: 200,
        responseTime: duration
      });
      
      logger.performance('VAPI interview scheduling', duration, true, {
        service: 'vapiInterview',
        operation: 'scheduleInterview',
        candidateId: candidate.id,
        jobProfileId: jobProfile.id,
        vapiCallId: vapiCall.id
      });
      
      logger.info(`Successfully scheduled VAPI interview`, {
        service: 'vapiInterview',
        operation: 'scheduleInterview',
        candidateId: candidate.id,
        jobProfileId: jobProfile.id,
        vapiCallId: vapiCall.id,
        duration,
        questionsCount: interviewQuestions.length
      });
      
      return interviewSession;

    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = this.getErrorStatusCode(error);
      const errorType = this.classifyError(error);
      
      // Record failed API usage
      monitoringService.recordApiUsage({
        service: 'vapi',
        endpoint: '/call',
        method: 'POST',
        statusCode,
        responseTime: duration
      });
      
      // Record failure for error recovery
      errorRecoveryService.recordFailure(
        'vapiInterview',
        'scheduleCall',
        errorType,
        error
      );
      
      logger.error(`Failed to schedule VAPI interview`, error, {
        service: 'vapiInterview',
        operation: 'scheduleInterview',
        candidateId: candidate.id,
        jobProfileId: jobProfile.id,
        duration,
        statusCode,
        errorType,
        phoneNumber: phoneNumber.substring(0, 6) + '***'
      });
      
      throw error;
    }
  }

  /**
   * Initiate a VAPI call
   */
  private async initiateCall(callRequest: VAPICallRequest): Promise<VAPICallResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`VAPI call attempt ${attempt}/${this.maxRetries}`);

        const response: AxiosResponse<VAPICallResponse> = await axios.post(
          `${this.baseUrl}/call`,
          callRequest,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
          }
        );

        if (!response.data || !response.data.id) {
          throw new Error('Invalid response from VAPI service');
        }

        return response.data;

      } catch (error) {
        lastError = error as Error;
        console.warn(`VAPI call attempt ${attempt} failed:`, error);

        // Handle specific error types
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 400) {
            throw new Error(`Invalid call request: ${error.response.data?.message || 'Bad request'}`);
          } else if (error.response?.status === 401) {
            throw new Error('VAPI API key is invalid or expired');
          } else if (error.response?.status === 429) {
            console.warn('VAPI API rate limit exceeded, waiting before retry...');
            await this.delay(this.retryDelay * attempt);
            continue;
          } else if (error.response?.status === 402) {
            throw new Error('Insufficient VAPI credits or payment required');
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('All VAPI call attempts failed');
  }

  /**
   * Get call status and details from VAPI
   */
  async getCallStatus(vapiCallId: string): Promise<VAPICallResponse> {
    try {
      const response: AxiosResponse<VAPICallResponse> = await axios.get(
        `${this.baseUrl}/call/${vapiCallId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Failed to get VAPI call status for ${vapiCallId}:`, error);
      throw error;
    }
  }

  /**
   * Update interview session based on VAPI call status
   */
  async updateInterviewSession(
    interviewSession: InterviewSession,
    vapiCallData: VAPICallResponse
  ): Promise<InterviewSession> {
    const updatedSession = { ...interviewSession };

    // Update status based on VAPI call status
    switch (vapiCallData.status) {
      case 'queued':
      case 'ringing':
        updatedSession.status = 'scheduled';
        break;
      case 'in-progress':
        updatedSession.status = 'in-progress';
        break;
      case 'ended':
        updatedSession.status = this.determineEndStatus(vapiCallData);
        if (vapiCallData.transcript) {
          updatedSession.transcript = vapiCallData.transcript;
        }
        if (vapiCallData.duration !== undefined) {
          updatedSession.duration = vapiCallData.duration;
        }
        updatedSession.callQuality = this.assessCallQuality(vapiCallData);
        break;
      default:
        updatedSession.status = 'failed';
    }

    return updatedSession;
  }

  /**
   * Retry a failed or unanswered interview
   */
  async retryInterview(
    interviewSession: InterviewSession,
    candidate: Candidate,
    jobProfile: JobProfile,
    phoneNumber: string
  ): Promise<InterviewSession> {
    console.log(`Retrying VAPI interview for candidate ${candidate.id}, attempt ${interviewSession.retryCount + 1}`);

    if (interviewSession.retryCount >= 2) {
      throw new Error('Maximum retry attempts reached for interview');
    }

    try {
      // Generate fresh questions for retry
      const interviewQuestions = this.generateInterviewQuestions(jobProfile, candidate);
      
      // Create new call request
      const callRequest = this.buildCallRequest(phoneNumber, jobProfile, interviewQuestions);
      
      // Initiate the retry call
      const vapiCall = await this.initiateCall(callRequest);
      
      // Update interview session
      const updatedSession: InterviewSession = {
        ...interviewSession,
        vapiCallId: vapiCall.id,
        scheduledAt: new Date(),
        status: 'scheduled',
        retryCount: interviewSession.retryCount + 1,
      };
      
      // Clear previous transcript and duration
      delete (updatedSession as any).transcript;
      delete (updatedSession as any).duration;

      console.log(`Successfully retried VAPI interview for candidate ${candidate.id}, new call ID: ${vapiCall.id}`);
      return updatedSession;

    } catch (error) {
      console.error(`Failed to retry VAPI interview for candidate ${candidate.id}:`, error);
      throw error;
    }
  }

  /**
   * Generate dynamic interview questions based on job profile and candidate data
   */
  private generateInterviewQuestions(jobProfile: JobProfile, candidate: Candidate): string[] {
    const questions: string[] = [];

    // Start with basic questions
    questions.push("Hello! Thank you for taking the time to speak with us today. Can you please introduce yourself and tell me about your current role?");

    // Add job-specific questions from profile
    if (jobProfile.interviewQuestions && jobProfile.interviewQuestions.length > 0) {
      questions.push(...jobProfile.interviewQuestions);
    }

    // Generate skill-based questions
    const skillQuestions = this.generateSkillQuestions(jobProfile.requiredSkills);
    questions.push(...skillQuestions);

    // Add experience-level appropriate questions
    const experienceQuestions = this.generateExperienceQuestions(jobProfile.experienceLevel);
    questions.push(...experienceQuestions);

    // Add questions based on candidate's background if available
    if (candidate.aiAnalysis) {
      const backgroundQuestions = this.generateBackgroundQuestions(candidate.aiAnalysis);
      questions.push(...backgroundQuestions);
    }

    // Add closing questions
    questions.push("Do you have any questions about the role or our company?");
    questions.push("Thank you for your time today. We'll be in touch soon with next steps.");

    return questions.slice(0, 8); // Limit to 8 questions for reasonable call duration
  }

  /**
   * Generate skill-specific questions
   */
  private generateSkillQuestions(requiredSkills: string[]): string[] {
    const questions: string[] = [];
    const skillTemplates = [
      "Can you describe your experience with {skill}?",
      "How have you used {skill} in your previous projects?",
      "What challenges have you faced when working with {skill}?",
      "Can you walk me through a project where {skill} was crucial?",
    ];

    // Select top 3 skills for questions
    const topSkills = requiredSkills.slice(0, 3);
    
    topSkills.forEach((skill, index) => {
      const template = skillTemplates[index % skillTemplates.length];
      if (template) {
        questions.push(template.replace('{skill}', skill));
      }
    });

    return questions;
  }

  /**
   * Generate experience-level appropriate questions
   */
  private generateExperienceQuestions(experienceLevel: string): string[] {
    const level = experienceLevel.toLowerCase();
    
    if (level.includes('senior') || level.includes('lead')) {
      return [
        "Can you describe a time when you had to mentor junior team members?",
        "How do you approach technical decision-making in complex projects?",
      ];
    } else if (level.includes('mid') || level.includes('intermediate')) {
      return [
        "Describe a challenging project you've worked on and how you overcame obstacles.",
        "How do you stay updated with new technologies in your field?",
      ];
    } else {
      return [
        "What interests you most about this role and our company?",
        "Can you tell me about a project you're particularly proud of?",
      ];
    }
  }

  /**
   * Generate questions based on candidate's AI analysis
   */
  private generateBackgroundQuestions(aiAnalysis: any): string[] {
    const questions: string[] = [];

    if (aiAnalysis.skillsMatch?.missing?.length > 0) {
      const missingSkill = aiAnalysis.skillsMatch.missing[0];
      questions.push(`I noticed you might not have extensive experience with ${missingSkill}. How would you approach learning this technology?`);
    }

    if (aiAnalysis.experienceAssessment) {
      questions.push("Can you elaborate on the experience mentioned in your resume that you think is most relevant to this role?");
    }

    return questions;
  }

  /**
   * Build VAPI call request object
   */
  private buildCallRequest(
    phoneNumber: string,
    jobProfile: JobProfile,
    questions: string[]
  ): VAPICallRequest {
    const systemMessage = this.buildSystemMessage(jobProfile, questions);
    const firstMessage = "Hello! This is an AI assistant calling regarding your job application. Do you have a few minutes to discuss the position?";

    return {
      phoneNumber: this.formatPhoneNumber(phoneNumber),
      assistant: {
        model: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.3,
        },
        voice: {
          provider: 'elevenlabs',
          voiceId: 'pNInz6obpgDQGcFmaJgB', // Professional female voice
        },
        firstMessage,
        systemMessage,
        recordingEnabled: true,
        endCallMessage: "Thank you for your time today. We'll be in touch with next steps. Have a great day!",
        maxDurationSeconds: this.maxCallDuration,
      },
      metadata: {
        jobProfileId: jobProfile.id,
        jobTitle: jobProfile.title,
        interviewType: 'screening',
      },
    };
  }

  /**
   * Build system message for AI interviewer
   */
  private buildSystemMessage(jobProfile: JobProfile, questions: string[]): string {
    return `You are a professional AI interviewer conducting a phone screening for the position of ${jobProfile.title}.

JOB DETAILS:
- Title: ${jobProfile.title}
- Required Skills: ${jobProfile.requiredSkills.join(', ')}
- Experience Level: ${jobProfile.experienceLevel}

INTERVIEW GUIDELINES:
1. Be professional, friendly, and conversational
2. Ask the prepared questions in a natural flow
3. Listen actively and ask follow-up questions when appropriate
4. Keep the interview focused but allow for natural conversation
5. Take note of the candidate's communication skills and technical knowledge
6. The interview should last 15-25 minutes maximum
7. If the candidate seems confused or can't hear well, speak more clearly and slowly

PREPARED QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

CONVERSATION FLOW:
- Start with the first message to confirm availability
- If they're available, proceed with the introduction question
- Ask follow-up questions based on their responses
- Cover the key prepared questions naturally
- End with closing questions and next steps

IMPORTANT NOTES:
- If the candidate asks about salary, benefits, or specific company details, politely redirect to HR
- If they ask technical questions beyond the scope, acknowledge and note for follow-up
- If the call quality is poor, suggest calling back at a better time
- Be respectful of their time and keep the conversation moving

Remember: You're representing the company, so maintain professionalism while being personable.`;
  }

  /**
   * Determine final interview status based on VAPI call data
   */
  private determineEndStatus(vapiCallData: VAPICallResponse): InterviewSession['status'] {
    if (!vapiCallData.endedReason) {
      return 'completed';
    }

    switch (vapiCallData.endedReason) {
      case 'customer-ended-call':
      case 'assistant-ended-call':
        return 'completed';
      case 'no-answer':
      case 'busy':
        return 'no-answer';
      case 'exceeded-max-duration':
        return 'completed'; // Still got some interview data
      case 'phone-call-provider-closed-websocket':
      case 'assistant-not-responding':
      case 'failed':
        return 'failed';
      default:
        return 'completed';
    }
  }

  /**
   * Assess call quality based on VAPI call data
   */
  private assessCallQuality(vapiCallData: VAPICallResponse): InterviewSession['callQuality'] {
    // Assess based on duration and completion
    const duration = vapiCallData.duration || 0;
    const hasTranscript = Boolean(vapiCallData.transcript && vapiCallData.transcript.length > 100);
    
    if (duration >= 600 && hasTranscript) { // 10+ minutes with good transcript
      return 'excellent';
    } else if (duration >= 300 && hasTranscript) { // 5+ minutes with transcript
      return 'good';
    } else if (duration >= 300) { // 5+ minutes without transcript
      return 'good';
    } else if (duration >= 120) { // At least 2 minutes
      return 'good';
    } else {
      return 'poor';
    }
  }

  /**
   * Process VAPI webhook for real-time updates
   */
  async processWebhook(payload: VAPIWebhookPayload): Promise<void> {
    try {
      const { message } = payload;
      const callId = message.call.id;

      console.log(`Processing VAPI webhook for call ${callId}, type: ${message.type}`);

      // Handle different webhook types
      switch (message.type) {
        case 'status-update':
          await this.handleStatusUpdate(message.call);
          break;
        case 'transcript':
          await this.handleTranscriptUpdate(message.call);
          break;
        case 'hang':
          await this.handleCallEnd(message.call);
          break;
        default:
          console.log(`Unhandled webhook type: ${message.type}`);
      }

    } catch (error) {
      console.error('Failed to process VAPI webhook:', error);
      throw error;
    }
  }

  /**
   * Handle status update webhook
   */
  private async handleStatusUpdate(callData: VAPICallResponse): Promise<void> {
    console.log(`Call ${callData.id} status updated to: ${callData.status}`);
    // This would typically update the database record
    // Implementation depends on your database layer
  }

  /**
   * Handle transcript update webhook
   */
  private async handleTranscriptUpdate(callData: VAPICallResponse): Promise<void> {
    console.log(`Transcript updated for call ${callData.id}`);
    // This would typically update the interview session with partial transcript
    // Implementation depends on your database layer
  }

  /**
   * Handle call end webhook
   */
  private async handleCallEnd(callData: VAPICallResponse): Promise<void> {
    console.log(`Call ${callData.id} ended. Reason: ${callData.endedReason}, Duration: ${callData.duration}s`);
    // This would typically finalize the interview session
    // Implementation depends on your database layer
  }

  /**
   * Helper methods
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic phone number validation (US format)
    const phoneRegex = /^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Format to E.164 format for VAPI
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    } else {
      return phoneNumber; // Return as-is if format is unclear
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test VAPI API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('VAPI API key not configured');
      return false;
    }

    try {
      // Test with a simple API call (get account info or similar)
      const response = await axios.get(`${this.baseUrl}/account`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      return response.status === 200;
    } catch (error) {
      console.warn('VAPI API test failed:', error);
      return false;
    }
  }

  /**
   * Get account usage and limits
   */
  async getAccountInfo(): Promise<{ credits: number; callsThisMonth: number } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/account`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      return {
        credits: response.data.credits || 0,
        callsThisMonth: response.data.callsThisMonth || 0,
      };
    } catch (error) {
      console.warn('Failed to get VAPI account info:', error);
      return null;
    }
  }

  /**
   * Classify error type for recovery purposes
   */
  private classifyError(error: any): string {
    if (error.response?.status === 429 || error.message?.includes('rate limit')) {
      return 'RateLimitError';
    }
    if (error.code === 'ECONNRESET' || error.message?.includes('network')) {
      return 'NetworkError';
    }
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return 'TimeoutError';
    }
    if (error.response?.status === 401 || error.message?.includes('unauthorized')) {
      return 'AuthenticationError';
    }
    if (error.response?.status === 403 || error.message?.includes('forbidden')) {
      return 'AuthorizationError';
    }
    if (error.response?.status === 400 || error.message?.includes('invalid phone')) {
      return 'InvalidPhoneError';
    }
    if (error.response?.status >= 500) {
      return 'ServerError';
    }
    if (error.message?.includes('call failed') || error.message?.includes('no answer')) {
      return 'CallFailedError';
    }
    return 'UnknownError';
  }

  /**
   * Extract HTTP status code from error
   */
  private getErrorStatusCode(error: any): number {
    if (error.response?.status) return error.response.status;
    if (error.status) return error.status;
    if (error.message?.includes('rate limit')) return 429;
    if (error.message?.includes('timeout')) return 408;
    if (error.message?.includes('unauthorized')) return 401;
    if (error.message?.includes('forbidden')) return 403;
    if (error.message?.includes('invalid phone')) return 400;
    if (error.message?.includes('call failed')) return 502;
    return 500;
  }
}

// Export singleton instance
export const vapiInterviewService = new VAPIInterviewService();