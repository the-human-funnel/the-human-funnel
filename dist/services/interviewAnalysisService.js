"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.interviewAnalysisService = exports.InterviewAnalysisService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const openai_1 = __importDefault(require("openai"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const config_1 = require("../utils/config");
class InterviewAnalysisService {
    constructor() {
        this.geminiClient = new generative_ai_1.GoogleGenerativeAI(config_1.config.aiProviders.gemini.apiKey);
        this.openaiClient = new openai_1.default({
            apiKey: config_1.config.aiProviders.openai.apiKey,
        });
        this.claudeClient = new sdk_1.default({
            apiKey: config_1.config.aiProviders.claude.apiKey,
        });
        this.providerConfigs = [
            { name: 'gemini', maxRetries: 3, timeout: 45000 },
            { name: 'openai', maxRetries: 2, timeout: 45000 },
            { name: 'claude', maxRetries: 1, timeout: 45000 },
        ];
    }
    async analyzeTranscript(candidateId, interviewSession, jobProfile) {
        if (!interviewSession.transcript) {
            throw new Error('No transcript available for analysis');
        }
        const transcriptQuality = this.assessTranscriptQuality(interviewSession.transcript);
        const analysisData = {
            transcript: interviewSession.transcript,
            jobProfile,
            interviewSession,
        };
        let lastError = null;
        for (const providerConfig of this.providerConfigs) {
            try {
                console.log(`Attempting interview analysis with ${providerConfig.name} for candidate ${candidateId}`);
                const result = await this.analyzeWithProvider(candidateId, analysisData, providerConfig, transcriptQuality);
                console.log(`Successfully analyzed interview for candidate ${candidateId} with ${providerConfig.name}`);
                return result;
            }
            catch (error) {
                lastError = error;
                console.warn(`Interview analysis failed with ${providerConfig.name} for candidate ${candidateId}:`, error);
                continue;
            }
        }
        throw new Error(`All AI providers failed for interview analysis of candidate ${candidateId}. Last error: ${lastError?.message}`);
    }
    async analyzeWithProvider(candidateId, analysisData, providerConfig, transcriptQuality) {
        let lastError = null;
        for (let attempt = 1; attempt <= providerConfig.maxRetries; attempt++) {
            try {
                console.log(`Attempt ${attempt}/${providerConfig.maxRetries} with ${providerConfig.name} for candidate ${candidateId}`);
                const result = await Promise.race([
                    this.callProvider(candidateId, analysisData, providerConfig.name, transcriptQuality),
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
    async callProvider(candidateId, analysisData, provider, transcriptQuality) {
        const prompt = this.buildAnalysisPrompt(analysisData);
        switch (provider) {
            case 'gemini':
                return await this.analyzeWithGemini(candidateId, analysisData, prompt, transcriptQuality);
            case 'openai':
                return await this.analyzeWithOpenAI(candidateId, analysisData, prompt, transcriptQuality);
            case 'claude':
                return await this.analyzeWithClaude(candidateId, analysisData, prompt, transcriptQuality);
            default:
                throw new Error(`Unknown AI provider: ${provider}`);
        }
    }
    async analyzeWithGemini(candidateId, analysisData, prompt, transcriptQuality) {
        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return this.parseAIResponse(candidateId, analysisData, text, 'gemini', transcriptQuality);
    }
    async analyzeWithOpenAI(candidateId, analysisData, prompt, transcriptQuality) {
        const completion = await this.openaiClient.chat.completions.create({
            model: 'gpt-4',
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert HR analyst specializing in interview evaluation and candidate assessment. You analyze interview transcripts to evaluate candidates against job requirements.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.3,
            max_tokens: 3000,
        });
        const text = completion.choices[0]?.message?.content || '';
        return this.parseAIResponse(candidateId, analysisData, text, 'openai', transcriptQuality);
    }
    async analyzeWithClaude(candidateId, analysisData, prompt, transcriptQuality) {
        const message = await this.claudeClient.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 3000,
            temperature: 0.3,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });
        const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
        return this.parseAIResponse(candidateId, analysisData, text, 'claude', transcriptQuality);
    }
    buildAnalysisPrompt(analysisData) {
        const { transcript, jobProfile, interviewSession } = analysisData;
        return `
INTERVIEW TRANSCRIPT ANALYSIS REQUEST

JOB PROFILE:
- Title: ${jobProfile.title}
- Required Skills: ${jobProfile.requiredSkills.join(', ')}
- Experience Level: ${jobProfile.experienceLevel}
- Description: ${jobProfile.description}

INTERVIEW DETAILS:
- Duration: ${interviewSession.duration ? `${Math.round(interviewSession.duration / 60)} minutes` : 'Unknown'}
- Call Quality: ${interviewSession.callQuality}
- Interview Questions: ${jobProfile.interviewQuestions.join('\n')}

TRANSCRIPT:
${transcript}

ANALYSIS REQUIREMENTS:
Please analyze this interview transcript and provide a comprehensive evaluation in the following JSON format:

{
  "performanceScore": [0-100 overall interview performance],
  "communicationScore": [0-100 communication clarity and professionalism],
  "technicalScore": [0-100 technical knowledge and competency],
  "competencyScores": {
    [For each required skill, provide a score 0-100]
  },
  "needsManualReview": [true/false - flag if transcript quality is poor or responses are unclear],
  "detailedFeedback": {
    "strengths": ["List of candidate strengths observed"],
    "weaknesses": ["List of areas for improvement"],
    "recommendations": ["Specific recommendations for hiring decision"]
  },
  "responseAnalysis": [
    {
      "question": "Question asked",
      "response": "Candidate's response summary",
      "score": [0-100],
      "feedback": "Specific feedback on this response"
    }
  ],
  "overallAssessment": "Comprehensive summary of the candidate's interview performance",
  "confidence": [0-100 confidence in this analysis based on transcript quality and response clarity]
}

EVALUATION CRITERIA:
1. Technical Accuracy: How well does the candidate demonstrate knowledge of required skills?
2. Communication Skills: Clarity, professionalism, and ability to articulate thoughts
3. Problem-Solving: Approach to challenges and technical questions
4. Experience Relevance: How well their experience aligns with job requirements
5. Cultural Fit: Professional demeanor and communication style
6. Response Quality: Depth and thoughtfulness of answers

SCORING GUIDELINES:
- 90-100: Exceptional performance, strong hire recommendation
- 80-89: Good performance, hire recommendation
- 70-79: Adequate performance, maybe hire
- 60-69: Below expectations, likely no hire
- 0-59: Poor performance, no hire

Please ensure your response is valid JSON format and includes all required fields.
`;
    }
    parseAIResponse(candidateId, analysisData, aiResponse, provider, transcriptQuality) {
        try {
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in AI response');
            }
            const parsedResponse = JSON.parse(jsonMatch[0]);
            const result = {
                candidateId,
                interviewSessionId: analysisData.interviewSession.vapiCallId,
                provider,
                performanceScore: this.validateScore(parsedResponse.performanceScore),
                communicationScore: this.validateScore(parsedResponse.communicationScore),
                technicalScore: this.validateScore(parsedResponse.technicalScore),
                competencyScores: this.validateCompetencyScores(parsedResponse.competencyScores, analysisData.jobProfile.requiredSkills),
                transcriptQuality,
                needsManualReview: Boolean(parsedResponse.needsManualReview) || transcriptQuality === 'poor',
                detailedFeedback: {
                    strengths: Array.isArray(parsedResponse.detailedFeedback?.strengths)
                        ? parsedResponse.detailedFeedback.strengths
                        : ['Analysis could not identify specific strengths'],
                    weaknesses: Array.isArray(parsedResponse.detailedFeedback?.weaknesses)
                        ? parsedResponse.detailedFeedback.weaknesses
                        : ['Analysis could not identify specific weaknesses'],
                    recommendations: Array.isArray(parsedResponse.detailedFeedback?.recommendations)
                        ? parsedResponse.detailedFeedback.recommendations
                        : ['Manual review recommended'],
                },
                responseAnalysis: Array.isArray(parsedResponse.responseAnalysis)
                    ? parsedResponse.responseAnalysis.map((item) => ({
                        question: String(item.question || 'Unknown question'),
                        response: String(item.response || 'No response captured'),
                        score: this.validateScore(item.score),
                        feedback: String(item.feedback || 'No feedback available'),
                    }))
                    : [],
                overallAssessment: String(parsedResponse.overallAssessment || 'Analysis incomplete - manual review required'),
                confidence: this.validateScore(parsedResponse.confidence),
                analysisTimestamp: new Date(),
            };
            if (transcriptQuality === 'poor') {
                result.confidence = Math.min(result.confidence, 40);
                result.needsManualReview = true;
            }
            else if (transcriptQuality === 'good') {
                result.confidence = Math.min(result.confidence, 85);
            }
            return result;
        }
        catch (error) {
            console.error('Failed to parse AI response:', error);
            return this.createFallbackResult(candidateId, analysisData, provider, transcriptQuality, aiResponse);
        }
    }
    createFallbackResult(candidateId, analysisData, provider, transcriptQuality, rawResponse) {
        return {
            candidateId,
            interviewSessionId: analysisData.interviewSession.vapiCallId,
            provider,
            performanceScore: 50,
            communicationScore: 50,
            technicalScore: 50,
            competencyScores: analysisData.jobProfile.requiredSkills.reduce((acc, skill) => {
                acc[skill] = 50;
                return acc;
            }, {}),
            transcriptQuality,
            needsManualReview: true,
            detailedFeedback: {
                strengths: ['AI analysis failed - manual review required'],
                weaknesses: ['Unable to assess due to analysis failure'],
                recommendations: ['Conduct manual review of interview transcript'],
            },
            responseAnalysis: [],
            overallAssessment: `AI analysis failed with ${provider}. Raw response available for manual review. Transcript quality: ${transcriptQuality}`,
            confidence: 0,
            analysisTimestamp: new Date(),
        };
    }
    assessTranscriptQuality(transcript) {
        if (!transcript || transcript.trim().length < 100) {
            return 'poor';
        }
        const wordCount = transcript.split(/\s+/).length;
        const hasDialogue = transcript.includes(':') || transcript.includes('Interviewer') || transcript.includes('Candidate');
        const hasQuestionMarkers = /\?/.test(transcript);
        const coherenceScore = this.assessCoherence(transcript);
        if (wordCount >= 500 && hasDialogue && hasQuestionMarkers && coherenceScore >= 0.8) {
            return 'excellent';
        }
        if (wordCount >= 200 && (hasDialogue || hasQuestionMarkers) && coherenceScore >= 0.6) {
            return 'good';
        }
        return 'poor';
    }
    assessCoherence(transcript) {
        const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 10);
        if (sentences.length === 0)
            return 0;
        const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
        const hasReasonableLength = avgSentenceLength >= 5 && avgSentenceLength <= 50;
        const hasConversationFlow = /\b(yes|no|well|so|actually|I think|in my experience)\b/i.test(transcript);
        let score = 0.5;
        if (hasReasonableLength)
            score += 0.3;
        if (hasConversationFlow)
            score += 0.2;
        return Math.min(score, 1.0);
    }
    validateScore(score) {
        if (score === null || score === undefined || score === '')
            return 50;
        const numScore = Number(score);
        if (isNaN(numScore))
            return 50;
        return Math.max(0, Math.min(100, Math.round(numScore)));
    }
    validateCompetencyScores(scores, requiredSkills) {
        const result = {};
        for (const skill of requiredSkills) {
            if (scores && typeof scores[skill] === 'number') {
                result[skill] = this.validateScore(scores[skill]);
            }
            else {
                result[skill] = 50;
            }
        }
        return result;
    }
    createTimeoutPromise(timeout) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Analysis timeout after ${timeout}ms`));
            }, timeout);
        });
    }
    async batchAnalyzeTranscripts(analysisRequests) {
        console.log(`Starting batch analysis of ${analysisRequests.length} interview transcripts`);
        const results = await Promise.allSettled(analysisRequests.map(async (request) => {
            try {
                const result = await this.analyzeTranscript(request.candidateId, request.interviewSession, request.jobProfile);
                return { candidateId: request.candidateId, result };
            }
            catch (error) {
                return {
                    candidateId: request.candidateId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
            }
        }));
        return results.map((result) => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            else {
                return {
                    candidateId: 'unknown',
                    error: result.reason?.message || 'Analysis failed'
                };
            }
        });
    }
    async testProviders() {
        const results = {};
        for (const providerConfig of this.providerConfigs) {
            try {
                const testPrompt = 'Test connection. Please respond with "OK".';
                switch (providerConfig.name) {
                    case 'gemini':
                        const geminiModel = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
                        await geminiModel.generateContent(testPrompt);
                        results[providerConfig.name] = true;
                        break;
                    case 'openai':
                        await this.openaiClient.chat.completions.create({
                            model: 'gpt-4',
                            messages: [{ role: 'user', content: testPrompt }],
                            max_tokens: 10,
                        });
                        results[providerConfig.name] = true;
                        break;
                    case 'claude':
                        await this.claudeClient.messages.create({
                            model: 'claude-3-sonnet-20240229',
                            max_tokens: 10,
                            messages: [{ role: 'user', content: testPrompt }],
                        });
                        results[providerConfig.name] = true;
                        break;
                }
            }
            catch (error) {
                console.warn(`Provider ${providerConfig.name} test failed:`, error);
                results[providerConfig.name] = false;
            }
        }
        return results;
    }
}
exports.InterviewAnalysisService = InterviewAnalysisService;
exports.interviewAnalysisService = new InterviewAnalysisService();
//# sourceMappingURL=interviewAnalysisService.js.map