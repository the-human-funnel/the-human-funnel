import { ReportGenerationService } from '../services/reportGenerationService';
import { 
  Candidate, 
  JobProfile, 
  ProcessingBatch,
  ResumeData,
  AIAnalysisResult,
  LinkedInAnalysis,
  GitHubAnalysis,
  InterviewSession,
  CandidateScore,
  InterviewAnalysisResult
} from '../models/interfaces';
import fs from 'fs/promises';
import path from 'path';

describe('ReportGenerationService', () => {
  let reportService: ReportGenerationService;
  let mockCandidate: Candidate;
  let mockJobProfile: JobProfile;
  let mockBatch: ProcessingBatch;
  let mockInterviewAnalysis: InterviewAnalysisResult;

  beforeEach(() => {
    reportService = new ReportGenerationService();

    // Mock resume data
    const mockResumeData: ResumeData = {
      id: 'resume-1',
      fileName: 'john_doe_resume.pdf',
      extractedText: 'Software Engineer with 5 years experience...',
      contactInfo: {
        phone: '+1-555-0123',
        email: 'john.doe@email.com',
        linkedInUrl: 'https://linkedin.com/in/johndoe',
        githubUrl: 'https://github.com/johndoe',
        projectUrls: ['https://github.com/johndoe/project1']
      },
      processingStatus: 'completed'
    };

    // Mock AI analysis
    const mockAIAnalysis: AIAnalysisResult = {
      candidateId: 'candidate-1',
      provider: 'gemini',
      relevanceScore: 85,
      skillsMatch: {
        matched: ['JavaScript', 'React', 'Node.js'],
        missing: ['Python', 'Docker']
      },
      experienceAssessment: 'Strong mid-level experience',
      reasoning: 'Candidate shows strong technical skills',
      confidence: 90
    };

    // Mock LinkedIn analysis
    const mockLinkedInAnalysis: LinkedInAnalysis = {
      candidateId: 'candidate-1',
      profileAccessible: true,
      professionalScore: 78,
      experience: {
        totalYears: 5,
        relevantRoles: 3,
        companyQuality: 'High'
      },
      network: {
        connections: 500,
        endorsements: 25
      },
      credibilityIndicators: ['Verified profile', 'Active engagement']
    };

    // Mock GitHub analysis
    const mockGitHubAnalysis: GitHubAnalysis = {
      candidateId: 'candidate-1',
      profileStats: {
        publicRepos: 15,
        followers: 50,
        contributionStreak: 120,
        totalCommits: 500
      },
      technicalScore: 82,
      projectAuthenticity: {
        resumeProjects: [{
          url: 'https://github.com/johndoe/project1',
          isAuthentic: true,
          commitHistory: 45,
          branchingPattern: 'feature-based',
          codeQuality: 'good'
        }]
      },
      skillsEvidence: ['JavaScript', 'React', 'Node.js']
    };

    // Mock interview session
    const mockInterviewSession: InterviewSession = {
      candidateId: 'candidate-1',
      jobProfileId: 'job-1',
      vapiCallId: 'call-123',
      scheduledAt: new Date('2024-01-15T10:00:00Z'),
      status: 'completed',
      transcript: 'Interview transcript...',
      duration: 30,
      callQuality: 'good',
      retryCount: 0
    };

    // Mock candidate score
    const mockCandidateScore: CandidateScore = {
      candidateId: 'candidate-1',
      jobProfileId: 'job-1',
      compositeScore: 81.5,
      stageScores: {
        resumeAnalysis: 85,
        linkedInAnalysis: 78,
        githubAnalysis: 82,
        interviewPerformance: 80
      },
      appliedWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30
      },
      rank: 1,
      recommendation: 'hire',
      reasoning: 'Strong candidate with good technical and communication skills'
    };

    // Mock complete candidate
    mockCandidate = {
      id: 'candidate-1',
      resumeData: mockResumeData,
      aiAnalysis: mockAIAnalysis,
      linkedInAnalysis: mockLinkedInAnalysis,
      githubAnalysis: mockGitHubAnalysis,
      interviewSession: mockInterviewSession,
      finalScore: mockCandidateScore,
      processingStage: 'completed',
      createdAt: new Date('2024-01-10T09:00:00Z'),
      updatedAt: new Date('2024-01-15T15:00:00Z')
    };

    // Mock job profile
    mockJobProfile = {
      id: 'job-1',
      title: 'Senior Software Engineer',
      description: 'Looking for experienced software engineer',
      requiredSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'Docker'],
      experienceLevel: 'Senior',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30
      },
      interviewQuestions: ['Tell me about your experience', 'Describe a challenging project'],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T00:00:00Z')
    };

    // Mock processing batch
    mockBatch = {
      id: 'batch-1',
      jobProfileId: 'job-1',
      totalCandidates: 10,
      processedCandidates: 8,
      failedCandidates: 2,
      status: 'completed',
      startedAt: new Date('2024-01-10T08:00:00Z'),
      completedAt: new Date('2024-01-15T16:00:00Z'),
      candidateIds: ['candidate-1', 'candidate-2']
    };

    // Mock interview analysis
    mockInterviewAnalysis = {
      candidateId: 'candidate-1',
      interviewSessionId: 'session-1',
      provider: 'gemini',
      performanceScore: 80,
      communicationScore: 85,
      technicalScore: 75,
      competencyScores: {
        'problem-solving': 80,
        'technical-knowledge': 75,
        'communication': 85
      },
      transcriptQuality: 'good',
      needsManualReview: false,
      detailedFeedback: {
        strengths: ['Clear communication', 'Good problem-solving approach'],
        weaknesses: ['Could improve technical depth'],
        recommendations: ['Practice more complex algorithms']
      },
      responseAnalysis: [{
        question: 'Tell me about your experience',
        response: 'I have 5 years of experience...',
        score: 80,
        feedback: 'Good overview of experience'
      }],
      overallAssessment: 'Strong candidate with good communication skills',
      confidence: 85,
      analysisTimestamp: new Date('2024-01-15T14:00:00Z')
    };
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      const files = await fs.readdir(reportsDir);
      for (const file of files) {
        if (file.includes('test') || file.includes(Date.now().toString().slice(0, 8))) {
          await fs.unlink(path.join(reportsDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('generateCandidateReport', () => {
    it('should generate a complete candidate report', async () => {
      const report = await reportService.generateCandidateReport(
        mockCandidate, 
        mockJobProfile, 
        mockInterviewAnalysis
      );

      expect(report).toBeDefined();
      expect(report.candidate).toEqual(mockCandidate);
      expect(report.jobProfile).toEqual(mockJobProfile);
      expect(report.completionStatus.resumeProcessed).toBe(true);
      expect(report.completionStatus.aiAnalysisCompleted).toBe(true);
      expect(report.completionStatus.linkedInAnalysisCompleted).toBe(true);
      expect(report.completionStatus.githubAnalysisCompleted).toBe(true);
      expect(report.completionStatus.interviewCompleted).toBe(true);
      expect(report.completionStatus.scoringCompleted).toBe(true);
      expect(report.reportGeneratedAt).toBeInstanceOf(Date);
    });

    it('should handle incomplete candidate data', async () => {
      const incompleteCandidate: Candidate = {
        id: mockCandidate.id,
        resumeData: mockCandidate.resumeData,
        processingStage: 'resume',
        createdAt: mockCandidate.createdAt,
        updatedAt: mockCandidate.updatedAt
      };

      const report = await reportService.generateCandidateReport(
        incompleteCandidate, 
        mockJobProfile
      );

      expect(report.completionStatus.resumeProcessed).toBe(true);
      expect(report.completionStatus.aiAnalysisCompleted).toBe(false);
      expect(report.completionStatus.linkedInAnalysisCompleted).toBe(false);
      expect(report.completionStatus.githubAnalysisCompleted).toBe(false);
      expect(report.completionStatus.interviewCompleted).toBe(false);
      expect(report.completionStatus.scoringCompleted).toBe(false);
    });
  });

  describe('generateCandidatePDF', () => {
    it('should generate a PDF file for candidate report', async () => {
      const filePath = await reportService.generateCandidatePDF(
        mockCandidate, 
        mockJobProfile, 
        mockInterviewAnalysis
      );

      expect(filePath).toBeDefined();
      expect(filePath).toContain('.pdf');
      expect(filePath).toContain('candidate_');

      // Verify file exists
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    }, 30000); // Increase timeout for PDF generation

    it('should handle candidate without complete data', async () => {
      const incompleteCandidate: Candidate = {
        id: mockCandidate.id,
        resumeData: mockCandidate.resumeData,
        processingStage: 'resume',
        createdAt: mockCandidate.createdAt,
        updatedAt: mockCandidate.updatedAt
      };

      const filePath = await reportService.generateCandidatePDF(
        incompleteCandidate, 
        mockJobProfile
      );

      expect(filePath).toBeDefined();
      expect(filePath).toContain('.pdf');

      // Verify file exists
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    }, 30000);
  });

  describe('generateBatchSummaryReport', () => {
    it('should generate a batch summary report', async () => {
      const candidates = [mockCandidate];
      const interviewAnalyses = [mockInterviewAnalysis];

      const report = await reportService.generateBatchSummaryReport(
        mockBatch,
        candidates,
        mockJobProfile,
        interviewAnalyses
      );

      expect(report).toBeDefined();
      expect(report.batch).toEqual(mockBatch);
      expect(report.jobProfile).toEqual(mockJobProfile);
      expect(report.candidateReports).toHaveLength(1);
      expect(report.summary.totalCandidates).toBe(10);
      expect(report.summary.completedCandidates).toBe(1);
      expect(report.summary.averageScore).toBe(81.5);
      expect(report.summary.topCandidates).toHaveLength(1);
      expect(report.summary.processingTime).toBeGreaterThan(0);
    });

    it('should handle empty candidate list', async () => {
      const report = await reportService.generateBatchSummaryReport(
        mockBatch,
        [],
        mockJobProfile,
        []
      );

      expect(report.candidateReports).toHaveLength(0);
      expect(report.summary.completedCandidates).toBe(0);
      expect(report.summary.averageScore).toBe(0);
      expect(report.summary.topCandidates).toHaveLength(0);
    });
  });

  describe('generateBatchSummaryPDF', () => {
    it('should generate a PDF file for batch summary', async () => {
      const candidates = [mockCandidate];
      const interviewAnalyses = [mockInterviewAnalysis];

      const filePath = await reportService.generateBatchSummaryPDF(
        mockBatch,
        candidates,
        mockJobProfile,
        interviewAnalyses
      );

      expect(filePath).toBeDefined();
      expect(filePath).toContain('.pdf');
      expect(filePath).toContain('batch_summary_');

      // Verify file exists
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);
    }, 30000);
  });

  describe('exportCandidatesCSV', () => {
    it('should export candidates data to CSV', async () => {
      const candidates = [mockCandidate];
      const interviewAnalyses = [mockInterviewAnalysis];

      const filePath = await reportService.exportCandidatesCSV(
        candidates,
        mockJobProfile,
        interviewAnalyses
      );

      expect(filePath).toBeDefined();
      expect(filePath).toContain('.csv');
      expect(filePath).toContain('candidates_export_');

      // Verify file exists and has content
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toContain('Candidate ID');
      expect(fileContent).toContain('candidate-1');
      expect(fileContent).toContain('john.doe@email.com');
    });

    it('should handle candidates with missing data', async () => {
      const incompleteCandidate: Candidate = {
        id: mockCandidate.id,
        resumeData: {
          ...mockCandidate.resumeData,
          contactInfo: {
            projectUrls: []
          }
        },
        processingStage: 'resume',
        createdAt: mockCandidate.createdAt,
        updatedAt: mockCandidate.updatedAt
      };

      const filePath = await reportService.exportCandidatesCSV(
        [incompleteCandidate],
        mockJobProfile,
        []
      );

      expect(filePath).toBeDefined();

      const fileContent = await fs.readFile(filePath, 'utf-8');
      expect(fileContent).toContain('candidate-1');
      expect(fileContent).toContain('0'); // Default scores
    });
  });
});