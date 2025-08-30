import { ScoringService, RankingOptions, ScoringThresholds } from '../services/scoringService';
import { 
  Candidate, 
  JobProfile, 
  AIAnalysisResult, 
  LinkedInAnalysis, 
  GitHubAnalysis, 
  InterviewAnalysisResult 
} from '../models/interfaces';

describe('ScoringService', () => {
  let scoringService: ScoringService;
  let mockJobProfile: JobProfile;
  let mockCandidate: Candidate;

  beforeEach(() => {
    scoringService = new ScoringService();
    
    mockJobProfile = {
      id: 'job-1',
      title: 'Senior Software Engineer',
      description: 'Full-stack development role',
      requiredSkills: ['JavaScript', 'React', 'Node.js'],
      experienceLevel: 'Senior',
      scoringWeights: {
        resumeAnalysis: 25,
        linkedInAnalysis: 20,
        githubAnalysis: 25,
        interviewPerformance: 30
      },
      interviewQuestions: ['Tell me about your experience'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockCandidate = {
      id: 'candidate-1',
      resumeData: {
        id: 'resume-1',
        fileName: 'john-doe.pdf',
        extractedText: 'Senior software engineer with 5 years experience',
        contactInfo: {
          email: 'john@example.com',
          phone: '+1234567890',
          linkedInUrl: 'https://linkedin.com/in/johndoe',
          githubUrl: 'https://github.com/johndoe',
          projectUrls: []
        },
        processingStatus: 'completed'
      },
      aiAnalysis: {
        candidateId: 'candidate-1',
        provider: 'gemini',
        relevanceScore: 85,
        skillsMatch: {
          matched: ['JavaScript', 'React'],
          missing: ['Node.js']
        },
        experienceAssessment: 'Strong technical background',
        reasoning: 'Good match for the role',
        confidence: 90
      },
      linkedInAnalysis: {
        candidateId: 'candidate-1',
        profileAccessible: true,
        professionalScore: 78,
        experience: {
          totalYears: 5,
          relevantRoles: 3,
          companyQuality: 'high'
        },
        network: {
          connections: 500,
          endorsements: 25
        },
        credibilityIndicators: ['verified-profile', 'recommendations']
      },
      githubAnalysis: {
        candidateId: 'candidate-1',
        profileStats: {
          publicRepos: 15,
          followers: 50,
          contributionStreak: 200,
          totalCommits: 1000
        },
        technicalScore: 82,
        projectAuthenticity: {
          resumeProjects: [{
            url: 'https://github.com/johndoe/project1',
            isAuthentic: true,
            commitHistory: 50,
            branchingPattern: 'feature-branches',
            codeQuality: 'good'
          }]
        },
        skillsEvidence: ['JavaScript', 'React', 'TypeScript']
      },
      processingStage: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('calculateCandidateScore', () => {
    it('should calculate composite score with all analysis stages present', async () => {
      // Add mock interview analysis
      (mockCandidate as any).interviewSession = {
        analysisResult: {
          performanceScore: 88
        }
      };

      const result = await scoringService.calculateCandidateScore(mockCandidate, mockJobProfile);

      expect(result.candidateId).toBe('candidate-1');
      expect(result.jobProfileId).toBe('job-1');
      expect(result.compositeScore).toBeGreaterThan(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
      expect(result.stageScores.resumeAnalysis).toBe(85);
      expect(result.stageScores.linkedInAnalysis).toBe(78);
      expect(result.stageScores.githubAnalysis).toBe(82);
      expect(result.stageScores.interviewPerformance).toBe(88);
      expect(result.appliedWeights).toEqual(mockJobProfile.scoringWeights);
      expect(result.recommendation).toMatch(/strong-hire|hire|maybe|no-hire/);
      expect(result.reasoning).toBeTruthy();
    });

    it('should handle missing analysis stages gracefully', async () => {
      // Remove some analysis stages
      delete mockCandidate.linkedInAnalysis;
      delete mockCandidate.githubAnalysis;

      const result = await scoringService.calculateCandidateScore(mockCandidate, mockJobProfile);

      expect(result.compositeScore).toBeGreaterThan(0);
      expect(result.stageScores.linkedInAnalysis).toBe(0);
      expect(result.stageScores.githubAnalysis).toBe(0);
      expect(result.reasoning).toContain('Missing analysis');
    });

    it('should generate appropriate recommendations based on score', async () => {
      // High score candidate
      mockCandidate.aiAnalysis!.relevanceScore = 95;
      mockCandidate.linkedInAnalysis!.professionalScore = 90;
      mockCandidate.githubAnalysis!.technicalScore = 92;
      (mockCandidate as any).interviewSession = {
        analysisResult: { performanceScore: 94 }
      };

      const result = await scoringService.calculateCandidateScore(mockCandidate, mockJobProfile);
      expect(result.recommendation).toBe('strong-hire');
      expect(result.compositeScore).toBeGreaterThan(85);
    });

    it('should handle low-scoring candidates', async () => {
      // Low score candidate
      mockCandidate.aiAnalysis!.relevanceScore = 30;
      mockCandidate.linkedInAnalysis!.professionalScore = 25;
      mockCandidate.githubAnalysis!.technicalScore = 20;
      (mockCandidate as any).interviewSession = {
        analysisResult: { performanceScore: 35 }
      };

      const result = await scoringService.calculateCandidateScore(mockCandidate, mockJobProfile);
      expect(result.recommendation).toBe('no-hire');
      expect(result.compositeScore).toBeLessThan(50);
    });
  });

  describe('calculateScoringBreakdown', () => {
    it('should provide detailed scoring breakdown', () => {
      const breakdown = scoringService.calculateScoringBreakdown(mockCandidate, mockJobProfile);

      expect(breakdown.candidateId).toBe('candidate-1');
      expect(breakdown.stageContributions.resumeAnalysis.rawScore).toBe(85);
      expect(breakdown.stageContributions.resumeAnalysis.weight).toBe(25);
      expect(breakdown.stageContributions.resumeAnalysis.weightedScore).toBe(21.25);
      expect(breakdown.compositeScore).toBeGreaterThan(0);
      expect(breakdown.compositeScore).toBeLessThanOrEqual(100);
    });

    it('should track missing stages', () => {
      delete mockCandidate.linkedInAnalysis;
      delete mockCandidate.githubAnalysis;

      const breakdown = scoringService.calculateScoringBreakdown(mockCandidate, mockJobProfile);

      expect(breakdown.missingStages).toContain('linkedInAnalysis');
      expect(breakdown.missingStages).toContain('githubAnalysis');
      expect(breakdown.missingStages).toContain('interviewPerformance');
    });
  });

  describe('rankCandidates', () => {
    let candidates: Candidate[];

    beforeEach(() => {
      candidates = [
        {
          ...mockCandidate,
          id: 'candidate-1',
          aiAnalysis: { ...mockCandidate.aiAnalysis!, relevanceScore: 85 }
        },
        {
          ...mockCandidate,
          id: 'candidate-2',
          aiAnalysis: { ...mockCandidate.aiAnalysis!, candidateId: 'candidate-2', relevanceScore: 75 }
        },
        {
          ...mockCandidate,
          id: 'candidate-3',
          aiAnalysis: { ...mockCandidate.aiAnalysis!, candidateId: 'candidate-3', relevanceScore: 95 }
        }
      ];
    });

    it('should rank candidates by composite score', async () => {
      const rankedCandidates = await scoringService.rankCandidates(candidates, mockJobProfile);

      expect(rankedCandidates).toHaveLength(3);
      expect(rankedCandidates[0]?.rank).toBe(1);
      expect(rankedCandidates[1]?.rank).toBe(2);
      expect(rankedCandidates[2]?.rank).toBe(3);
      
      // Should be sorted by score (descending)
      expect(rankedCandidates[0]?.compositeScore).toBeGreaterThanOrEqual(rankedCandidates[1]?.compositeScore || 0);
      expect(rankedCandidates[1]?.compositeScore).toBeGreaterThanOrEqual(rankedCandidates[2]?.compositeScore || 0);
    });

    it('should apply minimum stage score filters', async () => {
      const options: RankingOptions = {
        minStageScores: {
          resumeAnalysis: 80
        }
      };

      const rankedCandidates = await scoringService.rankCandidates(candidates, mockJobProfile, options);

      // Should filter out candidate-2 (score 75)
      expect(rankedCandidates.length).toBeLessThan(candidates.length);
      expect(rankedCandidates.every(c => c.stageScores.resumeAnalysis >= 80)).toBe(true);
    });
  });

  describe('filterByThreshold', () => {
    it('should filter candidates by minimum composite score', () => {
      const candidateScores = [
        { compositeScore: 85, candidateId: 'c1' } as any,
        { compositeScore: 65, candidateId: 'c2' } as any,
        { compositeScore: 75, candidateId: 'c3' } as any
      ];

      const filtered = scoringService.filterByThreshold(candidateScores, 70);

      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.compositeScore >= 70)).toBe(true);
    });
  });

  describe('getCandidatesByRecommendation', () => {
    it('should filter candidates by recommendation level', () => {
      const candidateScores = [
        { recommendation: 'strong-hire', candidateId: 'c1' } as any,
        { recommendation: 'hire', candidateId: 'c2' } as any,
        { recommendation: 'strong-hire', candidateId: 'c3' } as any,
        { recommendation: 'no-hire', candidateId: 'c4' } as any
      ];

      const strongHires = scoringService.getCandidatesByRecommendation(candidateScores, 'strong-hire');
      const hires = scoringService.getCandidatesByRecommendation(candidateScores, 'hire');

      expect(strongHires).toHaveLength(2);
      expect(hires).toHaveLength(1);
      expect(strongHires.every(c => c.recommendation === 'strong-hire')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle candidate with no analysis data', async () => {
      const emptyCandidate: Candidate = {
        id: 'empty-candidate',
        resumeData: {
          id: 'resume-empty',
          fileName: 'empty.pdf',
          extractedText: '',
          contactInfo: { projectUrls: [] },
          processingStatus: 'completed'
        },
        processingStage: 'resume',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await scoringService.calculateCandidateScore(emptyCandidate, mockJobProfile);

      expect(result.compositeScore).toBe(0);
      expect(result.recommendation).toBe('no-hire');
      expect(result.reasoning).toContain('Missing analysis');
    });

    it('should handle job profile with zero weights gracefully', async () => {
      const zeroWeightProfile: JobProfile = {
        ...mockJobProfile,
        scoringWeights: {
          resumeAnalysis: 0,
          linkedInAnalysis: 0,
          githubAnalysis: 0,
          interviewPerformance: 100
        }
      };

      const result = await scoringService.calculateCandidateScore(mockCandidate, zeroWeightProfile);

      expect(result.appliedWeights).toEqual(zeroWeightProfile.scoringWeights);
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle custom thresholds in ranking', async () => {
      const customThresholds: ScoringThresholds = {
        strongHire: 95,
        hire: 85,
        maybe: 70
      };

      const options: RankingOptions = {
        thresholds: customThresholds
      };

      // Create a candidate with score that would be 'hire' with default thresholds
      // but 'maybe' with custom thresholds
      mockCandidate.aiAnalysis!.relevanceScore = 80;
      mockCandidate.linkedInAnalysis!.professionalScore = 80;
      mockCandidate.githubAnalysis!.technicalScore = 80;
      (mockCandidate as any).interviewSession = {
        analysisResult: { performanceScore: 80 }
      };

      const rankedCandidates = await scoringService.rankCandidates([mockCandidate], mockJobProfile, options);

      // With stricter thresholds, this should be 'maybe' instead of 'hire'
      expect(rankedCandidates[0]?.recommendation).toBe('maybe');
    });
  });
});