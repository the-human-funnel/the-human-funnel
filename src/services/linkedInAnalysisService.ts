import axios, { AxiosResponse } from 'axios';
import { config } from '../utils/config';
import { LinkedInAnalysis, JobProfile } from '../models/interfaces';
import { logger } from '../utils/logger';
import { monitoringService } from './monitoringService';
import { errorRecoveryService } from './errorRecoveryService';

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

export class LinkedInAnalysisService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 2000; // 2 seconds

  constructor() {
    this.baseUrl = config.linkedIn.baseUrl;
    this.apiKey = config.linkedIn.scraperApiKey;

    if (!this.apiKey) {
      console.warn('LinkedIn scraper API key not configured. LinkedIn analysis will be disabled.');
    }
  }

  /**
   * Analyze a LinkedIn profile for a candidate
   */
  async analyzeLinkedInProfile(
    candidateId: string,
    linkedInUrl: string,
    jobProfile: JobProfile
  ): Promise<LinkedInAnalysis> {
    const startTime = Date.now();
    
    logger.info(`Starting LinkedIn analysis`, {
      service: 'linkedInAnalysis',
      operation: 'analyzeLinkedInProfile',
      candidateId,
      jobProfileId: jobProfile.id,
      linkedInUrl: linkedInUrl.substring(0, 50) + '...' // Truncate for privacy
    });

    if (!this.apiKey) {
      const error = 'LinkedIn scraper API key not configured';
      logger.error(error, undefined, {
        service: 'linkedInAnalysis',
        operation: 'analyzeLinkedInProfile',
        candidateId
      });
      return this.createFailedAnalysis(candidateId, error);
    }

    if (!linkedInUrl || !this.isValidLinkedInUrl(linkedInUrl)) {
      const error = 'Invalid or missing LinkedIn URL';
      logger.warn(error, {
        service: 'linkedInAnalysis',
        operation: 'analyzeLinkedInProfile',
        candidateId,
        linkedInUrl
      });
      return this.createFailedAnalysis(candidateId, error);
    }

    try {
      const profileData = await this.scrapeLinkedInProfile(linkedInUrl);
      
      if (!profileData) {
        const error = 'Failed to retrieve LinkedIn profile data';
        logger.error(error, undefined, {
          service: 'linkedInAnalysis',
          operation: 'analyzeLinkedInProfile',
          candidateId,
          linkedInUrl
        });
        return this.createFailedAnalysis(candidateId, error);
      }

      const analysis = this.analyzeProfileData(candidateId, profileData, jobProfile);
      const duration = Date.now() - startTime;
      
      // Record successful analysis
      monitoringService.recordApiUsage({
        service: 'linkedin',
        endpoint: '/profile',
        method: 'POST',
        statusCode: 200,
        responseTime: duration
      });
      
      logger.performance('LinkedIn profile analysis', duration, true, {
        service: 'linkedInAnalysis',
        operation: 'analyzeLinkedInProfile',
        candidateId,
        jobProfileId: jobProfile.id,
        professionalScore: analysis.professionalScore
      });
      
      logger.info(`Successfully analyzed LinkedIn profile`, {
        service: 'linkedInAnalysis',
        operation: 'analyzeLinkedInProfile',
        candidateId,
        jobProfileId: jobProfile.id,
        duration,
        professionalScore: analysis.professionalScore,
        profileAccessible: analysis.profileAccessible
      });
      
      return analysis;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = this.getErrorStatusCode(error);
      const errorType = this.classifyError(error);
      
      // Record failed API usage
      monitoringService.recordApiUsage({
        service: 'linkedin',
        endpoint: '/profile',
        method: 'POST',
        statusCode,
        responseTime: duration
      });
      
      // Record failure for error recovery
      errorRecoveryService.recordFailure(
        'linkedInAnalysis',
        'scrapeProfile',
        errorType,
        error
      );
      
      logger.error(`LinkedIn analysis failed`, error, {
        service: 'linkedInAnalysis',
        operation: 'analyzeLinkedInProfile',
        candidateId,
        jobProfileId: jobProfile.id,
        duration,
        statusCode,
        errorType,
        linkedInUrl
      });
      
      if (error instanceof Error) {
        return this.createFailedAnalysis(candidateId, error.message);
      }
      
      return this.createFailedAnalysis(candidateId, 'Unknown error during LinkedIn analysis');
    }
  }

  /**
   * Scrape LinkedIn profile using third-party API
   */
  private async scrapeLinkedInProfile(linkedInUrl: string): Promise<LinkedInProfileData | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        logger.debug(`LinkedIn scraping attempt ${attempt}/${this.maxRetries}`, {
          service: 'linkedInAnalysis',
          operation: 'scrapeLinkedInProfile',
          attempt,
          maxRetries: this.maxRetries,
          linkedInUrl: linkedInUrl.substring(0, 50) + '...'
        });

        const response: AxiosResponse<LinkedInScraperResponse> = await axios.post(
          `${this.baseUrl}/v1/profile`,
          {
            url: linkedInUrl,
            include_skills: true,
            include_experience: true,
            include_education: true,
            include_endorsements: true,
            include_recommendations: true,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'JobFilteringFunnel/1.0',
            },
            timeout: 30000, // 30 second timeout
          }
        );

        const result = response.data;

        if (!result.success) {
          throw new Error(result.error || result.message || 'LinkedIn scraping failed');
        }

        if (!result.data) {
          throw new Error('No profile data returned from LinkedIn scraper');
        }

        // Check rate limits
        if (result.rateLimitRemaining !== undefined && result.rateLimitRemaining < 10) {
          console.warn(`LinkedIn API rate limit low: ${result.rateLimitRemaining} requests remaining`);
        }

        return result.data;
      } catch (error) {
        lastError = error as Error;
        console.warn(`LinkedIn scraping attempt ${attempt} failed:`, error);

        // Handle specific error types
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            throw new Error('LinkedIn profile not found or is private');
          } else if (error.response?.status === 429) {
            console.warn('LinkedIn API rate limit exceeded, waiting before retry...');
            await this.delay(this.retryDelay * attempt);
            continue;
          } else if (error.response?.status === 403) {
            throw new Error('LinkedIn profile is private or access denied');
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('All LinkedIn scraping attempts failed');
  }

  /**
   * Analyze scraped profile data and generate professional score
   */
  private analyzeProfileData(
    candidateId: string,
    profileData: LinkedInProfileData,
    jobProfile: JobProfile
  ): LinkedInAnalysis {
    const experience = this.analyzeExperience(profileData, jobProfile);
    const network = this.analyzeNetwork(profileData);
    const credibilityIndicators = this.assessCredibility(profileData, jobProfile);
    
    // Calculate professional score based on multiple factors
    const professionalScore = this.calculateProfessionalScore(
      profileData,
      experience,
      network,
      credibilityIndicators
    );

    return {
      candidateId,
      profileAccessible: true,
      professionalScore,
      experience,
      network,
      credibilityIndicators,
    };
  }

  /**
   * Analyze professional experience against job requirements
   */
  private analyzeExperience(
    profileData: LinkedInProfileData,
    jobProfile: JobProfile
  ): LinkedInAnalysis['experience'] {
    const experiences = profileData.experience || [];
    
    // Calculate total years of experience
    let totalYears = 0;
    let relevantRoles = 0;
    const companyQualities: string[] = [];

    for (const exp of experiences) {
      // Estimate duration in years (simplified calculation)
      const duration = this.parseDuration(exp.duration);
      totalYears += duration;

      // Check if role is relevant to job requirements
      if (this.isRelevantRole(exp, jobProfile)) {
        relevantRoles++;
      }

      // Assess company quality based on title and description
      const quality = this.assessCompanyQuality(exp);
      if (quality) {
        companyQualities.push(quality);
      }
    }

    // Determine overall company quality
    const companyQuality = this.determineOverallCompanyQuality(companyQualities);

    return {
      totalYears: Math.round(totalYears * 10) / 10, // Round to 1 decimal place
      relevantRoles,
      companyQuality,
    };
  }

  /**
   * Analyze professional network metrics
   */
  private analyzeNetwork(profileData: LinkedInProfileData): LinkedInAnalysis['network'] {
    const connections = profileData.profile?.connections || 0;
    
    // Count total endorsements
    let totalEndorsements = 0;
    if (profileData.endorsements) {
      totalEndorsements = profileData.endorsements.reduce((sum, endorsement) => {
        return sum + (endorsement.count || 0);
      }, 0);
    } else if (profileData.skills) {
      totalEndorsements = profileData.skills.reduce((sum, skill) => {
        return sum + (skill.endorsements || 0);
      }, 0);
    }

    return {
      connections,
      endorsements: totalEndorsements,
    };
  }

  /**
   * Assess professional credibility indicators
   */
  private assessCredibility(
    profileData: LinkedInProfileData,
    jobProfile: JobProfile
  ): string[] {
    const indicators: string[] = [];

    // Check profile completeness
    if (profileData.profile?.headline) {
      indicators.push('Complete professional headline');
    }
    
    if (profileData.profile?.summary) {
      indicators.push('Detailed professional summary');
    }

    // Check experience quality
    const experiences = profileData.experience || [];
    if (experiences.length >= 3) {
      indicators.push('Extensive work history');
    }

    if (experiences.some(exp => exp.description && exp.description.length > 100)) {
      indicators.push('Detailed role descriptions');
    }

    // Check education
    if (profileData.education && profileData.education.length > 0) {
      indicators.push('Educational background provided');
    }

    // Check skills alignment
    if (profileData.skills) {
      const matchedSkills = this.getMatchedSkills(profileData.skills, jobProfile.requiredSkills);
      if (matchedSkills.length > 0) {
        indicators.push(`${matchedSkills.length} relevant skills listed`);
      }
    }

    // Check endorsements
    const totalEndorsements = profileData.endorsements?.reduce((sum, e) => sum + e.count, 0) || 0;
    if (totalEndorsements >= 10) {
      indicators.push('Well-endorsed by peers');
    }

    // Check recommendations
    if (profileData.recommendations && profileData.recommendations.length > 0) {
      indicators.push('Professional recommendations received');
    }

    // Check network size
    const connections = profileData.profile?.connections || 0;
    if (connections >= 500) {
      indicators.push('Extensive professional network');
    } else if (connections >= 100) {
      indicators.push('Active professional network');
    }

    return indicators;
  }

  /**
   * Calculate overall professional score (0-100)
   */
  private calculateProfessionalScore(
    profileData: LinkedInProfileData,
    experience: LinkedInAnalysis['experience'],
    network: LinkedInAnalysis['network'],
    credibilityIndicators: string[]
  ): number {
    let score = 0;

    // Experience scoring (40% of total)
    const experienceScore = Math.min(40, (experience.totalYears / 10) * 20 + experience.relevantRoles * 5);
    score += experienceScore;

    // Network scoring (20% of total)
    const connectionScore = Math.min(10, (network.connections / 500) * 10);
    const endorsementScore = Math.min(10, (network.endorsements / 50) * 10);
    score += connectionScore + endorsementScore;

    // Profile completeness scoring (25% of total)
    const completenessScore = Math.min(25, credibilityIndicators.length * 3);
    score += completenessScore;

    // Company quality bonus (15% of total)
    const companyQualityScore = this.getCompanyQualityScore(experience.companyQuality);
    score += companyQualityScore;

    return Math.min(100, Math.round(score));
  }

  /**
   * Helper methods
   */
  private isValidLinkedInUrl(url: string): boolean {
    const linkedInRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;
    return linkedInRegex.test(url);
  }

  private parseDuration(duration: string): number {
    if (!duration) return 0;

    // Simple duration parsing (e.g., "2 yrs 3 mos", "1 year", "6 months")
    const yearMatch = duration.match(/(\d+)\s*(year|yr)/i);
    const monthMatch = duration.match(/(\d+)\s*(month|mo)/i);

    let years = 0;
    if (yearMatch && yearMatch[1]) {
      years += parseInt(yearMatch[1], 10);
    }
    if (monthMatch && monthMatch[1]) {
      years += parseInt(monthMatch[1], 10) / 12;
    }

    return years || 0.5; // Default to 6 months if no duration found
  }

  private isRelevantRole(experience: any, jobProfile: JobProfile): boolean {
    const title = (experience.title || '').toLowerCase();
    const description = (experience.description || '').toLowerCase();
    const jobTitle = jobProfile.title.toLowerCase();
    const requiredSkills = jobProfile.requiredSkills.map(skill => skill.toLowerCase());

    // Check if job title contains similar keywords
    const titleWords = jobTitle.split(' ');
    const hasRelevantTitle = titleWords.some(word => 
      word.length > 3 && title.includes(word)
    );

    // Check if description mentions required skills
    const hasRelevantSkills = requiredSkills.some(skill => 
      title.includes(skill) || description.includes(skill)
    );

    return hasRelevantTitle || hasRelevantSkills;
  }

  private assessCompanyQuality(experience: any): string {
    const company = (experience.company || '').toLowerCase();
    
    // Simple company quality assessment based on common indicators
    const topTierCompanies = ['google', 'microsoft', 'apple', 'amazon', 'meta', 'netflix', 'tesla'];
    const techCompanies = ['startup', 'tech', 'software', 'digital', 'innovation'];
    
    if (topTierCompanies.some(name => company.includes(name))) {
      return 'top-tier';
    }
    
    if (techCompanies.some(keyword => company.includes(keyword))) {
      return 'tech-focused';
    }
    
    return 'standard';
  }

  private determineOverallCompanyQuality(qualities: string[]): string {
    if (qualities.includes('top-tier')) return 'top-tier';
    if (qualities.includes('tech-focused')) return 'tech-focused';
    return 'standard';
  }

  private getMatchedSkills(profileSkills: any[], requiredSkills: string[]): string[] {
    const profileSkillNames = profileSkills.map(skill => skill.name.toLowerCase());
    const requiredSkillsLower = requiredSkills.map(skill => skill.toLowerCase());
    
    return requiredSkillsLower.filter(required => 
      profileSkillNames.some(profile => 
        profile.includes(required) || required.includes(profile)
      )
    );
  }

  private getCompanyQualityScore(quality: string): number {
    switch (quality) {
      case 'top-tier': return 15;
      case 'tech-focused': return 10;
      case 'standard': return 5;
      default: return 0;
    }
  }

  private createFailedAnalysis(candidateId: string, reason: string): LinkedInAnalysis {
    console.warn(`LinkedIn analysis failed for candidate ${candidateId}: ${reason}`);
    
    return {
      candidateId,
      profileAccessible: false,
      professionalScore: 0,
      experience: {
        totalYears: 0,
        relevantRoles: 0,
        companyQuality: 'unknown',
      },
      network: {
        connections: 0,
        endorsements: 0,
      },
      credibilityIndicators: [`Analysis failed: ${reason}`],
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test LinkedIn scraper API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('LinkedIn scraper API key not configured');
      return false;
    }

    try {
      // Test with a simple health check endpoint if available
      const response = await axios.get(`${this.baseUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      return response.status === 200;
    } catch (error) {
      console.warn('LinkedIn scraper API test failed:', error);
      return false;
    }
  }

  /**
   * Get API usage statistics
   */
  async getApiUsage(): Promise<{ remaining: number; reset: Date } | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/usage`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      return {
        remaining: response.data.rateLimitRemaining || 0,
        reset: new Date(response.data.rateLimitReset || Date.now()),
      };
    } catch (error) {
      console.warn('Failed to get LinkedIn API usage:', error);
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
    if (error.response?.status === 404) {
      return 'ProfileNotFoundError';
    }
    if (error.response?.status >= 500) {
      return 'ServerError';
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
    if (error.message?.includes('not found')) return 404;
    return 500;
  }
}

// Export singleton instance
export const linkedInAnalysisService = new LinkedInAnalysisService();