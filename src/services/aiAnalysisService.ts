import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../utils/config';
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

export class AIAnalysisService {
  private geminiClient: GoogleGenerativeAI;
  private openaiClient: OpenAI;
  private claudeClient: Anthropic;
  private providerConfigs: AIProviderConfig[];

  constructor() {
    // Initialize AI clients
    this.geminiClient = new GoogleGenerativeAI(config.aiProviders.gemini.apiKey);
    this.openaiClient = new OpenAI({
      apiKey: config.aiProviders.openai.apiKey,
    });
    this.claudeClient = new Anthropic({
      apiKey: config.aiProviders.claude.apiKey,
    });

    // Configure provider fallback order with retry counts
    this.providerConfigs = [
      { name: 'gemini', maxRetries: 3, timeout: 30000 },
      { name: 'openai', maxRetries: 2, timeout: 30000 },
      { name: 'claude', maxRetries: 1, timeout: 30000 },
    ];
  }

  /**
   * Analyze a resume against a job profile using AI providers with fallback
   */
  async analyzeResume(
    candidateId: string,
    resumeData: ResumeData,
    jobProfile: JobProfile
  ): Promise<AIAnalysisResult> {
    const promptData: AnalysisPromptData = {
      resumeText: resumeData.extractedText,
      jobProfile,
    };

    let lastError: Error | null = null;

    // Try each provider in order with retries
    for (const providerConfig of this.providerConfigs) {
      try {
        console.log(`Attempting AI analysis with ${providerConfig.name} for candidate ${candidateId}`);
        
        const result = await this.analyzeWithProvider(
          candidateId,
          promptData,
          providerConfig
        );
        
        console.log(`Successfully analyzed candidate ${candidateId} with ${providerConfig.name}`);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `AI analysis failed with ${providerConfig.name} for candidate ${candidateId}:`,
          error
        );
        
        // Continue to next provider
        continue;
      }
    }

    // If all providers failed, throw the last error
    throw new Error(
      `All AI providers failed for candidate ${candidateId}. Last error: ${lastError?.message}`
    );
  }

  /**
   * Analyze with a specific provider with retry logic
   */
  private async analyzeWithProvider(
    candidateId: string,
    promptData: AnalysisPromptData,
    providerConfig: AIProviderConfig
  ): Promise<AIAnalysisResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= providerConfig.maxRetries; attempt++) {
      try {
        console.log(
          `Attempt ${attempt}/${providerConfig.maxRetries} with ${providerConfig.name} for candidate ${candidateId}`
        );

        const result = await Promise.race([
          this.callProvider(candidateId, promptData, providerConfig.name),
          this.createTimeoutPromise(providerConfig.timeout),
        ]);

        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `Attempt ${attempt} failed with ${providerConfig.name}:`,
          error
        );

        // Wait before retry (exponential backoff)
        if (attempt < providerConfig.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`All retries failed for ${providerConfig.name}`);
  }

  /**
   * Call the specific AI provider
   */
  private async callProvider(
    candidateId: string,
    promptData: AnalysisPromptData,
    provider: AIProvider
  ): Promise<AIAnalysisResult> {
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

  /**
   * Analyze using Gemini API
   */
  private async analyzeWithGemini(
    candidateId: string,
    prompt: string
  ): Promise<AIAnalysisResult> {
    const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return this.parseAIResponse(candidateId, text, 'gemini');
  }

  /**
   * Analyze using OpenAI GPT API
   */
  private async analyzeWithOpenAI(
    candidateId: string,
    prompt: string
  ): Promise<AIAnalysisResult> {
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

  /**
   * Analyze using Claude API
   */
  private async analyzeWithClaude(
    candidateId: string,
    prompt: string
  ): Promise<AIAnalysisResult> {
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

  /**
   * Build structured prompt for AI analysis
   */
  private buildAnalysisPrompt(promptData: AnalysisPromptData): string {
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

  /**
   * Parse AI response into structured result
   */
  private parseAIResponse(
    candidateId: string,
    responseText: string,
    provider: AIProvider
  ): AIAnalysisResult {
    try {
      // Clean the response text to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (
        typeof parsed.relevanceScore !== 'number' ||
        !parsed.skillsMatch ||
        !Array.isArray(parsed.skillsMatch.matched) ||
        !Array.isArray(parsed.skillsMatch.missing) ||
        typeof parsed.experienceAssessment !== 'string' ||
        typeof parsed.reasoning !== 'string' ||
        typeof parsed.confidence !== 'number'
      ) {
        throw new Error('Invalid AI response structure');
      }

      // Ensure scores are within valid ranges
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
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Response text:', responseText);
      
      // Return a fallback result with low confidence
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

  /**
   * Create a timeout promise for provider calls
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`AI analysis timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Test AI provider connectivity
   */
  async testProviders(): Promise<Record<AIProvider, boolean>> {
    const results: Record<AIProvider, boolean> = {
      gemini: false,
      openai: false,
      claude: false,
    };

    const testPrompt = 'Test connection. Respond with: {"status": "ok"}';

    // Test Gemini
    try {
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent(testPrompt);
      results.gemini = true;
    } catch (error) {
      console.warn('Gemini test failed:', error);
    }

    // Test OpenAI
    try {
      await this.openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 10,
      });
      results.openai = true;
    } catch (error) {
      console.warn('OpenAI test failed:', error);
    }

    // Test Claude
    try {
      await this.claudeClient.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: testPrompt }],
      });
      results.claude = true;
    } catch (error) {
      console.warn('Claude test failed:', error);
    }

    return results;
  }
}

// Export singleton instance
export const aiAnalysisService = new AIAnalysisService();