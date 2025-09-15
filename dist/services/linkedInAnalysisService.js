"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkedInAnalysisService = exports.LinkedInAnalysisService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const monitoringService_1 = require("./monitoringService");
const errorRecoveryService_1 = require("./errorRecoveryService");
class LinkedInAnalysisService {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 2000;
        this.baseUrl = config_1.config.linkedIn.baseUrl;
        this.apiKey = config_1.config.linkedIn.scraperApiKey;
        if (!this.apiKey) {
            console.warn('LinkedIn scraper API key not configured. LinkedIn analysis will be disabled.');
        }
    }
    async analyzeLinkedInProfile(candidateId, linkedInUrl, jobProfile) {
        const startTime = Date.now();
        logger_1.logger.info(`Starting LinkedIn analysis`, {
            service: 'linkedInAnalysis',
            operation: 'analyzeLinkedInProfile',
            candidateId,
            jobProfileId: jobProfile.id,
            linkedInUrl: linkedInUrl.substring(0, 50) + '...'
        });
        if (!this.apiKey) {
            const error = 'LinkedIn scraper API key not configured';
            logger_1.logger.error(error, undefined, {
                service: 'linkedInAnalysis',
                operation: 'analyzeLinkedInProfile',
                candidateId
            });
            return this.createFailedAnalysis(candidateId, error);
        }
        if (!linkedInUrl || !this.isValidLinkedInUrl(linkedInUrl)) {
            const error = 'Invalid or missing LinkedIn URL';
            logger_1.logger.warn(error, {
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
                logger_1.logger.error(error, undefined, {
                    service: 'linkedInAnalysis',
                    operation: 'analyzeLinkedInProfile',
                    candidateId,
                    linkedInUrl
                });
                return this.createFailedAnalysis(candidateId, error);
            }
            const analysis = this.analyzeProfileData(candidateId, profileData, jobProfile);
            const duration = Date.now() - startTime;
            monitoringService_1.monitoringService.recordApiUsage({
                service: 'linkedin',
                endpoint: '/profile',
                method: 'POST',
                statusCode: 200,
                responseTime: duration
            });
            logger_1.logger.performance('LinkedIn profile analysis', duration, true, {
                service: 'linkedInAnalysis',
                operation: 'analyzeLinkedInProfile',
                candidateId,
                jobProfileId: jobProfile.id,
                professionalScore: analysis.professionalScore
            });
            logger_1.logger.info(`Successfully analyzed LinkedIn profile`, {
                service: 'linkedInAnalysis',
                operation: 'analyzeLinkedInProfile',
                candidateId,
                jobProfileId: jobProfile.id,
                duration,
                professionalScore: analysis.professionalScore,
                profileAccessible: analysis.profileAccessible
            });
            return analysis;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const statusCode = this.getErrorStatusCode(error);
            const errorType = this.classifyError(error);
            monitoringService_1.monitoringService.recordApiUsage({
                service: 'linkedin',
                endpoint: '/profile',
                method: 'POST',
                statusCode,
                responseTime: duration
            });
            errorRecoveryService_1.errorRecoveryService.recordFailure('linkedInAnalysis', 'scrapeProfile', errorType, error);
            logger_1.logger.error(`LinkedIn analysis failed`, error, {
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
    async scrapeLinkedInProfile(linkedInUrl) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            const attemptStartTime = Date.now();
            try {
                logger_1.logger.debug(`LinkedIn scraping attempt ${attempt}/${this.maxRetries}`, {
                    service: 'linkedInAnalysis',
                    operation: 'scrapeLinkedInProfile',
                    attempt,
                    maxRetries: this.maxRetries,
                    linkedInUrl: linkedInUrl.substring(0, 50) + '...'
                });
                const response = await axios_1.default.post(`${this.baseUrl}/v1/profile`, {
                    url: linkedInUrl,
                    include_skills: true,
                    include_experience: true,
                    include_education: true,
                    include_endorsements: true,
                    include_recommendations: true,
                }, {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'JobFilteringFunnel/1.0',
                    },
                    timeout: 30000,
                });
                const result = response.data;
                if (!result.success) {
                    throw new Error(result.error || result.message || 'LinkedIn scraping failed');
                }
                if (!result.data) {
                    throw new Error('No profile data returned from LinkedIn scraper');
                }
                if (result.rateLimitRemaining !== undefined && result.rateLimitRemaining < 10) {
                    console.warn(`LinkedIn API rate limit low: ${result.rateLimitRemaining} requests remaining`);
                }
                return result.data;
            }
            catch (error) {
                lastError = error;
                console.warn(`LinkedIn scraping attempt ${attempt} failed:`, error);
                if (axios_1.default.isAxiosError(error)) {
                    if (error.response?.status === 404) {
                        throw new Error('LinkedIn profile not found or is private');
                    }
                    else if (error.response?.status === 429) {
                        console.warn('LinkedIn API rate limit exceeded, waiting before retry...');
                        await this.delay(this.retryDelay * attempt);
                        continue;
                    }
                    else if (error.response?.status === 403) {
                        throw new Error('LinkedIn profile is private or access denied');
                    }
                }
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    await this.delay(delay);
                }
            }
        }
        throw lastError || new Error('All LinkedIn scraping attempts failed');
    }
    analyzeProfileData(candidateId, profileData, jobProfile) {
        const experience = this.analyzeExperience(profileData, jobProfile);
        const network = this.analyzeNetwork(profileData);
        const credibilityIndicators = this.assessCredibility(profileData, jobProfile);
        const professionalScore = this.calculateProfessionalScore(profileData, experience, network, credibilityIndicators);
        return {
            candidateId,
            profileAccessible: true,
            professionalScore,
            experience,
            network,
            credibilityIndicators,
        };
    }
    analyzeExperience(profileData, jobProfile) {
        const experiences = profileData.experience || [];
        let totalYears = 0;
        let relevantRoles = 0;
        const companyQualities = [];
        for (const exp of experiences) {
            const duration = this.parseDuration(exp.duration);
            totalYears += duration;
            if (this.isRelevantRole(exp, jobProfile)) {
                relevantRoles++;
            }
            const quality = this.assessCompanyQuality(exp);
            if (quality) {
                companyQualities.push(quality);
            }
        }
        const companyQuality = this.determineOverallCompanyQuality(companyQualities);
        return {
            totalYears: Math.round(totalYears * 10) / 10,
            relevantRoles,
            companyQuality,
        };
    }
    analyzeNetwork(profileData) {
        const connections = profileData.profile?.connections || 0;
        let totalEndorsements = 0;
        if (profileData.endorsements) {
            totalEndorsements = profileData.endorsements.reduce((sum, endorsement) => {
                return sum + (endorsement.count || 0);
            }, 0);
        }
        else if (profileData.skills) {
            totalEndorsements = profileData.skills.reduce((sum, skill) => {
                return sum + (skill.endorsements || 0);
            }, 0);
        }
        return {
            connections,
            endorsements: totalEndorsements,
        };
    }
    assessCredibility(profileData, jobProfile) {
        const indicators = [];
        if (profileData.profile?.headline) {
            indicators.push('Complete professional headline');
        }
        if (profileData.profile?.summary) {
            indicators.push('Detailed professional summary');
        }
        const experiences = profileData.experience || [];
        if (experiences.length >= 3) {
            indicators.push('Extensive work history');
        }
        if (experiences.some(exp => exp.description && exp.description.length > 100)) {
            indicators.push('Detailed role descriptions');
        }
        if (profileData.education && profileData.education.length > 0) {
            indicators.push('Educational background provided');
        }
        if (profileData.skills) {
            const matchedSkills = this.getMatchedSkills(profileData.skills, jobProfile.requiredSkills);
            if (matchedSkills.length > 0) {
                indicators.push(`${matchedSkills.length} relevant skills listed`);
            }
        }
        const totalEndorsements = profileData.endorsements?.reduce((sum, e) => sum + e.count, 0) || 0;
        if (totalEndorsements >= 10) {
            indicators.push('Well-endorsed by peers');
        }
        if (profileData.recommendations && profileData.recommendations.length > 0) {
            indicators.push('Professional recommendations received');
        }
        const connections = profileData.profile?.connections || 0;
        if (connections >= 500) {
            indicators.push('Extensive professional network');
        }
        else if (connections >= 100) {
            indicators.push('Active professional network');
        }
        return indicators;
    }
    calculateProfessionalScore(profileData, experience, network, credibilityIndicators) {
        let score = 0;
        const experienceScore = Math.min(40, (experience.totalYears / 10) * 20 + experience.relevantRoles * 5);
        score += experienceScore;
        const connectionScore = Math.min(10, (network.connections / 500) * 10);
        const endorsementScore = Math.min(10, (network.endorsements / 50) * 10);
        score += connectionScore + endorsementScore;
        const completenessScore = Math.min(25, credibilityIndicators.length * 3);
        score += completenessScore;
        const companyQualityScore = this.getCompanyQualityScore(experience.companyQuality);
        score += companyQualityScore;
        return Math.min(100, Math.round(score));
    }
    isValidLinkedInUrl(url) {
        const linkedInRegex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+\/?$/;
        return linkedInRegex.test(url);
    }
    parseDuration(duration) {
        if (!duration)
            return 0;
        const yearMatch = duration.match(/(\d+)\s*(year|yr)/i);
        const monthMatch = duration.match(/(\d+)\s*(month|mo)/i);
        let years = 0;
        if (yearMatch && yearMatch[1]) {
            years += parseInt(yearMatch[1], 10);
        }
        if (monthMatch && monthMatch[1]) {
            years += parseInt(monthMatch[1], 10) / 12;
        }
        return years || 0.5;
    }
    isRelevantRole(experience, jobProfile) {
        const title = (experience.title || '').toLowerCase();
        const description = (experience.description || '').toLowerCase();
        const jobTitle = jobProfile.title.toLowerCase();
        const requiredSkills = jobProfile.requiredSkills.map(skill => skill.toLowerCase());
        const titleWords = jobTitle.split(' ');
        const hasRelevantTitle = titleWords.some(word => word.length > 3 && title.includes(word));
        const hasRelevantSkills = requiredSkills.some(skill => title.includes(skill) || description.includes(skill));
        return hasRelevantTitle || hasRelevantSkills;
    }
    assessCompanyQuality(experience) {
        const company = (experience.company || '').toLowerCase();
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
    determineOverallCompanyQuality(qualities) {
        if (qualities.includes('top-tier'))
            return 'top-tier';
        if (qualities.includes('tech-focused'))
            return 'tech-focused';
        return 'standard';
    }
    getMatchedSkills(profileSkills, requiredSkills) {
        const profileSkillNames = profileSkills.map(skill => skill.name.toLowerCase());
        const requiredSkillsLower = requiredSkills.map(skill => skill.toLowerCase());
        return requiredSkillsLower.filter(required => profileSkillNames.some(profile => profile.includes(required) || required.includes(profile)));
    }
    getCompanyQualityScore(quality) {
        switch (quality) {
            case 'top-tier': return 15;
            case 'tech-focused': return 10;
            case 'standard': return 5;
            default: return 0;
        }
    }
    createFailedAnalysis(candidateId, reason) {
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
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async testConnection() {
        if (!this.apiKey) {
            console.warn('LinkedIn scraper API key not configured');
            return false;
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/health`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            return response.status === 200;
        }
        catch (error) {
            console.warn('LinkedIn scraper API test failed:', error);
            return false;
        }
    }
    async getApiUsage() {
        if (!this.apiKey) {
            return null;
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/usage`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                timeout: 10000,
            });
            return {
                remaining: response.data.rateLimitRemaining || 0,
                reset: new Date(response.data.rateLimitReset || Date.now()),
            };
        }
        catch (error) {
            console.warn('Failed to get LinkedIn API usage:', error);
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
        if (error.response?.status === 404) {
            return 'ProfileNotFoundError';
        }
        if (error.response?.status >= 500) {
            return 'ServerError';
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
        if (error.message?.includes('not found'))
            return 404;
        return 500;
    }
}
exports.LinkedInAnalysisService = LinkedInAnalysisService;
exports.linkedInAnalysisService = new LinkedInAnalysisService();
//# sourceMappingURL=linkedInAnalysisService.js.map