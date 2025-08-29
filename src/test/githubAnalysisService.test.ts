import { GitHubAnalysisService } from '../services/githubAnalysisService';
import { JobProfile } from '../models/interfaces';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config
jest.mock('../utils/config', () => ({
  config: {
    github: {
      token: 'test-github-token',
    },
  },
}));

describe('GitHubAnalysisService', () => {
  let service: GitHubAnalysisService;
  let mockJobProfile: JobProfile;

  beforeEach(() => {
    service = new GitHubAnalysisService();
    mockJobProfile = {
      id: 'job-1',
      title: 'Senior Software Engineer',
      description: 'Looking for a senior software engineer',
      requiredSkills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
      experienceLevel: 'Senior',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30,
      },
      interviewQuestions: ['Tell me about your experience'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('analyzeGitHubProfile', () => {
    const candidateId = 'candidate-123';
    const githubUrl = 'https://github.com/testuser';

    it('should successfully analyze a GitHub profile', async () => {
      // Mock GitHub API responses
      const mockProfile = {
        login: 'testuser',
        id: 12345,
        name: 'Test User',
        public_repos: 25,
        followers: 150,
        following: 100,
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockRepositories = [
        {
          id: 1,
          name: 'react-app',
          full_name: 'testuser/react-app',
          description: 'A React application',
          language: 'JavaScript',
          stargazers_count: 10,
          forks_count: 5,
          size: 1000,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          pushed_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 2,
          name: 'node-api',
          full_name: 'testuser/node-api',
          description: 'Node.js API server',
          language: 'TypeScript',
          stargazers_count: 5,
          forks_count: 2,
          size: 800,
          created_at: '2023-06-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          pushed_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockEvents = [
        {
          type: 'PushEvent',
          created_at: '2024-01-01T00:00:00Z',
          repo: { name: 'testuser/react-app' },
        },
        {
          type: 'PushEvent',
          created_at: '2023-12-31T00:00:00Z',
          repo: { name: 'testuser/node-api' },
        },
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockProfile, headers: { 'x-ratelimit-remaining': '4999' } })
        .mockResolvedValueOnce({ data: mockRepositories, headers: { 'x-ratelimit-remaining': '4998' } })
        .mockResolvedValueOnce({ data: mockEvents, headers: { 'x-ratelimit-remaining': '4997' } });

      const result = await service.analyzeGitHubProfile(candidateId, githubUrl, mockJobProfile);

      expect(result.candidateId).toBe(candidateId);
      expect(result.profileStats.publicRepos).toBe(25);
      expect(result.profileStats.followers).toBe(150);
      expect(result.technicalScore).toBeGreaterThan(0);
      expect(result.skillsEvidence).toContain('1 repositories using javascript');
      expect(result.skillsEvidence).toContain('1 repositories using typescript');
    });

    it('should handle invalid GitHub URL', async () => {
      const invalidUrl = 'https://invalid-url.com/user';

      const result = await service.analyzeGitHubProfile(candidateId, invalidUrl, mockJobProfile);

      expect(result.candidateId).toBe(candidateId);
      expect(result.technicalScore).toBe(0);
      expect(result.skillsEvidence).toContain('Analysis failed: Invalid or missing GitHub URL');
    });

    it('should handle GitHub API errors', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 404 },
        isAxiosError: true,
      });

      const result = await service.analyzeGitHubProfile(candidateId, githubUrl, mockJobProfile);

      expect(result.candidateId).toBe(candidateId);
      expect(result.technicalScore).toBe(0);
      expect(result.skillsEvidence).toContain('Analysis failed: GitHub profile not found or is private');
    }, 10000);

    it('should handle rate limiting', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { 
          status: 403,
          headers: { 'x-ratelimit-reset': '1640995200' }
        },
        isAxiosError: true,
      });

      const result = await service.analyzeGitHubProfile(candidateId, githubUrl, mockJobProfile);

      expect(result.candidateId).toBe(candidateId);
      expect(result.technicalScore).toBe(0);
      expect(result.skillsEvidence[0]).toContain('GitHub API rate limit exceeded');
    }, 10000);

    it('should analyze project authenticity from resume URLs', async () => {
      const resumeProjectUrls = ['https://github.com/testuser/my-project'];
      
      // Mock profile and repositories
      const mockProfile = {
        login: 'testuser',
        id: 12345,
        public_repos: 5,
        followers: 10,
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockRepositories = [
        {
          id: 1,
          name: 'my-project',
          full_name: 'testuser/my-project',
          description: 'My awesome project',
          language: 'JavaScript',
          stargazers_count: 15,
          forks_count: 3,
          size: 2000,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          pushed_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockEvents: any[] = [];

      // Mock commits for authenticity analysis
      const mockCommits = [
        {
          sha: 'abc123',
          commit: {
            author: { name: 'Test User', email: 'test@example.com', date: '2023-01-01T00:00:00Z' },
            committer: { name: 'Test User', email: 'test@example.com', date: '2023-01-01T00:00:00Z' },
            message: 'Initial commit with project setup',
          },
        },
        {
          sha: 'def456',
          commit: {
            author: { name: 'Test User', email: 'test@example.com', date: '2023-01-02T00:00:00Z' },
            committer: { name: 'Test User', email: 'test@example.com', date: '2023-01-02T00:00:00Z' },
            message: 'Add authentication feature',
          },
        },
        {
          sha: 'ghi789',
          commit: {
            author: { name: 'Test User', email: 'test@example.com', date: '2023-01-03T00:00:00Z' },
            committer: { name: 'Test User', email: 'test@example.com', date: '2023-01-03T00:00:00Z' },
            message: 'Fix bug in user registration',
          },
        },
      ];

      const mockBranches = [
        { name: 'main', commit: { sha: 'abc123' }, protected: false },
        { name: 'develop', commit: { sha: 'def456' }, protected: false },
      ];

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockProfile, headers: { 'x-ratelimit-remaining': '4999' } })
        .mockResolvedValueOnce({ data: mockRepositories, headers: { 'x-ratelimit-remaining': '4998' } })
        .mockResolvedValueOnce({ data: mockEvents, headers: { 'x-ratelimit-remaining': '4997' } })
        .mockResolvedValueOnce({ data: mockCommits, headers: { 'x-ratelimit-remaining': '4996' } })
        .mockResolvedValueOnce({ data: mockBranches, headers: { 'x-ratelimit-remaining': '4995' } });

      const result = await service.analyzeGitHubProfile(
        candidateId, 
        githubUrl, 
        mockJobProfile, 
        resumeProjectUrls
      );

      expect(result.projectAuthenticity.resumeProjects).toHaveLength(1);
      const firstProject = result.projectAuthenticity.resumeProjects[0];
      expect(firstProject?.url).toBe(resumeProjectUrls[0]);
      expect(firstProject?.isAuthentic).toBe(false); // Will be false because commit analysis shows low authenticity score
      expect(firstProject?.commitHistory).toBe(3);
      expect(firstProject?.branchingPattern).toBe('multi-branch');
      expect(firstProject?.codeQuality).toBe('excellent');
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'token test-github-token',
          }),
        })
      );
    });

    it('should return false for failed connection', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return rate limit information', async () => {
      const mockRateLimit = {
        rate: {
          remaining: 4500,
          reset: 1640995200,
        },
      };

      mockedAxios.get.mockResolvedValueOnce({ data: mockRateLimit });

      const result = await service.getRateLimitStatus();

      expect(result).toEqual({
        remaining: 4500,
        reset: new Date(1640995200 * 1000),
      });
    });

    it('should return null on error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      const result = await service.getRateLimitStatus();

      expect(result).toBeNull();
    });
  });

  describe('URL validation and extraction', () => {
    it('should validate GitHub URLs correctly', () => {
      const validUrls = [
        'https://github.com/username',
        'https://github.com/username/',
        'https://github.com/username/repository',
        'http://github.com/user-name',
        'https://www.github.com/user_name',
      ];

      const invalidUrls = [
        'https://gitlab.com/username',
        'https://github.com/',
        'https://github.com/username/repo/issues',
        'not-a-url',
        '',
      ];

      validUrls.forEach(url => {
        // Access private method through any type casting for testing
        const isValid = (service as any).isValidGitHubUrl(url);
        expect(isValid).toBe(true);
      });

      invalidUrls.forEach(url => {
        const isValid = (service as any).isValidGitHubUrl(url);
        expect(isValid).toBe(false);
      });
    });

    it('should extract username from GitHub URL', () => {
      const testCases = [
        { url: 'https://github.com/testuser', expected: 'testuser' },
        { url: 'https://github.com/test-user/', expected: 'test-user' },
        { url: 'https://github.com/test_user/repo', expected: 'test_user' },
        { url: 'invalid-url', expected: null },
      ];

      testCases.forEach(({ url, expected }) => {
        const username = (service as any).extractUsernameFromUrl(url);
        expect(username).toBe(expected);
      });
    });

    it('should extract repository info from GitHub URL', () => {
      const testCases = [
        { 
          url: 'https://github.com/owner/repo', 
          expected: { owner: 'owner', repo: 'repo' } 
        },
        { 
          url: 'https://github.com/test-owner/test-repo/', 
          expected: { owner: 'test-owner', repo: 'test-repo' } 
        },
        { 
          url: 'https://github.com/username', 
          expected: null 
        },
        { 
          url: 'invalid-url', 
          expected: null 
        },
      ];

      testCases.forEach(({ url, expected }) => {
        const repoInfo = (service as any).extractRepoInfoFromUrl(url);
        expect(repoInfo).toEqual(expected);
      });
    });
  });

  describe('scoring calculations', () => {
    it('should calculate technical score correctly', () => {
      const profileStats = {
        publicRepos: 20,
        followers: 50,
        contributionStreak: 30,
        totalCommits: 500,
      };

      const skillsEvidence = [
        '5 repositories using javascript',
        '3 repositories using typescript',
        '2 repositories using react',
        'Experience with node.js (from repository analysis)',
      ];

      const projectAuthenticity = {
        resumeProjects: [
          {
            url: 'https://github.com/user/project1',
            isAuthentic: true,
            commitHistory: 25,
            branchingPattern: 'git-flow',
            codeQuality: 'excellent',
          },
          {
            url: 'https://github.com/user/project2',
            isAuthentic: true,
            commitHistory: 15,
            branchingPattern: 'multi-branch',
            codeQuality: 'good',
          },
        ],
      };

      const mockProfileData = {
        profile: {},
        repositories: [
          { stargazers_count: 10, forks_count: 5, language: 'JavaScript', size: 1000 },
          { stargazers_count: 5, forks_count: 2, language: 'TypeScript', size: 800 },
          { stargazers_count: 0, forks_count: 0, language: 'Python', size: 500 },
        ],
        events: [],
      };

      const score = (service as any).calculateTechnicalScore(
        profileStats,
        skillsEvidence,
        projectAuthenticity,
        mockProfileData
      );

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(typeof score).toBe('number');
    });

    it('should handle empty data gracefully', () => {
      const emptyProfileStats = {
        publicRepos: 0,
        followers: 0,
        contributionStreak: 0,
        totalCommits: 0,
      };

      const emptySkillsEvidence: string[] = [];
      const emptyProjectAuthenticity = { resumeProjects: [] };
      const emptyProfileData = { profile: {}, repositories: [], events: [] };

      const score = (service as any).calculateTechnicalScore(
        emptyProfileStats,
        emptySkillsEvidence,
        emptyProjectAuthenticity,
        emptyProfileData
      );

      expect(score).toBe(0);
    });
  });

  describe('contribution streak calculation', () => {
    it('should calculate contribution streak correctly', () => {
      const events = [
        { type: 'PushEvent', created_at: '2024-01-03T00:00:00Z' },
        { type: 'PushEvent', created_at: '2024-01-02T00:00:00Z' },
        { type: 'PushEvent', created_at: '2024-01-01T00:00:00Z' },
        { type: 'IssueEvent', created_at: '2023-12-31T00:00:00Z' }, // Non-push event
      ];

      // Mock current date to be 2024-01-03 for consistent testing
      const mockDate = new Date('2024-01-03T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const streak = (service as any).calculateContributionStreak(events);

      expect(streak).toBeGreaterThan(0);

      // Restore Date
      (global.Date as any).mockRestore();
    });

    it('should return 0 for no push events', () => {
      const events = [
        { type: 'IssueEvent', created_at: '2024-01-01T00:00:00Z' },
        { type: 'WatchEvent', created_at: '2024-01-02T00:00:00Z' },
      ];

      const streak = (service as any).calculateContributionStreak(events);

      expect(streak).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle missing GitHub token', async () => {
      // Create service with no token by mocking config
      const originalConfig = require('../utils/config').config;
      
      // Temporarily override the config
      jest.doMock('../utils/config', () => ({
        config: {
          ...originalConfig,
          github: {
            token: '',
          },
        },
      }));

      // Re-import the service class to get the new config
      const { GitHubAnalysisService: ServiceWithNoToken } = require('../services/githubAnalysisService');
      const serviceNoToken = new ServiceWithNoToken();
      
      const result = await serviceNoToken.analyzeGitHubProfile(
        'candidate-123',
        'https://github.com/testuser',
        mockJobProfile
      );
      
      expect(result.technicalScore).toBe(0);
      expect(result.skillsEvidence).toContain('Analysis failed: GitHub token not configured');
    });

    it('should retry on network errors', async () => {
      // Mock network error followed by success
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ 
          data: { login: 'testuser', public_repos: 5, followers: 10 }, 
          headers: { 'x-ratelimit-remaining': '4999' } 
        })
        .mockResolvedValueOnce({ 
          data: [], 
          headers: { 'x-ratelimit-remaining': '4998' } 
        })
        .mockResolvedValueOnce({ 
          data: [], 
          headers: { 'x-ratelimit-remaining': '4997' } 
        });

      const result = await service.analyzeGitHubProfile(
        'candidate-123',
        'https://github.com/testuser',
        mockJobProfile
      );

      expect(result.candidateId).toBe('candidate-123');
      expect(result.profileStats.publicRepos).toBe(5);
      expect(mockedAxios.get).toHaveBeenCalledTimes(5); // 2 retries + 1 success + 2 more calls
    }, 10000);
  });
});