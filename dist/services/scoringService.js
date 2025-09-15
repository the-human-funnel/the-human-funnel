"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringService = void 0;
const database_1 = require("../utils/database");
class ScoringService {
    constructor() {
        this.defaultThresholds = {
            strongHire: 85,
            hire: 70,
            maybe: 50
        };
    }
    async calculateCandidateScore(candidate, jobProfile, thresholds) {
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
                rank: 0,
                recommendation,
                reasoning
            };
        }
        catch (error) {
            throw new database_1.DatabaseError(`Failed to calculate candidate score: ${error instanceof Error ? error.message : 'Unknown error'}`, 'SCORING_ERROR', 500);
        }
    }
    calculateScoringBreakdown(candidate, jobProfile) {
        const weights = jobProfile.scoringWeights;
        const missingStages = [];
        const resumeScore = this.extractResumeScore(candidate.aiAnalysis, missingStages);
        const linkedInScore = this.extractLinkedInScore(candidate.linkedInAnalysis, missingStages);
        const githubScore = this.extractGitHubScore(candidate.githubAnalysis, missingStages);
        const interviewScore = this.extractInterviewScore(candidate.interviewSession, missingStages);
        const resumeContribution = (resumeScore * weights.resumeAnalysis) / 100;
        const linkedInContribution = (linkedInScore * weights.linkedInAnalysis) / 100;
        const githubContribution = (githubScore * weights.githubAnalysis) / 100;
        const interviewContribution = (interviewScore * weights.interviewPerformance) / 100;
        const totalAvailableWeight = this.calculateAvailableWeight(weights, missingStages);
        const rawCompositeScore = resumeContribution + linkedInContribution + githubContribution + interviewContribution;
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
    async rankCandidates(candidates, jobProfile, options = {}) {
        try {
            const thresholds = options.thresholds || this.defaultThresholds;
            const candidateScores = await Promise.all(candidates.map(candidate => this.calculateCandidateScore(candidate, jobProfile, thresholds)));
            let filteredScores = candidateScores;
            if (options.minStageScores) {
                filteredScores = this.applyStageFilters(candidateScores, options.minStageScores);
            }
            filteredScores.sort((a, b) => b.compositeScore - a.compositeScore);
            filteredScores.forEach((score, index) => {
                score.rank = index + 1;
            });
            return filteredScores;
        }
        catch (error) {
            throw new database_1.DatabaseError(`Failed to rank candidates: ${error instanceof Error ? error.message : 'Unknown error'}`, 'RANKING_ERROR', 500);
        }
    }
    filterByThreshold(candidateScores, minScore) {
        return candidateScores.filter(score => score.compositeScore >= minScore);
    }
    getCandidatesByRecommendation(candidateScores, recommendation) {
        return candidateScores.filter(score => score.recommendation === recommendation);
    }
    extractResumeScore(aiAnalysis, missingStages) {
        if (!aiAnalysis) {
            missingStages?.push('resumeAnalysis');
            return 0;
        }
        return aiAnalysis.relevanceScore;
    }
    extractLinkedInScore(linkedInAnalysis, missingStages) {
        if (!linkedInAnalysis) {
            missingStages?.push('linkedInAnalysis');
            return 0;
        }
        return linkedInAnalysis.professionalScore;
    }
    extractGitHubScore(githubAnalysis, missingStages) {
        if (!githubAnalysis) {
            missingStages?.push('githubAnalysis');
            return 0;
        }
        return githubAnalysis.technicalScore;
    }
    extractInterviewScore(interviewSession, missingStages) {
        if (!interviewSession || !interviewSession.analysisResult) {
            missingStages?.push('interviewPerformance');
            return 0;
        }
        const analysis = interviewSession.analysisResult;
        return analysis.performanceScore;
    }
    calculateAvailableWeight(weights, missingStages) {
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
        return totalWeight / 100;
    }
    generateRecommendation(compositeScore, thresholds) {
        if (compositeScore >= thresholds.strongHire) {
            return 'strong-hire';
        }
        else if (compositeScore >= thresholds.hire) {
            return 'hire';
        }
        else if (compositeScore >= thresholds.maybe) {
            return 'maybe';
        }
        else {
            return 'no-hire';
        }
    }
    generateReasoning(breakdown, recommendation) {
        const { stageContributions, compositeScore, missingStages } = breakdown;
        let reasoning = `Composite score: ${compositeScore}/100. `;
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
    formatStageName(stage) {
        const stageNames = {
            resumeAnalysis: 'Resume Analysis',
            linkedInAnalysis: 'LinkedIn Analysis',
            githubAnalysis: 'GitHub Analysis',
            interviewPerformance: 'Interview Performance'
        };
        return stageNames[stage] || stage;
    }
    applyStageFilters(candidateScores, minStageScores) {
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
exports.ScoringService = ScoringService;
//# sourceMappingURL=scoringService.js.map