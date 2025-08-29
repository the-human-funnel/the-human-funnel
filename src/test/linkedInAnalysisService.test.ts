import { LinkedInAnalysisService } from '../services/linkedInAnalysisService';
import { JobProfile } from '../models/interfaces';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock config to provide test API key
jest.mock('../utils/config', () => ({
  config: {
    linkedIn: {
      scraperApiKey: 'test-api-key',
      baseUrl: 'https://api.test-linkedin-scraper.com',
    },
  },
}));

describe('LinkedInAnalysisService', () => {
  let service: LinkedInAnalysisService;
  let mockJobProfile: JobProfile;

  beforeEach(() => {
    service = new LinkedInAnalysisService();
    
    mockJobProfile = {
      id: 'job-123',
      title: 'Senior Software Engineer',
      description: 'Full-stack development role',
      requiredSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS'],
      experienceLevel: 'Senior',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30,
      },
      interviewQuestions: ['Tell me about your experience with React'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('analyzeLinkedInProfile', () => {
    const candidateId = 'candidate-123';
    const validLinkedInUrl = 'https://www.linkedin.com/in/john-doe';

    it('should successfully analyze a LinkedIn profile', async () => {
      const mockProfileData = {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          headline: 'Senior Software Engineer at Tech Corp',
          summary: 'Experienced full-stack developer with 8 years of experience',
          connections: 500,
          followers: 1200,
        },
        experience: [
          {
            title: 'Senior Software Engineer',
            company: 'Tech Corp',
            duration: '3 yrs 2 mos',
            description: 'Led development of React applications using Node.js backend',
          },
          {
            title: 'Software Engineer',
            company: 'StartupXYZ',
            duration: '2 yrs 6 mos',
            description: 'Developed web applications using JavaScript and Python',
          },
        ],
        skills: [
          { name: 'JavaScript', endorsements: 45 },
          { name: 'React', endorsements: 32 },
          { name: 'Node.js', endorsements: 28 },
          { name: 'Python', endorsements: 15 },
        ],
        endorsements: [
          { skill: 'JavaScript', count: 45 },
          { skill: 'React', count: 32 },
        ],
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: mockProfileData,
          rateLimitRemaining: 95,
        },
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.candidateId).toBe(candidateId);
      expect(result.profileAccessible).toBe(true);
      expect(result.professionalScore).toBeGreaterThan(0);
      expect(result.experience.totalYears).toBeGreaterThan(5);
      expect(result.experience.relevantRoles).toBeGreaterThan(0);
      expect(result.network.connections).toBe(500);
      expect(result.credibilityIndicators.length).toBeGreaterThan(0);
    });

    it('should handle invalid LinkedIn URL', async () => {
      const invalidUrl = 'https://invalid-url.com';

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        invalidUrl,
        mockJobProfile
      );

      expect(result.profileAccessible).toBe(false);
      expect(result.professionalScore).toBe(0);
      expect(result.credibilityIndicators[0]).toContain('Invalid or missing LinkedIn URL');
    });

    it('should handle private LinkedIn profile', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { status: 403 },
        isAxiosError: true,
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.profileAccessible).toBe(false);
      expect(result.professionalScore).toBe(0);
      expect(result.credibilityIndicators[0]).toContain('private or access denied');
    });

    it('should handle profile not found', async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: { status: 404 },
        isAxiosError: true,
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.profileAccessible).toBe(false);
      expect(result.professionalScore).toBe(0);
      expect(result.credibilityIndicators[0]).toContain('not found or is private');
    });

    it('should retry on rate limit and succeed', async () => {
      // First call fails with rate limit
      mockedAxios.post
        .mockRejectedValueOnce({
          response: { status: 429 },
          isAxiosError: true,
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              profile: {
                firstName: 'John',
                lastName: 'Doe',
                connections: 100,
              },
              experience: [],
              skills: [],
            },
          },
        });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.profileAccessible).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle API response without success flag', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: false,
          error: 'Profile parsing failed',
        },
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.profileAccessible).toBe(false);
      expect(result.credibilityIndicators[0]).toContain('Profile parsing failed');
    });
  });

  describe('professional scoring algorithm', () => {
    const candidateId = 'candidate-123';
    const validLinkedInUrl = 'https://www.linkedin.com/in/john-doe';

    it('should give higher scores for senior profiles', async () => {
      const seniorProfileData = {
        profile: {
          firstName: 'Senior',
          lastName: 'Developer',
          headline: 'Senior Software Engineer at Google',
          summary: 'Experienced developer with 10+ years',
          connections: 1000,
        },
        experience: [
          {
            title: 'Senior Software Engineer',
            company: 'Google',
            duration: '5 yrs',
            description: 'Led multiple React and Node.js projects',
          },
          {
            title: 'Software Engineer',
            company: 'Microsoft',
            duration: '3 yrs',
            description: 'Developed scalable web applications',
          },
          {
            title: 'Junior Developer',
            company: 'Startup',
            duration: '2 yrs',
            description: 'Built web applications using JavaScript',
          },
        ],
        skills: [
          { name: 'JavaScript', endorsements: 100 },
          { name: 'React', endorsements: 80 },
          { name: 'Node.js', endorsements: 60 },
        ],
        endorsements: [
          { skill: 'JavaScript', count: 100 },
          { skill: 'React', count: 80 },
        ],
        recommendations: [
          { text: 'Excellent developer', recommender: 'Manager' },
        ],
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: seniorProfileData,
        },
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.professionalScore).toBeGreaterThan(70);
      expect(result.experience.totalYears).toBeGreaterThan(9);
      expect(result.experience.relevantRoles).toBeGreaterThan(2);
      expect(result.experience.companyQuality).toBe('top-tier');
    });

    it('should give lower scores for junior profiles', async () => {
      const juniorProfileData = {
        profile: {
          firstName: 'Junior',
          lastName: 'Developer',
          headline: 'Junior Developer',
          connections: 50,
        },
        experience: [
          {
            title: 'Junior Developer',
            company: 'Small Company',
            duration: '1 yr',
            description: 'Learning web development',
          },
        ],
        skills: [
          { name: 'HTML', endorsements: 5 },
          { name: 'CSS', endorsements: 3 },
        ],
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: juniorProfileData,
        },
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.professionalScore).toBeLessThan(40);
      expect(result.experience.totalYears).toBeLessThan(2);
      expect(result.network.connections).toBe(50);
    });

    it('should identify relevant roles correctly', async () => {
      const profileWithRelevantRoles = {
        profile: {
          firstName: 'Relevant',
          lastName: 'Candidate',
          connections: 300,
        },
        experience: [
          {
            title: 'React Developer',
            company: 'Tech Startup',
            duration: '2 yrs',
            description: 'Built React applications with Node.js backend',
          },
          {
            title: 'Python Developer',
            company: 'Data Corp',
            duration: '1 yr 6 mos',
            description: 'Developed Python applications and AWS integrations',
          },
          {
            title: 'Marketing Manager',
            company: 'Non-Tech Corp',
            duration: '1 yr',
            description: 'Managed marketing campaigns',
          },
        ],
        skills: [
          { name: 'React', endorsements: 25 },
          { name: 'Python', endorsements: 20 },
        ],
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: profileWithRelevantRoles,
        },
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      // Should identify 2 relevant roles (React Developer and Python Developer)
      expect(result.experience.relevantRoles).toBe(2);
    });
  });

  describe('error handling and edge cases', () => {
    const candidateId = 'candidate-123';
    const validLinkedInUrl = 'https://www.linkedin.com/in/john-doe';

    it('should handle network timeout', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('timeout'));

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.profileAccessible).toBe(false);
      expect(result.credibilityIndicators[0]).toContain('timeout');
    });

    it('should handle malformed API response', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: null, // Malformed response
        },
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.profileAccessible).toBe(false);
      expect(result.credibilityIndicators[0]).toContain('No profile data returned');
    });

    it('should handle empty profile data', async () => {
      const emptyProfileData = {
        profile: {},
        experience: [],
        skills: [],
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          data: emptyProfileData,
        },
      });

      const result = await service.analyzeLinkedInProfile(
        candidateId,
        validLinkedInUrl,
        mockJobProfile
      );

      expect(result.profileAccessible).toBe(true);
      expect(result.professionalScore).toBeLessThan(20);
      expect(result.experience.totalYears).toBe(0);
      expect(result.network.connections).toBe(0);
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 200 });

      const result = await service.testConnection();

      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('getApiUsage', () => {
    it('should return usage statistics', async () => {
      const mockUsage = {
        rateLimitRemaining: 85,
        rateLimitReset: Date.now() + 3600000,
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockUsage,
      });

      const result = await service.getApiUsage();

      expect(result).toEqual({
        remaining: 85,
        reset: expect.any(Date),
      });
    });

    it('should return null on error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      const result = await service.getApiUsage();

      expect(result).toBeNull();
    });
  });
});