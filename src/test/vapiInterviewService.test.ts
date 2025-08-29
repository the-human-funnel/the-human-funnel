import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import axios from 'axios';
import { VAPIInterviewService } from '../services/vapiInterviewService';
import { Candidate, JobProfile, InterviewSession } from '../models/interfaces';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.isAxiosError
const mockIsAxiosError = jest.fn();
(axios as any).isAxiosError = mockIsAxiosError;

// Mock config
jest.mock('../utils/config', () => ({
  config: {
    vapi: {
      apiKey: 'test-vapi-key',
      baseUrl: 'https://api.vapi.ai',
    },
  },
}));

describe('VAPIInterviewService', () => {
  let vapiService: VAPIInterviewService;
  let mockCandidate: Candidate;
  let mockJobProfile: JobProfile;

  beforeEach(() => {
    vapiService = new VAPIInterviewService();
    
    // Reset all mocks
    jest.clearAllMocks();

    // Mock candidate data
    mockCandidate = {
      id: 'candidate-123',
      resumeData: {
        id: 'resume-123',
        fileName: 'john-doe-resume.pdf',
        extractedText: 'Experienced software engineer with 5 years in full-stack development...',
        contactInfo: {
          phone: '+1-555-123-4567',
          email: 'john.doe@example.com',
          linkedInUrl: 'https://linkedin.com/in/johndoe',
          githubUrl: 'https://github.com/johndoe',
          projectUrls: ['https://github.com/johndoe/awesome-project'],
        },
        processingStatus: 'completed',
      },
      aiAnalysis: {
        candidateId: 'candidate-123',
        provider: 'gemini',
        relevanceScore: 85,
        skillsMatch: {
          matched: ['JavaScript', 'React', 'Node.js'],
          missing: ['Python', 'AWS'],
        },
        experienceAssessment: 'Strong full-stack development experience',
        reasoning: 'Candidate shows excellent technical skills and relevant experience',
        confidence: 90,
      },
      processingStage: 'interview',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    // Mock job profile data
    mockJobProfile = {
      id: 'job-456',
      title: 'Senior Full-Stack Developer',
      description: 'We are looking for an experienced full-stack developer...',
      requiredSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'AWS'],
      experienceLevel: 'Senior',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30,
      },
      interviewQuestions: [
        'Can you describe your experience with microservices architecture?',
        'How do you handle state management in large React applications?',
        'Tell me about a time you optimized application performance.',
      ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('scheduleInterview', () => {
    it('should successfully schedule an interview', async () => {
      const mockVAPIResponse = {
        id: 'vapi-call-789',
        status: 'queued',
        phoneNumber: '+15551234567',
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockVAPIResponse,
        status: 200,
      });

      const result = await vapiService.scheduleInterview(
        mockCandidate,
        mockJobProfile,
        '+1-555-123-4567'
      );

      expect(result).toEqual({
        candidateId: 'candidate-123',
        jobProfileId: 'job-456',
        vapiCallId: 'vapi-call-789',
        scheduledAt: expect.any(Date),
        status: 'scheduled',
        callQuality: 'good',
        retryCount: 0,
      });

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.vapi.ai/call',
        expect.objectContaining({
          phoneNumber: '+15551234567',
          assistant: expect.objectContaining({
            model: {
              provider: 'openai',
              model: 'gpt-4',
              temperature: 0.3,
            },
            voice: {
              provider: 'elevenlabs',
              voiceId: 'pNInz6obpgDQGcFmaJgB',
            },
            recordingEnabled: true,
            maxDurationSeconds: 1800,
          }),
          metadata: {
            jobProfileId: 'job-456',
            jobTitle: 'Senior Full-Stack Developer',
            interviewType: 'screening',
          },
        }),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-vapi-key',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        })
      );
    });

    it('should throw error for invalid phone number', async () => {
      await expect(
        vapiService.scheduleInterview(mockCandidate, mockJobProfile, 'invalid-phone')
      ).rejects.toThrow('Invalid or missing phone number');

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should handle VAPI API errors', async () => {
      const axiosError = {
        response: {
          status: 400,
          data: { message: 'Invalid request' },
        },
      };
      
      mockIsAxiosError.mockReturnValueOnce(true);
      mockedAxios.post.mockRejectedValueOnce(axiosError);

      await expect(
        vapiService.scheduleInterview(mockCandidate, mockJobProfile, '+1-555-123-4567')
      ).rejects.toThrow('Invalid call request: Invalid request');
    });

    it('should retry on rate limit errors', async () => {
      // First call fails with rate limit
      mockIsAxiosError.mockReturnValueOnce(true);
      mockedAxios.post
        .mockRejectedValueOnce({
          response: { status: 429 },
        })
        .mockResolvedValueOnce({
          data: { id: 'vapi-call-789', status: 'queued' },
          status: 200,
        });

      // Mock delay function
      const delaySpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
        if (typeof callback === 'function') {
          callback();
        }
        return {} as NodeJS.Timeout;
      });

      const result = await vapiService.scheduleInterview(
        mockCandidate,
        mockJobProfile,
        '+1-555-123-4567'
      );

      expect(result.vapiCallId).toBe('vapi-call-789');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);

      delaySpy.mockRestore();
    });
  });

  describe('getCallStatus', () => {
    it('should successfully get call status', async () => {
      const mockCallData = {
        id: 'vapi-call-789',
        status: 'completed',
        phoneNumber: '+15551234567',
        startedAt: '2024-01-01T10:00:00Z',
        endedAt: '2024-01-01T10:15:00Z',
        duration: 900,
        transcript: 'Hello, this is the interview transcript...',
        endedReason: 'customer-ended-call',
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: mockCallData,
        status: 200,
      });

      const result = await vapiService.getCallStatus('vapi-call-789');

      expect(result).toEqual(mockCallData);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.vapi.ai/call/vapi-call-789',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-vapi-key',
          },
          timeout: 10000,
        })
      );
    });

    it('should handle API errors when getting call status', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(vapiService.getCallStatus('vapi-call-789')).rejects.toThrow('Network error');
    });
  });

  describe('updateInterviewSession', () => {
    it('should update session status based on VAPI call data', async () => {
      const mockSession: InterviewSession = {
        candidateId: 'candidate-123',
        jobProfileId: 'job-456',
        vapiCallId: 'vapi-call-789',
        scheduledAt: new Date(),
        status: 'in-progress',
        callQuality: 'good',
        retryCount: 0,
      };

      const mockCallData = {
        id: 'vapi-call-789',
        status: 'ended' as const,
        phoneNumber: '+15551234567',
        duration: 900,
        transcript: 'Interview transcript here. This is a longer transcript that should be over 100 characters to meet the quality threshold for excellent call quality assessment. The candidate discussed their experience with various technologies and provided detailed answers to all questions.',
        endedReason: 'customer-ended-call' as const,
      };

      const result = await vapiService.updateInterviewSession(mockSession, mockCallData);

      expect(result).toEqual({
        ...mockSession,
        status: 'completed',
        transcript: 'Interview transcript here. This is a longer transcript that should be over 100 characters to meet the quality threshold for excellent call quality assessment. The candidate discussed their experience with various technologies and provided detailed answers to all questions.',
        duration: 900,
        callQuality: 'excellent',
      });
    });

    it('should handle no-answer scenarios', async () => {
      const mockSession: InterviewSession = {
        candidateId: 'candidate-123',
        jobProfileId: 'job-456',
        vapiCallId: 'vapi-call-789',
        scheduledAt: new Date(),
        status: 'scheduled',
        callQuality: 'good',
        retryCount: 0,
      };

      const mockCallData = {
        id: 'vapi-call-789',
        status: 'ended' as const,
        phoneNumber: '+15551234567',
        duration: 0,
        endedReason: 'no-answer' as const,
      };

      const result = await vapiService.updateInterviewSession(mockSession, mockCallData);

      expect(result.status).toBe('no-answer');
      expect(result.callQuality).toBe('poor');
    });
  });

  describe('retryInterview', () => {
    it('should successfully retry an interview', async () => {
      const mockSession: InterviewSession = {
        candidateId: 'candidate-123',
        jobProfileId: 'job-456',
        vapiCallId: 'vapi-call-789',
        scheduledAt: new Date(),
        status: 'no-answer',
        callQuality: 'poor',
        retryCount: 1,
      };

      const mockVAPIResponse = {
        id: 'vapi-call-retry-999',
        status: 'queued',
        phoneNumber: '+15551234567',
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: mockVAPIResponse,
        status: 200,
      });

      const result = await vapiService.retryInterview(
        mockSession,
        mockCandidate,
        mockJobProfile,
        '+1-555-123-4567'
      );

      expect(result).toEqual({
        ...mockSession,
        vapiCallId: 'vapi-call-retry-999',
        scheduledAt: expect.any(Date),
        status: 'scheduled',
        retryCount: 2,
        transcript: undefined,
        duration: undefined,
      });
    });

    it('should throw error when max retries reached', async () => {
      const mockSession: InterviewSession = {
        candidateId: 'candidate-123',
        jobProfileId: 'job-456',
        vapiCallId: 'vapi-call-789',
        scheduledAt: new Date(),
        status: 'no-answer',
        callQuality: 'poor',
        retryCount: 2,
      };

      await expect(
        vapiService.retryInterview(mockSession, mockCandidate, mockJobProfile, '+1-555-123-4567')
      ).rejects.toThrow('Maximum retry attempts reached for interview');

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('processWebhook', () => {
    it('should process status update webhook', async () => {
      const mockWebhook = {
        message: {
          type: 'status-update' as const,
          call: {
            id: 'vapi-call-789',
            status: 'in-progress' as const,
            phoneNumber: '+15551234567',
          },
          timestamp: '2024-01-01T10:00:00Z',
        },
      };

      // Mock console.log to avoid output during tests
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await vapiService.processWebhook(mockWebhook);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Processing VAPI webhook for call vapi-call-789, type: status-update'
      );

      consoleSpy.mockRestore();
    });

    it('should process call end webhook', async () => {
      const mockWebhook = {
        message: {
          type: 'hang' as const,
          call: {
            id: 'vapi-call-789',
            status: 'ended' as const,
            phoneNumber: '+15551234567',
            duration: 900,
            endedReason: 'customer-ended-call' as const,
          },
          timestamp: '2024-01-01T10:15:00Z',
        },
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await vapiService.processWebhook(mockWebhook);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Call vapi-call-789 ended. Reason: customer-ended-call, Duration: 900s'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { success: true },
      });

      const result = await vapiService.testConnection();

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.vapi.ai/account',
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-vapi-key',
          },
          timeout: 10000,
        })
      );
    });

    it('should return false for failed connection', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Connection failed'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await vapiService.testConnection();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('VAPI API test failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('getAccountInfo', () => {
    it('should return account information', async () => {
      const mockAccountData = {
        credits: 1000,
        callsThisMonth: 25,
      };

      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: mockAccountData,
      });

      const result = await vapiService.getAccountInfo();

      expect(result).toEqual({
        credits: 1000,
        callsThisMonth: 25,
      });
    });

    it('should return null on error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('API error'));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await vapiService.getAccountInfo();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to get VAPI account info:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('phone number validation and formatting', () => {
    it('should format US phone numbers correctly', async () => {
      const testCases = [
        { input: '555-123-4567', expected: '+15551234567' },
        { input: '(555) 123-4567', expected: '+15551234567' },
        { input: '1-555-123-4567', expected: '+15551234567' },
        { input: '+1-555-123-4567', expected: '+15551234567' },
      ];

      const mockVAPIResponse = {
        id: 'vapi-call-test',
        status: 'queued',
        phoneNumber: '+15551234567',
      };

      for (const testCase of testCases) {
        mockedAxios.post.mockResolvedValueOnce({
          data: mockVAPIResponse,
          status: 200,
        });

        await vapiService.scheduleInterview(mockCandidate, mockJobProfile, testCase.input);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            phoneNumber: testCase.expected,
          }),
          expect.any(Object)
        );

        jest.clearAllMocks();
      }
    });

    it('should reject invalid phone numbers', async () => {
      const invalidNumbers = ['123', 'abc-def-ghij', '555-123', ''];

      for (const invalidNumber of invalidNumbers) {
        await expect(
          vapiService.scheduleInterview(mockCandidate, mockJobProfile, invalidNumber)
        ).rejects.toThrow('Invalid or missing phone number');
      }
    });
  });

  describe('question generation', () => {
    it('should generate appropriate questions for senior level', async () => {
      const seniorJobProfile = {
        ...mockJobProfile,
        experienceLevel: 'Senior',
        requiredSkills: ['JavaScript', 'React', 'Node.js', 'AWS'],
      };

      // We can't directly test the private method, but we can test the behavior
      // by checking the system message in the call request
      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 'test-call', status: 'queued' },
        status: 200,
      });

      await vapiService.scheduleInterview(mockCandidate, seniorJobProfile, '+1-555-123-4567');

      const callArgs = mockedAxios.post.mock.calls[0];
      if (callArgs && callArgs[1]) {
        const callRequest = callArgs[1] as any;
        
        expect(callRequest.assistant.systemMessage).toContain('Senior Full-Stack Developer');
        expect(callRequest.assistant.systemMessage).toContain('JavaScript, React, Node.js, AWS');
        expect(callRequest.assistant.systemMessage).toContain('mentor junior team members');
      }
    });

    it('should generate appropriate questions for entry level', async () => {
      const entryJobProfile = {
        ...mockJobProfile,
        experienceLevel: 'Entry',
        title: 'Junior Developer',
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { id: 'test-call', status: 'queued' },
        status: 200,
      });

      await vapiService.scheduleInterview(mockCandidate, entryJobProfile, '+1-555-123-4567');

      const callArgs = mockedAxios.post.mock.calls[0];
      if (callArgs && callArgs[1]) {
        const callRequest = callArgs[1] as any;
        
        expect(callRequest.assistant.systemMessage).toContain('Junior Developer');
        expect(callRequest.assistant.systemMessage).toContain('interests you most about this role');
      }
    });
  });
});