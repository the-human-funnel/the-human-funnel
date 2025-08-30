import { 
  CandidateScore, 
  Candidate, 
  JobProfile, 
  AIAnalysisResult, 
  LinkedInAnalysis, 
  GitHubAnalysis, 
  InterviewAnalysisResult 
} from '../models/interfaces';
import { DatabaseError } from '../utils/database';

export interface ScoringThresholds {
  strongHire: number; // e.g., 85
  hire: number; // e.g., 70
  maybe: number; // e.g., 50
  // Below 'maybe' threshold = no-hire
}

export interface RankingOptions {
  thresholds?: ScoringThresholds;
  minStageScores?: {
    resumeAnalysis?: number;
    linkedInAnalysis?: number;
    githubAnalysis?: number;
    interviewPerformance?: number;
  };
}

export interface ScoringBreakdown {
  candidateId: string;
  stageContributions: {
    resumeAnalysis: {
      rawScore: number;
      weight: number;
      weightedScore: number;
    };
    linkedInAnalysis: {
      rawScore: number;
      weight: number;
      weightedScore: number;
    };
    githubAnalysis: {
      rawScore: number;
      weight: number;
      weightedScore: number;
    };
    interviewPerformance: {
      rawScore: number;
      weight: number;
      weightedScore: number;
    };
  };
  compositeScore: number;
  missingStages: string[];
}

export class ScoringService {
  private defaultThresholds: ScoringThresholds = {
    strongHire: 85,
    hire: 70,
    maybe: 50
  };

  /**
   * Calculate comprehensive score for a single candidate
   */
  async calculateCandidateScore(
    candidate: Candidate,
    jobProfile: JobProfile,
    thresholds?: ScoringThresholds
  ): Promise<CandidateScore> {
    try {
      const usedThresholds = thresholds || this.defaultThresholds;
      const breakdown = this.calculateScoringBreakdown(candidate, jobProfile);
      const recommendation = this.generateRecommendation(breakdown.compositeScore, usedThresholds);
      const reasoning = this.generateReasoning(breakdown, recommendation);

      return {
        candidateId: candidate.id,
        jobProfileId: jobProfile.id,
        compositeScore: breakdown.compositeScore,
        stageScores: {
          resumeAnalysis: breakdown.stageContributions.resumeAnalysis.rawScore,
          linkedInAnalysis: breakdown.stageContributions.linkedInAnalysis.rawScore,
          githubAnalysis: breakdown.stageContributions.githubAnalysis.rawScore,
          interviewPerformance: breakdown.stageContributions.interviewPerformance.rawScore
        },
        appliedWeights: jobProfile.scoringWeights,
        rank: 0, // Will be set during ranking process
        recommendation,
        reasoning
      };
    } catch (error) {
      throw new DatabaseError(
        `Failed to calculate candidate score: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SCORING_ERROR',
        500
      );
    }
  }

  /**
   * Calculate detailed scoring breakdown for analysis
   */
  calculateScoringBreakdown(
    candidate: Candidate,
    jobProfile: JobProfile
  ): ScoringBreakdown {
    const weights = jobProfile.scoringWeights;
    const missingStages: string[] = [];

    // Extract raw scores from analysis results
    const resumeScore = this.extractResumeScore(candidate.aiAnalysis, missingStages);
    const linkedInScore = this.extractLinkedInScore(candidate.linkedInAnalysis, missingStages);
    const githubScore = this.extractGitHubScore(candidate.githubAnalysis, missingStages);
    const interviewScore = this.extractInterviewScore(candidate.interviewSession, missingStages);

    // Calculate weighted contributions
    const resumeContribution = (resumeScore * weights.resumeAnalysis) / 100;
    const linkedInContribution = (linkedInScore * weights.linkedInAnalysis) / 100;
    const githubContribution = (githubScore * weights.githubAnalysis) / 100;
    const interviewContribution = (interviewScore * weights.interviewPerformance) / 100;

    // Calculate composite score (adjust for missing stages)
    const totalAvailableWeight = this.calculateAvailableWeight(weights, missingStages);
    const rawCompositeScore = resumeContribution + linkedInContribution + githubContribution + interviewContribution;
    
    // Normalize score if some stages are missing
    const compositeScore = totalAvailableWeight > 0 ? 
      Math.round(rawCompositeScore / totalAvailableWeight) : 0;

    return {
      candidateId: candidate.id,
      stageContributions: {
        resumeAnalysis: {
          rawScore: resumeScore,
          weight: weights.resumeAnalysis,
          weightedScore: resumeContribution
        },
        linkedInAnalysis: {
          rawScore: linkedInScore,
          weight: weights.linkedInAnalysis,
          weightedScore: linkedInContribution
        },
        githubAnalysis: {
          rawScore: githubScore,
          weight: weights.githubAnalysis,
          weightedScore: githubContribution
        },
        interviewPerformance: {
          rawScore: interviewScore,
          weight: weights.interviewPerformance,
          weightedScore: interviewContribution
        }
      },
      compositeScore: Math.min(100, Math.max(0, compositeScore)),
      missingStages
    };
  }

  /**
   * Rank and filter candidates based on scores and thresholds
   */
  async rankCandidates(
    candidates: Candidate[],
    jobProfile: JobProfile,
    options: RankingOptions = {}
  ): Promise<CandidateScore[]> {
    try {
      const thresholds = options.thresholds || this.defaultThresholds;
      
      // Calculate scores for all candidates
      const candidateScores = await Promise.all(
        candidates.map(candidate => this.calculateCandidateScore(candidate, jobProfile, thresholds))
      );

      // Apply minimum stage score filters if specified
      let filteredScores = candidateScores;
      if (options.minStageScores) {
        filteredScores = this.applyStageFilters(candidateScores, options.minStageScores);
      }

      // Sort by composite score (descending)
      filteredScores.sort((a, b) => b.compositeScore - a.compositeScore);

      // Assign ranks
      filteredScores.forEach((score, index) => {
        score.rank = index + 1;
      });

      return filteredScores;
    } catch (error) {
      throw new DatabaseError(
        `Failed to rank candidates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RANKING_ERROR',
        500
      );
    }
  }

  /**
   * Filter candidates by minimum composite score threshold
   */
  filterByThreshold(
    candidateScores: CandidateScore[],
    minScore: number
  ): CandidateScore[] {
    return candidateScores.filter(score => score.compositeScore >= minScore);
  }

  /**
   * Get candidates by recommendation level
   */
  getCandidatesByRecommendation(
    candidateScores: CandidateScore[],
    recommendation: 'strong-hire' | 'hire' | 'maybe' | 'no-hire'
  ): CandidateScore[] {
    return candidateScores.filter(score => score.recommendation === recommendation);
  }

  // Private helper methods

  private extractResumeScore(aiAnalysis?: AIAnalysisResult, missingStages?: string[]): number {
    if (!aiAnalysis) {
      missingStages?.push('resumeAnalysis');
      return 0;
    }
    return aiAnalysis.relevanceScore;
  }

  private extractLinkedInScore(linkedInAnalysis?: LinkedInAnalysis, missingStages?: string[]): number {
    if (!linkedInAnalysis) {
      missingStages?.push('linkedInAnalysis');
      return 0;
    }
    return linkedInAnalysis.professionalScore;
  }

  private extractGitHubScore(githubAnalysis?: GitHubAnalysis, missingStages?: string[]): number {
    if (!githubAnalysis) {
      missingStages?.push('githubAnalysis');
      return 0;
    }
    return githubAnalysis.technicalScore;
  }

  private extractInterviewScore(interviewSession?: any, missingStages?: string[]): number {
    // Note: This assumes interview analysis results are attached to the session
    // In a real implementation, you might need to fetch the InterviewAnalysisResult separately
    if (!interviewSession || !interviewSession.analysisResult) {
      missingStages?.push('interviewPerformance');
      return 0;
    }
    
    const analysis = interviewSession.analysisResult as InterviewAnalysisResult;
    return analysis.performanceScore;
  }

  private calculateAvailableWeight(
    weights: JobProfile['scoringWeights'],
    missingStages: string[]
  ): number {
    let totalWeight = 100;
    
    if (missingStages.includes('resumeAnalysis')) {
      totalWeight -= weights.resumeAnalysis;
    }
    if (missingStages.includes('linkedInAnalysis')) {
      totalWeight -= weights.linkedInAnalysis;
    }
    if (missingStages.includes('githubAnalysis')) {
      totalWeight -= weights.githubAnalysis;
    }
    if (missingStages.includes('interviewPerformance')) {
      totalWeight -= weights.interviewPerformance;
    }
    
    return totalWeight / 100; // Convert to decimal
  }

  private generateRecommendation(
    compositeScore: number,
    thresholds: ScoringThresholds
  ): 'strong-hire' | 'hire' | 'maybe' | 'no-hire' {
    if (compositeScore >= thresholds.strongHire) {
      return 'strong-hire';
    } else if (compositeScore >= thresholds.hire) {
      return 'hire';
    } else if (compositeScore >= thresholds.maybe) {
      return 'maybe';
    } else {
      return 'no-hire';
    }
  }

  private generateReasoning(
    breakdown: ScoringBreakdown,
    recommendation: string
  ): string {
    const { stageContributions, compositeScore, missingStages } = breakdown;
    
    let reasoning = `Composite score: ${compositeScore}/100. `;
    
    // Highlight strongest areas
    const contributions = Object.entries(stageContributions)
      .map(([stage, data]) => ({ stage, ...data }))
      .sort((a, b) => b.rawScore - a.rawScore);
    
    const strongest = contributions[0];
    const weakest = contributions[contributions.length - 1];
    
    if (strongest && strongest.rawScore > 0) {
      reasoning += `Strongest area: ${this.formatStageName(strongest.stage)} (${strongest.rawScore}/100). `;
    }
    
    if (weakest && strongest && weakest.rawScore < strongest.rawScore && weakest.rawScore >= 0) {
      reasoning += `Area for improvement: ${this.formatStageName(weakest.stage)} (${weakest.rawScore}/100). `;
    }
    
    if (missingStages.length > 0) {
      reasoning += `Missing analysis: ${missingStages.map(this.formatStageName).join(', ')}. `;
    }
    
    // Add recommendation context
    switch (recommendation) {
      case 'strong-hire':
        reasoning += 'Excellent candidate with strong performance across multiple areas.';
        break;
      case 'hire':
        reasoning += 'Good candidate who meets most requirements.';
        break;
      case 'maybe':
        reasoning += 'Candidate shows potential but has some gaps or concerns.';
        break;
      case 'no-hire':
        reasoning += 'Candidate does not meet minimum requirements for this role.';
        break;
    }
    
    return reasoning;
  }

  private formatStageName(stage: string): string {
    const stageNames: { [key: string]: string } = {
      resumeAnalysis: 'Resume Analysis',
      linkedInAnalysis: 'LinkedIn Analysis',
      githubAnalysis: 'GitHub Analysis',
      interviewPerformance: 'Interview Performance'
    };
    return stageNames[stage] || stage;
  }

  private applyStageFilters(
    candidateScores: CandidateScore[],
    minStageScores: NonNullable<RankingOptions['minStageScores']>
  ): CandidateScore[] {
    return candidateScores.filter(score => {
      if (minStageScores.resumeAnalysis && score.stageScores.resumeAnalysis < minStageScores.resumeAnalysis) {
        return false;
      }
      if (minStageScores.linkedInAnalysis && score.stageScores.linkedInAnalysis < minStageScores.linkedInAnalysis) {
        return false;
      }
      if (minStageScores.githubAnalysis && score.stageScores.githubAnalysis < minStageScores.githubAnalysis) {
        return false;
      }
      if (minStageScores.interviewPerformance && score.stageScores.interviewPerformance < minStageScores.interviewPerformance) {
        return false;
      }
      return true;
    });
  }
}