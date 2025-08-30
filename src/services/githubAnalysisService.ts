import axios, { AxiosResponse } from 'axios';
import { config } from '../utils/config';
import { GitHubAnalysis, JobProfile } from '../models/interfaces';
import { logger } from '../utils/logger';
import { monitoringService } from './monitoringService';
import { errorRecoveryService } from './errorRecoveryService';

export interface GitHubProfileData {
  profile: {
    login: string;
    id: number;
    name?: string;
    company?: string;
    blog?: string;
    location?: string;
    email?: string;
    bio?: string;
    public_repos: number;
    public_gists: number;
    followers: number;
    following: number;
    created_at: string;
    updated_at: string;
  };
  repositories: Array<{
    id: number;
    name: string;
    full_name: string;
    description?: string;
    private: boolean;
    html_url: string;
    clone_url: string;
    language?: string;
    size: number;
    stargazers_count: number;
    watchers_count: number;
    forks_count: number;
    open_issues_count: number;
    created_at: string;
    updated_at: string;
    pushed_at: string;
    default_branch: string;
  }>;
  events: Array<{
    type: string;
    created_at: string;
    repo?: {
      name: string;
    };
  }>;
}

export interface GitHubCommitData {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login: string;
  };
  committer?: {
    login: string;
  };
}

export interface GitHubBranchData {
  name: string;
  commit: {
    sha: string;
  };
  protected: boolean;
}

export class GitHubAnalysisService {
  private readonly baseUrl: string = 'https://api.github.com';
  private readonly token: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 2000; // 2 seconds

  constructor() {
    this.token = config.github.token;

    if (!this.token) {
      console.warn('GitHub token not configured. GitHub analysis will be disabled.');
    }
  }

  /**
   * Analyze a GitHub profile for a candidate
   */
  async analyzeGitHubProfile(
    candidateId: string,
    githubUrl: string,
    jobProfile: JobProfile,
    resumeProjectUrls: string[] = []
  ): Promise<GitHubAnalysis> {
    const startTime = Date.now();
    
    logger.info(`Starting GitHub analysis`, {
      service: 'githubAnalysis',
      operation: 'analyzeGitHubProfile',
      candidateId,
      jobProfileId: jobProfile.id,
      githubUrl: githubUrl.substring(0, 50) + '...',
      resumeProjectCount: resumeProjectUrls.length
    });

    if (!this.token) {
      const error = 'GitHub token not configured';
      logger.error(error, undefined, {
        service: 'githubAnalysis',
        operation: 'analyzeGitHubProfile',
        candidateId
      });
      return this.createFailedAnalysis(candidateId, error);
    }

    if (!githubUrl || !this.isValidGitHubUrl(githubUrl)) {
      const error = 'Invalid or missing GitHub URL';
      logger.warn(error, {
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
        logger.error(error, undefined, {
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
        logger.error(error, undefined, {
          service: 'githubAnalysis',
          operation: 'analyzeGitHubProfile',
          candidateId,
          username
        });
        return this.createFailedAnalysis(candidateId, error);
      }

      const analysis = await this.analyzeProfileData(candidateId, profileData, jobProfile, resumeProjectUrls);
      const duration = Date.now() - startTime;
      
      // Record successful analysis
      monitoringService.recordApiUsage({
        service: 'github',
        endpoint: '/user',
        method: 'GET',
        statusCode: 200,
        responseTime: duration
      });
      
      logger.performance('GitHub profile analysis', duration, true, {
        service: 'githubAnalysis',
        operation: 'analyzeGitHubProfile',
        candidateId,
        jobProfileId: jobProfile.id,
        technicalScore: analysis.technicalScore,
        username
      });
      
      logger.info(`Successfully analyzed GitHub profile`, {
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
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = this.getErrorStatusCode(error);
      const errorType = this.classifyError(error);
      
      // Record failed API usage
      monitoringService.recordApiUsage({
        service: 'github',
        endpoint: '/user',
        method: 'GET',
        statusCode,
        responseTime: duration
      });
      
      // Record failure for error recovery
      errorRecoveryService.recordFailure(
        'githubAnalysis',
        'fetchProfile',
        errorType,
        error
      );
      
      logger.error(`GitHub analysis failed`, error, {
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

  /**
   * Fetch comprehensive GitHub profile data
   */
  private async fetchGitHubProfileData(username: string): Promise<GitHubProfileData | null> {
    try {
      console.log(`Fetching GitHub data for username: ${username}`);

      // Fetch profile information
      const profile = await this.makeGitHubRequest(`/users/${username}`);
      
      // Fetch repositories (up to 100 most recent)
      const repositories = await this.makeGitHubRequest(`/users/${username}/repos?sort=updated&per_page=100`);
      
      // Fetch recent events (up to 100 most recent)
      const events = await this.makeGitHubRequest(`/users/${username}/events?per_page=100`);

      return {
        profile,
        repositories: repositories || [],
        events: events || [],
      };
    } catch (error) {
      console.error(`Failed to fetch GitHub profile data for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Make authenticated GitHub API request with retry logic
   */
  private async makeGitHubRequest(endpoint: string): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`GitHub API request attempt ${attempt}/${this.maxRetries}: ${endpoint}`);

        const response: AxiosResponse = await axios.get(`${this.baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'JobFilteringFunnel/1.0',
          },
          timeout: 30000, // 30 second timeout
        });

        // Check rate limits
        const remaining = response.headers['x-ratelimit-remaining'];
        if (remaining && parseInt(remaining, 10) < 100) {
          console.warn(`GitHub API rate limit low: ${remaining} requests remaining`);
        }

        return response.data;
      } catch (error) {
        lastError = error as Error;
        console.warn(`GitHub API request attempt ${attempt} failed:`, error);

        // Handle specific error types
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 404) {
            throw new Error('GitHub profile not found or is private');
          } else if (error.response?.status === 403) {
            const resetTime = error.response.headers['x-ratelimit-reset'];
            if (resetTime) {
              const resetDate = new Date(parseInt(resetTime, 10) * 1000);
              throw new Error(`GitHub API rate limit exceeded. Resets at ${resetDate.toISOString()}`);
            }
            throw new Error('GitHub API access forbidden');
          } else if (error.response?.status === 401) {
            throw new Error('GitHub token is invalid or expired');
          }
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error('All GitHub API requests failed');
  }

  /**
   * Analyze GitHub profile data and generate technical score
   */
  private async analyzeProfileData(
    candidateId: string,
    profileData: GitHubProfileData,
    jobProfile: JobProfile,
    resumeProjectUrls: string[]
  ): Promise<GitHubAnalysis> {
    const profileStats = this.calculateProfileStats(profileData);
    const skillsEvidence = this.extractSkillsEvidence(profileData, jobProfile);
    const projectAuthenticity = await this.analyzeProjectAuthenticity(profileData, resumeProjectUrls);
    
    // Calculate technical score based on multiple factors
    const technicalScore = this.calculateTechnicalScore(
      profileStats,
      skillsEvidence,
      projectAuthenticity,
      profileData
    );

    return {
      candidateId,
      profileStats,
      technicalScore,
      projectAuthenticity,
      skillsEvidence,
    };
  }

  /**
   * Calculate profile statistics
   */
  private calculateProfileStats(profileData: GitHubProfileData): GitHubAnalysis['profileStats'] {
    const profile = profileData.profile;
    const repositories = profileData.repositories;
    const events = profileData.events;

    // Calculate contribution streak from events
    const contributionStreak = this.calculateContributionStreak(events);
    
    // Estimate total commits from events and repositories
    const totalCommits = this.estimateTotalCommits(events, repositories);

    return {
      publicRepos: profile.public_repos,
      followers: profile.followers,
      contributionStreak,
      totalCommits,
    };
  }

  /**
   * Calculate contribution streak in days
   */
  private calculateContributionStreak(events: any[]): number {
    if (!events || events.length === 0) return 0;

    // Filter push events and sort by date
    const pushEvents = events
      .filter(event => event.type === 'PushEvent')
      .map(event => new Date(event.created_at))
      .sort((a, b) => b.getTime() - a.getTime());

    if (pushEvents.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Check for consecutive days with commits
    for (let i = 0; i < pushEvents.length; i++) {
      const pushEvent = pushEvents[i];
      if (!pushEvent) continue;
      
      const eventDate = new Date(pushEvent);
      eventDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((currentDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff === streak || (streak === 0 && daysDiff <= 7)) {
        streak = daysDiff + 1;
        currentDate = eventDate;
      } else if (daysDiff > streak + 1) {
        break;
      }
    }

    return streak;
  }

  /**
   * Estimate total commits from events and repository data
   */
  private estimateTotalCommits(events: any[], repositories: any[]): number {
    // Count push events as a proxy for commits
    const pushEvents = events.filter(event => event.type === 'PushEvent');
    
    // Add estimated commits from repository sizes and activity
    const repoCommitEstimate = repositories.reduce((total, repo) => {
      // Estimate commits based on repository size and age
      const ageInDays = Math.floor((Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const sizeScore = Math.min(repo.size / 1000, 10); // Normalize size
      const activityScore = repo.stargazers_count + repo.forks_count;
      
      return total + Math.floor((ageInDays / 30) * sizeScore * Math.max(1, activityScore / 10));
    }, 0);

    return pushEvents.length * 2 + repoCommitEstimate; // Assume 2 commits per push event on average
  }

  /**
   * Extract skills evidence from repositories and profile
   */
  private extractSkillsEvidence(profileData: GitHubProfileData, jobProfile: JobProfile): string[] {
    const evidence: string[] = [];
    const repositories = profileData.repositories;
    const requiredSkills = jobProfile.requiredSkills.map(skill => skill.toLowerCase());

    // Analyze programming languages
    const languages = new Map<string, number>();
    repositories.forEach(repo => {
      if (repo.language) {
        const lang = repo.language.toLowerCase();
        languages.set(lang, (languages.get(lang) || 0) + 1);
      }
    });

    // Check for required skills in languages
    requiredSkills.forEach(skill => {
      if (languages.has(skill)) {
        const count = languages.get(skill)!;
        evidence.push(`${count} repositories using ${skill}`);
      }
    });

    // Analyze repository names and descriptions for technology keywords
    const techKeywords = this.extractTechKeywords(repositories, requiredSkills);
    techKeywords.forEach(keyword => {
      evidence.push(`Experience with ${keyword} (from repository analysis)`);
    });

    // Check for framework and tool usage in repository names/descriptions
    const frameworks = ['react', 'angular', 'vue', 'node', 'express', 'django', 'flask', 'spring'];
    frameworks.forEach(framework => {
      const repoCount = repositories.filter(repo => 
        (repo.name.toLowerCase().includes(framework) || 
         (repo.description && repo.description.toLowerCase().includes(framework)))
      ).length;
      
      if (repoCount > 0 && requiredSkills.includes(framework)) {
        evidence.push(`${repoCount} projects using ${framework}`);
      }
    });

    // Check for popular repositories (high stars/forks)
    const popularRepos = repositories.filter(repo => repo.stargazers_count >= 10 || repo.forks_count >= 5);
    if (popularRepos.length > 0) {
      evidence.push(`${popularRepos.length} repositories with community engagement`);
    }

    // Check for recent activity
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

  /**
   * Extract technology keywords from repository data
   */
  private extractTechKeywords(repositories: any[], requiredSkills: string[]): string[] {
    const keywords = new Set<string>();
    
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

  /**
   * Analyze project authenticity by examining commit history and patterns
   */
  private async analyzeProjectAuthenticity(
    profileData: GitHubProfileData,
    resumeProjectUrls: string[]
  ): Promise<GitHubAnalysis['projectAuthenticity']> {
    const resumeProjects: GitHubAnalysis['projectAuthenticity']['resumeProjects'] = [];

    for (const projectUrl of resumeProjectUrls) {
      if (!this.isValidGitHubUrl(projectUrl)) {
        continue;
      }

      try {
        const repoInfo = this.extractRepoInfoFromUrl(projectUrl);
        if (!repoInfo) continue;

        const { owner, repo } = repoInfo;
        
        // Find the repository in the user's repositories
        const userRepo = profileData.repositories.find(r => 
          r.name.toLowerCase() === repo.toLowerCase() && 
          r.full_name.toLowerCase().includes(owner.toLowerCase())
        );

        if (!userRepo) {
          // Repository not found in user's profile - might be forked or not owned
          resumeProjects.push({
            url: projectUrl,
            isAuthentic: false,
            commitHistory: 0,
            branchingPattern: 'unknown',
            codeQuality: 'unknown',
          });
          continue;
        }

        // Analyze commit history and branching patterns
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

      } catch (error) {
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

  /**
   * Analyze repository commits for authenticity
   */
  private async analyzeRepositoryCommits(owner: string, repo: string): Promise<{
    isAuthentic: boolean;
    commitCount: number;
    authorDiversity: number;
  }> {
    try {
      // Fetch recent commits (up to 100)
      const commits: GitHubCommitData[] = await this.makeGitHubRequest(
        `/repos/${owner}/${repo}/commits?per_page=100`
      );

      if (!commits || commits.length === 0) {
        return { isAuthentic: false, commitCount: 0, authorDiversity: 0 };
      }

      // Analyze commit patterns
      const authors = new Set<string>();
      const commitDates: Date[] = [];
      
      commits.forEach(commit => {
        if (commit.commit.author.email) {
          authors.add(commit.commit.author.email);
        }
        commitDates.push(new Date(commit.commit.author.date));
      });

      // Check for authenticity indicators
      const hasMultipleAuthors = authors.size > 1;
      const hasRecentActivity = commitDates.some(date => 
        Date.now() - date.getTime() < 30 * 24 * 60 * 60 * 1000 // 30 days
      );
      const hasConsistentActivity = this.hasConsistentCommitActivity(commitDates);
      const hasDetailedCommitMessages = commits.some(commit => 
        commit.commit.message.length > 20 && !commit.commit.message.startsWith('Initial commit')
      );

      // Determine authenticity based on multiple factors
      const authenticityScore = [
        hasMultipleAuthors,
        hasRecentActivity,
        hasConsistentActivity,
        hasDetailedCommitMessages,
        commits.length >= 5
      ].filter(Boolean).length;

      const isAuthentic = authenticityScore >= 3; // At least 3 out of 5 indicators

      return {
        isAuthentic,
        commitCount: commits.length,
        authorDiversity: authors.size,
      };

    } catch (error) {
      console.warn(`Failed to analyze commits for ${owner}/${repo}:`, error);
      return { isAuthentic: false, commitCount: 0, authorDiversity: 0 };
    }
  }

  /**
   * Check for consistent commit activity patterns
   */
  private hasConsistentCommitActivity(commitDates: Date[]): boolean {
    if (commitDates.length < 3) return false;

    // Sort dates
    const sortedDates = commitDates.sort((a, b) => a.getTime() - b.getTime());
    
    // Check if commits are spread over time (not all in one day)
    const firstCommit = sortedDates[0];
    const lastCommit = sortedDates[sortedDates.length - 1];
    
    if (!firstCommit || !lastCommit) return false;
    
    const timeSpan = lastCommit.getTime() - firstCommit.getTime();
    const daySpan = timeSpan / (1000 * 60 * 60 * 24);

    return daySpan >= 1; // At least spread over 1 day
  }

  /**
   * Analyze repository branching patterns
   */
  private async analyzeRepositoryBranches(owner: string, repo: string): Promise<{
    pattern: string;
    branchCount: number;
  }> {
    try {
      const branches: GitHubBranchData[] = await this.makeGitHubRequest(
        `/repos/${owner}/${repo}/branches`
      );

      if (!branches || branches.length === 0) {
        return { pattern: 'no-branches', branchCount: 0 };
      }

      const branchNames = branches.map(b => b.name.toLowerCase());
      const branchCount = branches.length;

      // Analyze branching patterns
      if (branchCount === 1 && (branchNames.includes('main') || branchNames.includes('master'))) {
        return { pattern: 'single-branch', branchCount };
      } else if (branchCount > 1 && branchNames.some(name => 
        name.includes('develop') || name.includes('feature') || name.includes('release')
      )) {
        return { pattern: 'git-flow', branchCount };
      } else if (branchCount > 1) {
        return { pattern: 'multi-branch', branchCount };
      } else {
        return { pattern: 'simple', branchCount };
      }

    } catch (error) {
      console.warn(`Failed to analyze branches for ${owner}/${repo}:`, error);
      return { pattern: 'analysis-failed', branchCount: 0 };
    }
  }

  /**
   * Assess code quality based on repository metrics
   */
  private assessCodeQuality(repository: any, commitAnalysis: any): string {
    let qualityScore = 0;

    // Repository has description
    if (repository.description && repository.description.length > 10) {
      qualityScore += 1;
    }

    // Repository has README (inferred from size > 1KB)
    if (repository.size > 1) {
      qualityScore += 1;
    }

    // Repository has stars or forks (community validation)
    if (repository.stargazers_count > 0 || repository.forks_count > 0) {
      qualityScore += 1;
    }

    // Multiple commits indicate development effort
    if (commitAnalysis.commitCount >= 10) {
      qualityScore += 1;
    }

    // Multiple authors indicate collaboration
    if (commitAnalysis.authorDiversity > 1) {
      qualityScore += 1;
    }

    // Recent activity
    const lastUpdate = new Date(repository.updated_at);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (lastUpdate > threeMonthsAgo) {
      qualityScore += 1;
    }

    // Determine quality level
    if (qualityScore >= 5) return 'excellent';
    if (qualityScore >= 3) return 'good';
    if (qualityScore >= 1) return 'basic';
    return 'poor';
  }

  /**
   * Calculate overall technical score (0-100)
   */
  private calculateTechnicalScore(
    profileStats: GitHubAnalysis['profileStats'],
    skillsEvidence: string[],
    projectAuthenticity: GitHubAnalysis['projectAuthenticity'],
    profileData: GitHubProfileData
  ): number {
    let score = 0;

    // Profile activity scoring (30% of total)
    const repoScore = Math.min(15, (profileStats.publicRepos / 20) * 15); // Max 15 points for 20+ repos
    const followerScore = Math.min(5, (profileStats.followers / 50) * 5); // Max 5 points for 50+ followers
    const streakScore = Math.min(10, (profileStats.contributionStreak / 30) * 10); // Max 10 points for 30+ day streak
    score += repoScore + followerScore + streakScore;

    // Skills evidence scoring (25% of total)
    const skillsScore = Math.min(25, skillsEvidence.length * 3); // 3 points per skill evidence, max 25
    score += skillsScore;

    // Project authenticity scoring (25% of total)
    const authenticProjects = projectAuthenticity.resumeProjects.filter(p => p.isAuthentic).length;
    const totalProjects = projectAuthenticity.resumeProjects.length;
    let authenticityScore = 0;
    
    if (totalProjects > 0) {
      const authenticityRatio = authenticProjects / totalProjects;
      authenticityScore = authenticityRatio * 25;
    } else {
      // No resume projects to verify, give partial credit based on repository quality
      const qualityRepos = profileData.repositories.filter(repo => 
        repo.stargazers_count > 0 || repo.forks_count > 0 || repo.size > 100
      ).length;
      authenticityScore = Math.min(15, qualityRepos * 3); // Reduced score for no verifiable projects
    }
    score += authenticityScore;

    // Code quality and engagement scoring (20% of total)
    const popularRepos = profileData.repositories.filter(repo => 
      repo.stargazers_count >= 5 || repo.forks_count >= 2
    ).length;
    const qualityScore = Math.min(10, popularRepos * 2); // 2 points per popular repo, max 10

    const languageDiversity = new Set(
      profileData.repositories.map(repo => repo.language).filter(Boolean)
    ).size;
    const diversityScore = Math.min(10, languageDiversity * 2); // 2 points per language, max 10

    score += qualityScore + diversityScore;

    return Math.min(100, Math.round(score));
  }

  /**
   * Helper methods
   */
  private isValidGitHubUrl(url: string): boolean {
    const githubRegex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9-_]+\/?([a-zA-Z0-9-_]+\/?)?$/;
    return githubRegex.test(url);
  }

  private extractUsernameFromUrl(url: string): string | null {
    const match = url.match(/github\.com\/([a-zA-Z0-9-_]+)/);
    return match && match[1] ? match[1] : null;
  }

  private extractRepoInfoFromUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([a-zA-Z0-9-_]+)\/([a-zA-Z0-9-_]+)/);
    return match && match[1] && match[2] ? { owner: match[1], repo: match[2] } : null;
  }

  private createFailedAnalysis(candidateId: string, reason: string): GitHubAnalysis {
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test GitHub API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.token) {
      console.warn('GitHub token not configured');
      return false;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
        timeout: 10000,
      });

      return response.status === 200;
    } catch (error) {
      console.warn('GitHub API test failed:', error);
      return false;
    }
  }

  /**
   * Get API rate limit status
   */
  async getRateLimitStatus(): Promise<{ remaining: number; reset: Date } | null> {
    if (!this.token) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/rate_limit`, {
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
    } catch (error) {
      console.warn('Failed to get GitHub rate limit status:', error);
      return null;
    }
  }

  /**
   * Classify error type for recovery purposes
   */
  private classifyError(error: any): string {
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
export const githubAnalysisService = new GitHubAnalysisService();