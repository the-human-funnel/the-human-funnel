"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubAnalysisService = exports.GitHubAnalysisService = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const monitoringService_1 = require("./monitoringService");
const errorRecoveryService_1 = require("./errorRecoveryService");
class GitHubAnalysisService {
    constructor() {
        this.baseUrl = 'https://api.github.com';
        this.maxRetries = 3;
        this.retryDelay = 2000;
        this.token = config_1.config.github.token;
        if (!this.token) {
            console.warn('GitHub token not configured. GitHub analysis will be disabled.');
        }
    }
    async analyzeGitHubProfile(candidateId, githubUrl, jobProfile, resumeProjectUrls = []) {
        const startTime = Date.now();
        logger_1.logger.info(`Starting GitHub analysis`, {
            service: 'githubAnalysis',
            operation: 'analyzeGitHubProfile',
            candidateId,
            jobProfileId: jobProfile.id,
            githubUrl: githubUrl.substring(0, 50) + '...',
            resumeProjectCount: resumeProjectUrls.length
        });
        if (!this.token) {
            const error = 'GitHub token not configured';
            logger_1.logger.error(error, undefined, {
                service: 'githubAnalysis',
                operation: 'analyzeGitHubProfile',
                candidateId
            });
            return this.createFailedAnalysis(candidateId, error);
        }
        if (!githubUrl || !this.isValidGitHubUrl(githubUrl)) {
            const error = 'Invalid or missing GitHub URL';
            logger_1.logger.warn(error, {
                service: 'githubAnalysis',
                operation: 'analyzeGitHubProfile',
                candidateId,
                githubUrl
            });
            return this.createFailedAnalysis(candidateId, error);
        }
        try {
            const username = this.extractUsernameFromUrl(githubUrl);
            if (!username) {
                const error = 'Could not extract username from GitHub URL';
                logger_1.logger.error(error, undefined, {
                    service: 'githubAnalysis',
                    operation: 'analyzeGitHubProfile',
                    candidateId,
                    githubUrl
                });
                return this.createFailedAnalysis(candidateId, error);
            }
            const profileData = await this.fetchGitHubProfileData(username);
            if (!profileData) {
                const error = 'Failed to retrieve GitHub profile data';
                logger_1.logger.error(error, undefined, {
                    service: 'githubAnalysis',
                    operation: 'analyzeGitHubProfile',
                    candidateId,
                    username
                });
                return this.createFailedAnalysis(candidateId, error);
            }
            const analysis = await this.analyzeProfileData(candidateId, profileData, jobProfile, resumeProjectUrls);
            const duration = Date.now() - startTime;
            monitoringService_1.monitoringService.recordApiUsage({
                service: 'github',
                endpoint: '/user',
                method: 'GET',
                statusCode: 200,
                responseTime: duration
            });
            logger_1.logger.performance('GitHub profile analysis', duration, true, {
                service: 'githubAnalysis',
                operation: 'analyzeGitHubProfile',
                candidateId,
                jobProfileId: jobProfile.id,
                technicalScore: analysis.technicalScore,
                username
            });
            logger_1.logger.info(`Successfully analyzed GitHub profile`, {
                service: 'githubAnalysis',
                operation: 'analyzeGitHubProfile',
                candidateId,
                jobProfileId: jobProfile.id,
                duration,
                technicalScore: analysis.technicalScore,
                publicRepos: analysis.profileStats.publicRepos,
                username
            });
            return analysis;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const statusCode = this.getErrorStatusCode(error);
            const errorType = this.classifyError(error);
            monitoringService_1.monitoringService.recordApiUsage({
                service: 'github',
                endpoint: '/user',
                method: 'GET',
                statusCode,
                responseTime: duration
            });
            errorRecoveryService_1.errorRecoveryService.recordFailure('githubAnalysis', 'fetchProfile', errorType, error);
            logger_1.logger.error(`GitHub analysis failed`, error, {
                service: 'githubAnalysis',
                operation: 'analyzeGitHubProfile',
                candidateId,
                jobProfileId: jobProfile.id,
                duration,
                statusCode,
                errorType,
                githubUrl
            });
            if (error instanceof Error) {
                return this.createFailedAnalysis(candidateId, error.message);
            }
            return this.createFailedAnalysis(candidateId, 'Unknown error during GitHub analysis');
        }
    }
    async fetchGitHubProfileData(username) {
        try {
            console.log(`Fetching GitHub data for username: ${username}`);
            const profile = await this.makeGitHubRequest(`/users/${username}`);
            const repositories = await this.makeGitHubRequest(`/users/${username}/repos?sort=updated&per_page=100`);
            const events = await this.makeGitHubRequest(`/users/${username}/events?per_page=100`);
            return {
                profile,
                repositories: repositories || [],
                events: events || [],
            };
        }
        catch (error) {
            console.error(`Failed to fetch GitHub profile data for ${username}:`, error);
            throw error;
        }
    }
    async makeGitHubRequest(endpoint) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`GitHub API request attempt ${attempt}/${this.maxRetries}: ${endpoint}`);
                const response = await axios_1.default.get(`${this.baseUrl}${endpoint}`, {
                    headers: {
                        'Authorization': `token ${this.token}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'JobFilteringFunnel/1.0',
                    },
                    timeout: 30000,
                });
                const remaining = response.headers['x-ratelimit-remaining'];
                if (remaining && parseInt(remaining, 10) < 100) {
                    console.warn(`GitHub API rate limit low: ${remaining} requests remaining`);
                }
                return response.data;
            }
            catch (error) {
                lastError = error;
                console.warn(`GitHub API request attempt ${attempt} failed:`, error);
                if (axios_1.default.isAxiosError(error)) {
                    if (error.response?.status === 404) {
                        throw new Error('GitHub profile not found or is private');
                    }
                    else if (error.response?.status === 403) {
                        const resetTime = error.response.headers['x-ratelimit-reset'];
                        if (resetTime) {
                            const resetDate = new Date(parseInt(resetTime, 10) * 1000);
                            throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}`);
                        }
                        throw new Error('GitHub API access forbidden');
                    }
                    else if (error.response?.status === 401) {
                        throw new Error('GitHub token is invalid or expired');
                    }
                }
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    await this.delay(delay);
                }
            }
        }
        throw lastError || new Error('All GitHub API requests failed');
    }
    async analyzeProfileData(candidateId, profileData, jobProfile, resumeProjectUrls) {
        const profileStats = this.calculateProfileStats(profileData);
        const skillsEvidence = this.extractSkillsEvidence(profileData, jobProfile);
        const projectAuthenticity = await this.analyzeProjectAuthenticity(profileData, resumeProjectUrls);
        const technicalScore = this.calculateTechnicalScore(profileStats, skillsEvidence, projectAuthenticity, profileData);
        return {
            candidateId,
            profileStats,
            technicalScore,
            projectAuthenticity,
            skillsEvidence,
        };
    }
    calculateProfileStats(profileData) {
        const profile = profileData.profile;
        const repositories = profileData.repositories;
        const events = profileData.events;
        const contributionStreak = this.calculateContributionStreak(events);
        const totalCommits = this.estimateTotalCommits(events, repositories);
        return {
            publicRepos: profile.public_repos,
            followers: profile.followers,
            contributionStreak,
            totalCommits,
        };
    }
    calculateContributionStreak(events) {
        if (!events || events.length === 0)
            return 0;
        const pushEvents = events
            .filter(event => event.type === 'PushEvent')
            .map(event => new Date(event.created_at))
            .sort((a, b) => b.getTime() - a.getTime());
        if (pushEvents.length === 0)
            return 0;
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        for (let i = 0; i < pushEvents.length; i++) {
            const pushEvent = pushEvents[i];
            if (!pushEvent)
                continue;
            const eventDate = new Date(pushEvent);
            eventDate.setHours(0, 0, 0, 0);
            const daysDiff = Math.floor((currentDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff === streak || (streak === 0 && daysDiff <= 7)) {
                streak = daysDiff + 1;
                currentDate = eventDate;
            }
            else if (daysDiff > streak + 1) {
                break;
            }
        }
        return streak;
    }
    estimateTotalCommits(events, repositories) {
        const pushEvents = events.filter(event => event.type === 'PushEvent');
        const repoCommitEstimate = repositories.reduce((total, repo) => {
            const ageInDays = Math.floor((Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24));
            const sizeScore = Math.min(repo.size / 1000, 10);
            const activityScore = repo.stargazers_count + repo.forks_count;
            return total + Math.floor((ageInDays / 30) * sizeScore * Math.max(1, activityScore / 10));
        }, 0);
        return pushEvents.length * 2 + repoCommitEstimate;
    }
    extractSkillsEvidence(profileData, jobProfile) {
        const evidence = [];
        const repositories = profileData.repositories;
        const requiredSkills = jobProfile.requiredSkills.map(skill => skill.toLowerCase());
        const languages = new Map();
        repositories.forEach(repo => {
            if (repo.language) {
                const lang = repo.language.toLowerCase();
                languages.set(lang, (languages.get(lang) || 0) + 1);
            }
        });
        requiredSkills.forEach(skill => {
            if (languages.has(skill)) {
                const count = languages.get(skill);
                evidence.push(`${count} repositories using ${skill}`);
            }
        });
        const techKeywords = this.extractTechKeywords(repositories, requiredSkills);
        techKeywords.forEach(keyword => {
            evidence.push(`Experience with ${keyword} (from repository analysis)`);
        });
        const frameworks = ['react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring'];
        frameworks.forEach(framework => {
            const repoCount = repositories.filter(repo => (repo.name.toLowerCase().includes(framework) ||
                (repo.description && repo.description.toLowerCase().includes(framework)))).length;
            if (repoCount > 0 && requiredSkills.includes(framework)) {
                evidence.push(`${repoCount} projects using ${framework}`);
            }
        });
        const popularRepos = repositories.filter(repo => repo.stargazers_count >= 10 || repo.forks_count >= 5);
        if (popularRepos.length > 0) {
            evidence.push(`${popularRepos.length} repositories with community engagement`);
        }
        const recentRepos = repositories.filter(repo => {
            const lastUpdate = new Date(repo.updated_at);
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            return lastUpdate > sixMonthsAgo;
        });
        if (recentRepos.length > 0) {
            evidence.push(`${recentRepos.length} repositories updated in last 6 months`);
        }
        return evidence;
    }
    extractTechKeywords(repositories, requiredSkills) {
        const keywords = new Set();
        repositories.forEach(repo => {
            const text = `${repo.name} ${repo.description || ''}`.toLowerCase();
            requiredSkills.forEach(skill => {
                if (text.includes(skill.toLowerCase())) {
                    keywords.add(skill);
                }
            });
        });
        return Array.from(keywords);
    }
    async analyzeProjectAuthenticity(profileData, resumeProjectUrls) {
        const resumeProjects = [];
        for (const projectUrl of resumeProjectUrls) {
            if (!this.isValidGitHubUrl(projectUrl)) {
                continue;
            }
            try {
                const repoInfo = this.extractRepoInfoFromUrl(projectUrl);
                if (!repoInfo)
                    continue;
                const { owner, repo } = repoInfo;
                const userRepo = profileData.repositories.find(r => r.name.toLowerCase() === repo.toLowerCase() &&
                    r.full_name.toLowerCase().includes(owner.toLowerCase()));
                if (!userRepo) {
                    resumeProjects.push({
                        url: projectUrl,
                        isAuthentic: false,
                        commitHistory: 0,
                        branchingPattern: 'unknown',
                        codeQuality: 'unknown',
                    });
                    continue;
                }
                const commitAnalysis = await this.analyzeRepositoryCommits(owner, repo);
                const branchAnalysis = await this.analyzeRepositoryBranches(owner, repo);
                const codeQuality = this.assessCodeQuality(userRepo, commitAnalysis);
                resumeProjects.push({
                    url: projectUrl,
                    isAuthentic: commitAnalysis.isAuthentic,
                    commitHistory: commitAnalysis.commitCount,
                    branchingPattern: branchAnalysis.pattern,
                    codeQuality,
                });
            }
            catch (error) {
                console.warn(`Failed to analyze project ${projectUrl}:`, error);
                resumeProjects.push({
                    url: projectUrl,
                    isAuthentic: false,
                    commitHistory: 0,
                    branchingPattern: 'analysis-failed',
                    codeQuality: 'unknown',
                });
            }
        }
        return { resumeProjects };
    }
    async analyzeRepositoryCommits(owner, repo) {
        try {
            const commits = await this.makeGitHubRequest(`/repos/${owner}/${repo}/commits?per_page=100`);
            if (!commits || commits.length === 0) {
                return { isAuthentic: false, commitCount: 0, authorDiversity: 0 };
            }
            const authors = new Set();
            const commitDates = [];
            commits.forEach(commit => {
                if (commit.commit.author.email) {
                    authors.add(commit.commit.author.email);
                }
                commitDates.push(new Date(commit.commit.author.date));
            });
            const hasMultipleAuthors = authors.size > 1;
            const hasRecentActivity = commitDates.some(date => Date.now() - date.getTime() < 30 * 24 * 60 * 60 * 1000);
            const hasConsistentActivity = this.hasConsistentCommitActivity(commitDates);
            const hasDetailedCommitMessages = commits.some(commit => commit.commit.message.length > 20 && !commit.commit.message.startsWith('Initial commit'));
            const authenticityScore = [
                hasMultipleAuthors,
                hasRecentActivity,
                hasConsistentActivity,
                hasDetailedCommitMessages,
                commits.length >= 5
            ].filter(Boolean).length;
            const isAuthentic = authenticityScore >= 3;
            return {
                isAuthentic,
                commitCount: commits.length,
                authorDiversity: authors.size,
            };
        }
        catch (error) {
            console.warn(`Failed to analyze commits for ${owner}/${repo}:`, error);
            return { isAuthentic: false, commitCount: 0, authorDiversity: 0 };
        }
    }
    hasConsistentCommitActivity(commitDates) {
        if (commitDates.length < 3)
            return false;
        const sortedDates = commitDates.sort((a, b) => a.getTime() - b.getTime());
        const firstCommit = sortedDates[0];
        const lastCommit = sortedDates[sortedDates.length - 1];
        if (!firstCommit || !lastCommit)
            return false;
        const timeSpan = lastCommit.getTime() - firstCommit.getTime();
        const daySpan = timeSpan / (1000 * 60 * 60 * 24);
        return daySpan >= 1;
    }
    async analyzeRepositoryBranches(owner, repo) {
        try {
            const branches = await this.makeGitHubRequest(`/repos/${owner}/${repo}/branches`);
            if (!branches || branches.length === 0) {
                return { pattern: 'no-branches', branchCount: 0 };
            }
            const branchNames = branches.map(b => b.name.toLowerCase());
            const branchCount = branches.length;
            if (branchCount === 1 && (branchNames.includes('main') || branchNames.includes('master'))) {
                return { pattern: 'single-branch', branchCount };
            }
            else if (branchCount > 1 && branchNames.some(name => name.includes('develop') || name.includes('feature') || name.includes('release'))) {
                return { pattern: 'git-flow', branchCount };
            }
            else if (branchCount > 1) {
                return { pattern: 'multi-branch', branchCount };
            }
            else {
                return { pattern: 'simple', branchCount };
            }
        }
        catch (error) {
            console.warn(`Failed to analyze branches for ${owner}/${repo}:`, error);
            return { pattern: 'analysis-failed', branchCount: 0 };
        }
    }
    assessCodeQuality(repository, commitAnalysis) {
        let qualityScore = 0;
        if (repository.description && repository.description.length > 10) {
            qualityScore += 1;
        }
        if (repository.size > 1) {
            qualityScore += 1;
        }
        if (repository.stargazers_count > 0 || repository.forks_count > 0) {
            qualityScore += 1;
        }
        if (commitAnalysis.commitCount >= 10) {
            qualityScore += 1;
        }
        if (commitAnalysis.authorDiversity > 1) {
            qualityScore += 1;
        }
        const lastUpdate = new Date(repository.updated_at);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        if (lastUpdate > threeMonthsAgo) {
            qualityScore += 1;
        }
        if (qualityScore >= 5)
            return 'excellent';
        if (qualityScore >= 3)
            return 'good';
        if (qualityScore >= 1)
            return 'basic';
        return 'poor';
    }
    calculateTechnicalScore(profileStats, skillsEvidence, projectAuthenticity, profileData) {
        let score = 0;
        const repoScore = Math.min(15, (profileStats.publicRepos / 20) * 15);
        const followerScore = Math.min(5, (profileStats.followers / 50) * 5);
        const streakScore = Math.min(10, (profileStats.contributionStreak / 30) * 10);
        score += repoScore + followerScore + streakScore;
        const skillsScore = Math.min(25, skillsEvidence.length * 3);
        score += skillsScore;
        const authenticProjects = projectAuthenticity.resumeProjects.filter(p => p.isAuthentic).length;
        const totalProjects = projectAuthenticity.resumeProjects.length;
        let authenticityScore = 0;
        if (totalProjects > 0) {
            const authenticityRatio = authenticProjects / totalProjects;
            authenticityScore = authenticityRatio * 25;
        }
        else {
            const qualityRepos = profileData.repositories.filter(repo => repo.stargazers_count > 0 || repo.forks_count > 0 || repo.size > 100).length;
            authenticityScore = Math.min(15, qualityRepos * 3);
        }
        score += authenticityScore;
        const popularRepos = profileData.repositories.filter(repo => repo.stargazers_count >= 5 || repo.forks_count >= 2).length;
        const qualityScore = Math.min(10, popularRepos * 2);
        const languageDiversity = new Set(profileData.repositories.map(repo => repo.language).filter(Boolean)).size;
        const diversityScore = Math.min(10, languageDiversity * 2);
        score += qualityScore + diversityScore;
        return Math.min(100, Math.round(score));
    }
    isValidGitHubUrl(url) {
        const githubRegex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-_]+\/?([a-zA-Z0-9-_]+\/?)?$/;
        return githubRegex.test(url);
    }
    extractUsernameFromUrl(url) {
        const match = url.match(/github\.com\/([a-zA-Z0-9-_]+)/);
        return match && match[1] ? match[1] : null;
    }
    extractRepoInfoFromUrl(url) {
        const match = url.match(/github\.com\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_]+)/);
        return match && match[1] && match[2] ? { owner: match[1], repo: match[2] } : null;
    }
    createFailedAnalysis(candidateId, reason) {
        console.warn(`GitHub analysis failed for candidate ${candidateId}: ${reason}`);
        return {
            candidateId,
            profileStats: {
                publicRepos: 0,
                followers: 0,
                contributionStreak: 0,
                totalCommits: 0,
            },
            technicalScore: 0,
            projectAuthenticity: {
                resumeProjects: [],
            },
            skillsEvidence: [`Analysis failed: ${reason}`],
        };
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async testConnection() {
        if (!this.token) {
            console.warn('GitHub token not configured');
            return false;
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/user`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
                timeout: 10000,
            });
            return response.status === 200;
        }
        catch (error) {
            console.warn('GitHub API test failed:', error);
            return false;
        }
    }
    async getRateLimitStatus() {
        if (!this.token) {
            return null;
        }
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/rate_limit`, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                },
                timeout: 10000,
            });
            return {
                remaining: response.data.rate.remaining || 0,
                reset: new Date(response.data.rate.reset * 1000),
            };
        }
        catch (error) {
            console.warn('Failed to get GitHub rate limit status:', error);
            return null;
        }
    }
    classifyError(error) {
        if (error.response?.status === 403 && error.response?.headers?.['x-ratelimit-remaining'] === '0') {
            return 'RateLimitError';
        }
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
exports.GitHubAnalysisService = GitHubAnalysisService;
exports.githubAnalysisService = new GitHubAnalysisService();
//# sourceMappingURL=githubAnalysisService.js.map