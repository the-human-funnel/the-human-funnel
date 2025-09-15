"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAnalysisService = exports.AIAnalysisService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const config_1 = require("../utils/config");
const rateLimiting_1 = require("../middleware/rateLimiting");
const logger_1 = require("../utils/logger");
const monitoringService_1 = require("./monitoringService");
const errorRecoveryService_1 = require("./errorRecoveryService");
class AIAnalysisService {
    constructor() {
        this.geminiClient = new generative_ai_1.GoogleGenerativeAI(config_1.config.aiProviders.gemini.apiKey);
        this.openaiClient = new openai_1.default({
            apiKey: config_1.config.aiProviders.openai.apiKey,
        });
        this.claudeClient = new sdk_1.default({
            apiKey: config_1.config.aiProviders.claude.apiKey,
        });
        this.providerConfigs = [
            { name: 'gemini', maxRetries: 3, timeout: 30000 },
            { name: 'openai', maxRetries: 2, timeout: 30000 },
            { name: 'claude', maxRetries: 1, timeout: 30000 },
        ];
    }
    async analyzeResume(candidateId, resumeData, jobProfile) {
        const startTime = Date.now();
        const promptData = {
            resumeText: resumeData.extractedText,
            jobProfile,
        };
        let lastError = null;
        for (const providerConfig of this.providerConfigs) {
            const providerStartTime = Date.now();
            try {
                logger_1.logger.info(`Attempting AI analysis with ${providerConfig.name}`, {
                    service: 'aiAnalysis',
                    operation: 'analyzeResume',
                    candidateId,
                    provider: providerConfig.name,
                    jobProfileId: jobProfile.id
                });
                const result = await this.analyzeWithProvider(candidateId, promptData, providerConfig);
                const duration = Date.now() - providerStartTime;
                const totalDuration = Date.now() - startTime;
                monitoringService_1.monitoringService.recordApiUsage({
                    service: providerConfig.name,
                    endpoint: '/analyze',
                    method: 'POST',
                    statusCode: 200,
                    responseTime: duration
                });
                logger_1.logger.performance(`AI analysis with ${providerConfig.name}`, duration, true, {
                    service: 'aiAnalysis',
                    operation: 'analyzeResume',
                    candidateId,
                    provider: providerConfig.name,
                    jobProfileId: jobProfile.id,
                    totalDuration
                });
                logger_1.logger.info(`Successfully analyzed candidate with ${providerConfig.name}`, {
                    service: 'aiAnalysis',
                    operation: 'analyzeResume',
                    candidateId,
                    provider: providerConfig.name,
                    jobProfileId: jobProfile.id,
                    duration,
                    relevanceScore: result.relevanceScore
                });
                return result;
            }
            catch (error) {
                lastError = error;
                const duration = Date.now() - providerStartTime;
                const statusCode = this.getErrorStatusCode(error);
                monitoringService_1.monitoringService.recordApiUsage({
                    service: providerConfig.name,
                    endpoint: '/analyze',
                    method: 'POST',
                    statusCode,
                    responseTime: duration
                });
                const errorType = this.classifyError(error);
                errorRecoveryService_1.errorRecoveryService.recordFailure(providerConfig.name, 'analyze', errorType, error);
                logger_1.logger.error(`AI analysis failed with ${providerConfig.name}`, error, {
                    service: 'aiAnalysis',
                    operation: 'analyzeResume',
                    candidateId,
                    provider: providerConfig.name,
                    jobProfileId: jobProfile.id,
                    duration,
                    statusCode,
                    errorType
                });
                continue;
            }
        }
        const totalDuration = Date.now() - startTime;
        monitoringService_1.monitoringService.createAlert('error', 'aiAnalysis', `All AI providers failed for candidate analysis`, {
            candidateId,
            jobProfileId: jobProfile.id,
            totalDuration,
            lastError: lastError?.message,
            providersAttempted: this.providerConfigs.map(p => p.name)
        });
        throw new Error(`All AI providers failed for candidate ${candidateId}. Last error: ${lastError?.message}`);
    }
    async analyzeWithProvider(candidateId, promptData, providerConfig) {
        let lastError = null;
        for (let attempt = 1; attempt <= providerConfig.maxRetries; attempt++) {
            try {
                console.log(`Attempt ${attempt}/${providerConfig.maxRetries} with ${providerConfig.name} for candidate ${candidateId}`);
                const result = await Promise.race([
                    this.callProvider(candidateId, promptData, providerConfig.name),
                    this.createTimeoutPromise(providerConfig.timeout),
                ]);
                return result;
            }
            catch (error) {
                lastError = error;
                console.warn(`Attempt ${attempt} failed with ${providerConfig.name}:`, error);
                if (attempt < providerConfig.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new Error(`All retries failed for ${providerConfig.name}`);
    }
    async callProvider(candidateId, promptData, provider) {
        const prompt = this.buildAnalysisPrompt(promptData);
        switch (provider) {
            case 'gemini':
                return await this.analyzeWithGemini(candidateId, prompt);
            case 'openai':
                return await this.analyzeWithOpenAI(candidateId, prompt);
            case 'claude':
                return await this.analyzeWithClaude(candidateId, prompt);
            default:
                throw new Error(`Unknown AI provider: ${provider}`);
        }
    }
    async analyzeWithGemini(candidateId, prompt) {
        const limits = rateLimiting_1.EXTERNAL_API_LIMITS.gemini;
        if (!rateLimiting_1.externalAPILimiter.canMakeCall('gemini', limits.maxCalls, limits.windowMs)) {
            const resetTime = rateLimiting_1.externalAPILimiter.getResetTime('gemini');
            logger_1.logger.warn('Gemini API rate limit exceeded', { candidateId, resetTime });
            throw new Error(`Gemini API rate limit exceeded. Reset time: ${resetTime?.toISOString()}`);
        }
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return this.parseAIResponse(candidateId, text, 'gemini');
    }
    async analyzeWithOpenAI(candidateId, prompt) {
        const limits = rateLimiting_1.EXTERNAL_API_LIMITS.openai;
        if (!rateLimiting_1.externalAPILimiter.canMakeCall('openai', limits.maxCalls, limits.windowMs)) {
            const resetTime = rateLimiting_1.externalAPILimiter.getResetTime('openai');
            logger_1.logger.warn('OpenAI API rate limit exceeded', { candidateId, resetTime });
            throw new Error(`OpenAI API rate limit exceeded. Reset time: ${resetTime?.toISOString()}`);
        }
        const completion = await this.openaiClient.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert HR analyst specializing in resume evaluation and candidate assessment.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
            max_tokens: 2000,
        });
        const text = completion.choices[0]?.message?.content || '';
        return this.parseAIResponse(candidateId, text, 'openai');
    }
    async analyzeWithClaude(candidateId, prompt) {
        const limits = rateLimiting_1.EXTERNAL_API_LIMITS.claude;
        if (!rateLimiting_1.externalAPILimiter.canMakeCall('claude', limits.maxCalls, limits.windowMs)) {
            const resetTime = rateLimiting_1.externalAPILimiter.getResetTime('claude');
            logger_1.logger.warn('Claude API rate limit exceeded', { candidateId, resetTime });
            throw new Error(`Claude API rate limit exceeded. Reset time: ${resetTime?.toISOString()}`);
        }
        const message = await this.claudeClient.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 2000,
            temperature: 0.3,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });
        const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
        return this.parseAIResponse(candidateId, text, 'claude');
    }
    buildAnalysisPrompt(promptData) {
        const { resumeText, jobProfile } = promptData;
        return `
Please analyze the following resume against the job requirements and provide a structured assessment.

JOB PROFILE:
Title: ${jobProfile.title}
Description: ${jobProfile.description}
Required Skills: ${jobProfile.requiredSkills.join(', ')}
Experience Level: ${jobProfile.experienceLevel}

RESUME TEXT:
${resumeText}

Please provide your analysis in the following JSON format:
{
  "relevanceScore": <number between 0-100>,
  "skillsMatch": {
    "matched": ["skill1", "skill2", ...],
    "missing": ["skill3", "skill4", ...]
  },
  "experienceAssessment": "<detailed assessment of candidate's experience relevance>",
  "reasoning": "<detailed explanation of the score and assessment>",
  "confidence": <number between 0-100 indicating confidence in the analysis>
}

ANALYSIS GUIDELINES:
1. Relevance Score (0-100): Overall match between candidate and job requirements
2. Skills Match: Identify which required skills are demonstrated vs missing
3. Experience Assessment: Evaluate years of experience, role progression, and relevance
4. Reasoning: Provide clear justification for scores and recommendations
5. Confidence: Rate your confidence in the analysis based on resume quality and clarity

Focus on:
- Technical skills alignment
- Experience level appropriateness
- Industry/domain relevance
- Career progression indicators
- Education alignment (if specified)

Respond ONLY with the JSON object, no additional text.
`;
    }
    parseAIResponse(candidateId, responseText, provider) {
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            if (typeof parsed.relevanceScore !== 'number' ||
                !parsed.skillsMatch ||
                !Array.isArray(parsed.skillsMatch.matched) ||
                !Array.isArray(parsed.skillsMatch.missing) ||
                typeof parsed.experienceAssessment !== 'string' ||
                typeof parsed.reasoning !== 'string' ||
                typeof parsed.confidence !== 'number') {
                throw new Error('Invalid AI response structure');
            }
            const relevanceScore = Math.max(0, Math.min(100, parsed.relevanceScore));
            const confidence = Math.max(0, Math.min(100, parsed.confidence));
            return {
                candidateId,
                provider,
                relevanceScore,
                skillsMatch: {
                    matched: parsed.skillsMatch.matched,
                    missing: parsed.skillsMatch.missing,
                },
                experienceAssessment: parsed.experienceAssessment,
                reasoning: parsed.reasoning,
                confidence,
            };
        }
        catch (error) {
            console.error('Failed to parse AI response:', error);
            console.error('Response text:', responseText);
            return {
                candidateId,
                provider,
                relevanceScore: 0,
                skillsMatch: {
                    matched: [],
                    missing: [],
                },
                experienceAssessment: 'Failed to analyze resume due to parsing error',
                reasoning: `AI response parsing failed: ${error}`,
                confidence: 0,
            };
        }
    }
    createTimeoutPromise(timeout) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`AI analysis timeout after ${timeout}ms`));
            }, timeout);
        });
    }
    async testProviders() {
        const results = {
            gemini: false,
            openai: false,
            claude: false,
        };
        const testPrompt = 'Test connection. Respond with: {"status": "ok"}';
        try {
            const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
            await model.generateContent(testPrompt);
            results.gemini = true;
        }
        catch (error) {
            console.warn('Gemini test failed:', error);
        }
        try {
            await this.openaiClient.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: testPrompt }],
                max_tokens: 10,
            });
            results.openai = true;
        }
        catch (error) {
            console.warn('OpenAI test failed:', error);
        }
        try {
            await this.claudeClient.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 10,
                messages: [{ role: 'user', content: testPrompt }],
            });
            results.claude = true;
        }
        catch (error) {
            console.warn('Claude test failed:', error);
        }
        return results;
    }
    classifyError(error) {
        if (error.message?.includes('rate limit') || error.status === 429) {
            return 'RateLimitError';
        }
        if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
            return 'TimeoutError';
        }
        if (error.message?.includes('network') || error.code === 'ECONNRESET') {
            return 'NetworkError';
        }
        if (error.status === 401 || error.message?.includes('unauthorized')) {
            return 'AuthenticationError';
        }
        if (error.status === 403 || error.message?.includes('forbidden')) {
            return 'AuthorizationError';
        }
        if (error.status >= 500) {
            return 'ServerError';
        }
        return 'UnknownError';
    }
    getErrorStatusCode(error) {
        if (error.status)
            return error.status;
        if (error.response?.status)
            return error.response.status;
        if (error.message?.includes('rate limit'))
            return 429;
        if (error.message?.includes('timeout'))
            return 408;
        if (error.message?.includes('unauthorized'))
            return 401;
        if (error.message?.includes('forbidden'))
            return 403;
        return 500;
    }
}
exports.AIAnalysisService = AIAnalysisService;
exports.aiAnalysisService = new AIAnalysisService();
//# sourceMappingURL=aiAnalysisService.js.map