"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.vapiInterviewService = exports.VAPIInterviewService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const monitoringService_1 = require("./monitoringService");
const errorRecoveryService_1 = require("./errorRecoveryService");
class VAPIInterviewService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 5000;
        this.maxCallDuration = 1800;
        this.baseUrl = config_1.config.vapi.baseUrl;
        this.apiKey = config_1.config.vapi.apiKey;
        if (!this.apiKey) {
            console.warn('VAPI API key not configured. Interview functionality will be disabled.');
        }
    }
    async scheduleInterview(candidate, jobProfile, phoneNumber) {
        const startTime = Date.now();
        logger_1.logger.info(`Scheduling VAPI interview`, {
            service: 'vapiInterview',
            operation: 'scheduleInterview',
            candidateId: candidate.id,
            jobProfileId: jobProfile.id,
            phoneNumber: phoneNumber.substring(0, 6) + '***'
        });
        if (!this.apiKey) {
            const error = 'VAPI API key not configured';
            logger_1.logger.error(error, undefined, {
                service: 'vapiInterview',
                operation: 'scheduleInterview',
                candidateId: candidate.id
            });
            throw new Error(error);
        }
        if (!phoneNumber || !this.isValidPhoneNumber(phoneNumber)) {
            const error = 'Invalid or missing phone number';
            logger_1.logger.error(error, undefined, {
                service: 'vapiInterview',
                operation: 'scheduleInterview',
                candidateId: candidate.id,
                phoneNumber: phoneNumber.substring(0, 6) + '***'
            });
            throw new Error(error);
        }
        try {
            const interviewQuestions = this.generateInterviewQuestions(jobProfile, candidate);
            const callRequest = this.buildCallRequest(phoneNumber, jobProfile, interviewQuestions);
            const vapiCall = await this.initiateCall(callRequest);
            const interviewSession = {
                candidateId: candidate.id,
                jobProfileId: jobProfile.id,
                vapiCallId: vapiCall.id,
                scheduledAt: new Date(),
                status: 'scheduled',
                callQuality: 'good',
                retryCount: 0,
            };
            const duration = Date.now() - startTime;
            monitoringService_1.monitoringService.recordApiUsage({
                service: 'vapi',
                endpoint: '/call',
                method: 'POST',
                statusCode: 200,
                responseTime: duration
            });
            logger_1.logger.performance('VAPI interview scheduling', duration, true, {
                service: 'vapiInterview',
                operation: 'scheduleInterview',
                candidateId: candidate.id,
                jobProfileId: jobProfile.id,
                vapiCallId: vapiCall.id
            });
            logger_1.logger.info(`Successfully scheduled VAPI interview`, {
                service: 'vapiInterview',
                operation: 'scheduleInterview',
                candidateId: candidate.id,
                jobProfileId: jobProfile.id,
                vapiCallId: vapiCall.id,
                duration,
                questionsCount: interviewQuestions.length
            });
            return interviewSession;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const statusCode = this.getErrorStatusCode(error);
            const errorType = this.classifyError(error);
            monitoringService_1.monitoringService.recordApiUsage({
                service: 'vapi',
                endpoint: '/call',
                method: 'POST',
                statusCode,
                responseTime: duration
            });
            errorRecoveryService_1.errorRecoveryService.recordFailure('vapiInterview', 'scheduleCall', errorType, error);
            logger_1.logger.error(`Failed to schedule VAPI interview`, error, {
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
    async initiateCall(callRequest) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`VAPI call attempt ${attempt}/${this.maxRetries}`);
                const response = await axios_1.default.post(`${this.baseUrl}/call`, callRequest, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000,
                });
                if (!response.data || !response.data.id) {
                    throw new Error('Invalid response from VAPI service');
                }
                return response.data;
            }
            catch (error) {
                lastError = error;
                console.warn(`VAPI call attempt ${attempt} failed:`, error);
                if (axios_1.default.isAxiosError(error)) {
                    if (error.response?.status === 400) {
                        throw new Error(`Invalid call request: ${error.response.data?.message || 'Bad request'}`);
                    }
                    else if (error.response?.status === 401) {
                        throw new Error('VAPI API key is invalid or expired');
                    }
                    else if (error.response?.status === 429) {
                        console.warn('VAPI API rate limit exceeded, waiting before retry...');
                        await this.delay(this.retryDelay * attempt);
                        continue;
                    }
                    else if (error.response?.status === 402) {
                        throw new Error('Insufficient VAPI credits or payment required');
                    }
                }
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    await this.delay(delay);
                }
            }
        }
        throw lastError || new Error('All VAPI call attempts failed');
    }
    async getCallStatus(vapiCallId) {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/call/${vapiCallId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            return response.data;
        }
        catch (error) {
            console.error(`Failed to get VAPI call status for ${vapiCallId}:`, error);
            throw error;
        }
    }
    async updateInterviewSession(interviewSession, vapiCallData) {
        const updatedSession = { ...interviewSession };
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
    async retryInterview(interviewSession, candidate, jobProfile, phoneNumber) {
        console.log(`Retrying VAPI interview for candidate ${candidate.id}, attempt ${interviewSession.retryCount + 1}`);
        if (interviewSession.retryCount >= 2) {
            throw new Error('Maximum retry attempts reached for interview');
        }
        try {
            const interviewQuestions = this.generateInterviewQuestions(jobProfile, candidate);
            const callRequest = this.buildCallRequest(phoneNumber, jobProfile, interviewQuestions);
            const vapiCall = await this.initiateCall(callRequest);
            const updatedSession = {
                ...interviewSession,
                vapiCallId: vapiCall.id,
                scheduledAt: new Date(),
                status: 'scheduled',
                retryCount: interviewSession.retryCount + 1,
            };
            delete updatedSession.transcript;
            delete updatedSession.duration;
            console.log(`Successfully retried VAPI interview for candidate ${candidate.id}, new call ID: ${vapiCall.id}`);
            return updatedSession;
        }
        catch (error) {
            console.error(`Failed to retry VAPI interview for candidate ${candidate.id}:`, error);
            throw error;
        }
    }
    generateInterviewQuestions(jobProfile, candidate) {
        const questions = [];
        questions.push("Hello! Thank you for taking the time to speak with us today. Can you please introduce yourself and tell me about your current role?");
        if (jobProfile.interviewQuestions && jobProfile.interviewQuestions.length > 0) {
            questions.push(...jobProfile.interviewQuestions);
        }
        const skillQuestions = this.generateSkillQuestions(jobProfile.requiredSkills);
        questions.push(...skillQuestions);
        const experienceQuestions = this.generateExperienceQuestions(jobProfile.experienceLevel);
        questions.push(...experienceQuestions);
        if (candidate.aiAnalysis) {
            const backgroundQuestions = this.generateBackgroundQuestions(candidate.aiAnalysis);
            questions.push(...backgroundQuestions);
        }
        questions.push("Do you have any questions about the role or our company?");
        questions.push("Thank you for your time today. We'll be in touch soon with next steps.");
        return questions.slice(0, 8);
    }
    generateSkillQuestions(requiredSkills) {
        const questions = [];
        const skillTemplates = [
            "Can you describe your experience with {skill}?",
            "How have you used {skill} in your previous projects?",
            "What challenges have you faced when working with {skill}?",
            "Can you walk me through a project where {skill} was crucial?",
        ];
        const topSkills = requiredSkills.slice(0, 3);
        topSkills.forEach((skill, index) => {
            const template = skillTemplates[index % skillTemplates.length];
            if (template) {
                questions.push(template.replace('{skill}', skill));
            }
        });
        return questions;
    }
    generateExperienceQuestions(experienceLevel) {
        const level = experienceLevel.toLowerCase();
        if (level.includes('senior') || level.includes('lead')) {
            return [
                "Can you describe a time when you had to mentor junior team members?",
                "How do you approach technical decision-making in complex projects?",
            ];
        }
        else if (level.includes('mid') || level.includes('intermediate')) {
            return [
                "Describe a challenging project you've worked on and how you overcame obstacles.",
                "How do you stay updated with new technologies in your field?",
            ];
        }
        else {
            return [
                "What interests you most about this role and our company?",
                "Can you tell me about a project you're particularly proud of?",
            ];
        }
    }
    generateBackgroundQuestions(aiAnalysis) {
        const questions = [];
        if (aiAnalysis.skillsMatch?.missing?.length > 0) {
            const missingSkill = aiAnalysis.skillsMatch.missing[0];
            questions.push(`I noticed you might not have extensive experience with ${missingSkill}. How would you approach learning this technology?`);
        }
        if (aiAnalysis.experienceAssessment) {
            questions.push("Can you elaborate on the experience mentioned in your resume that you think is most relevant to this role?");
        }
        return questions;
    }
    buildCallRequest(phoneNumber, jobProfile, questions) {
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
                    voiceId: 'pNInz6obpgDQGcFmaJgB',
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
    buildSystemMessage(jobProfile, questions) {
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
    determineEndStatus(vapiCallData) {
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
                return 'completed';
            case 'phone-call-provider-closed-websocket':
            case 'assistant-not-responding':
            case 'failed':
                return 'failed';
            default:
                return 'completed';
        }
    }
    assessCallQuality(vapiCallData) {
        const duration = vapiCallData.duration || 0;
        const hasTranscript = Boolean(vapiCallData.transcript && vapiCallData.transcript.length > 100);
        if (duration >= 600 && hasTranscript) {
            return 'excellent';
        }
        else if (duration >= 300 && hasTranscript) {
            return 'good';
        }
        else if (duration >= 300) {
            return 'good';
        }
        else if (duration >= 120) {
            return 'good';
        }
        else {
            return 'poor';
        }
    }
    async processWebhook(payload) {
        try {
            const { message } = payload;
            const callId = message.call.id;
            console.log(`Processing VAPI webhook for call ${callId}, type: ${message.type}`);
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
        }
        catch (error) {
            console.error('Failed to process VAPI webhook:', error);
            throw error;
        }
    }
    async handleStatusUpdate(callData) {
        console.log(`Call ${callData.id} status updated to: ${callData.status}`);
    }
    async handleTranscriptUpdate(callData) {
        console.log(`Transcript updated for call ${callData.id}`);
    }
    async handleCallEnd(callData) {
        console.log(`Call ${callData.id} ended. Reason: ${callData.endedReason}, Duration: ${callData.duration}s`);
    }
    isValidPhoneNumber(phoneNumber) {
        const phoneRegex = /^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
        return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
    }
    formatPhoneNumber(phoneNumber) {
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `+1${cleaned}`;
        }
        else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return `+${cleaned}`;
        }
        else {
            return phoneNumber;
        }
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async testConnection() {
        if (!this.apiKey) {
            console.warn('VAPI API key not configured');
            return false;
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/account`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            return response.status === 200;
        }
        catch (error) {
            console.warn('VAPI API test failed:', error);
            return false;
        }
    }
    async getAccountInfo() {
        if (!this.apiKey) {
            return null;
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/account`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            return {
                credits: response.data.credits || 0,
                callsThisMonth: response.data.callsThisMonth || 0,
            };
        }
        catch (error) {
            console.warn('Failed to get VAPI account info:', error);
            return null;
        }
    }
    classifyError(error) {
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
    getErrorStatusCode(error) {
        if (error.response?.status)
            return error.response.status;
        if (error.status)
            return error.status;
        if (error.message?.includes('rate limit'))
            return 429;
        if (error.message?.includes('timeout'))
            return 408;
        if (error.message?.includes('unauthorized'))
            return 401;
        if (error.message?.includes('forbidden'))
            return 403;
        if (error.message?.includes('invalid phone'))
            return 400;
        if (error.message?.includes('call failed'))
            return 502;
        return 500;
    }
}
exports.VAPIInterviewService = VAPIInterviewService;
exports.vapiInterviewService = new VAPIInterviewService();
//# sourceMappingURL=vapiInterviewService.js.map