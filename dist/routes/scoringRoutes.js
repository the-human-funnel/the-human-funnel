"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scoringService_1 = require("../services/scoringService");
const jobProfileService_1 = require("../services/jobProfileService");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
const scoringService = new scoringService_1.ScoringService();
const jobProfileService = new jobProfileService_1.JobProfileService();
router.post('/candidate/:candidateId', async (req, res) => {
    try {
        const { candidateId } = req.params;
        const { jobProfileId } = req.body;
        if (!jobProfileId) {
            return res.status(400).json({
                error: 'Job profile ID is required'
            });
        }
        const { candidate } = req.body;
        if (!candidate) {
            return res.status(400).json({
                error: 'Candidate data is required'
            });
        }
        const jobProfile = await jobProfileService.getJobProfileById(jobProfileId);
        if (!jobProfile) {
            return res.status(404).json({
                error: 'Job profile not found'
            });
        }
        const candidateScore = await scoringService.calculateCandidateScore(candidate, jobProfile);
        res.json({
            success: true,
            data: candidateScore
        });
    }
    catch (error) {
        console.error('Error calculating candidate score:', error);
        if (error instanceof database_1.DatabaseError) {
            return res.status(error.statusCode).json({
                error: error.message,
                code: error.code
            });
        }
        res.status(500).json({
            error: 'Internal server error while calculating candidate score'
        });
    }
});
router.get('/breakdown/:candidateId/:jobProfileId', async (req, res) => {
    try {
        const { candidateId, jobProfileId } = req.params;
        if (!candidateId || !jobProfileId) {
            return res.status(400).json({
                error: 'Candidate ID and Job Profile ID are required'
            });
        }
        const { candidate } = req.body;
        if (!candidate) {
            return res.status(400).json({
                error: 'Candidate data is required'
            });
        }
        const jobProfile = await jobProfileService.getJobProfileById(jobProfileId);
        if (!jobProfile) {
            return res.status(404).json({
                error: 'Job profile not found'
            });
        }
        const breakdown = scoringService.calculateScoringBreakdown(candidate, jobProfile);
        res.json({
            success: true,
            data: breakdown
        });
    }
    catch (error) {
        console.error('Error calculating scoring breakdown:', error);
        if (error instanceof database_1.DatabaseError) {
            return res.status(error.statusCode).json({
                error: error.message,
                code: error.code
            });
        }
        res.status(500).json({
            error: 'Internal server error while calculating scoring breakdown'
        });
    }
});
router.post('/rank', async (req, res) => {
    try {
        const { candidates, jobProfileId, options } = req.body;
        if (!candidates || !Array.isArray(candidates)) {
            return res.status(400).json({
                error: 'Candidates array is required'
            });
        }
        if (!jobProfileId) {
            return res.status(400).json({
                error: 'Job profile ID is required'
            });
        }
        const jobProfile = await jobProfileService.getJobProfileById(jobProfileId);
        if (!jobProfile) {
            return res.status(404).json({
                error: 'Job profile not found'
            });
        }
        const rankingOptions = options || {};
        const rankedCandidates = await scoringService.rankCandidates(candidates, jobProfile, rankingOptions);
        res.json({
            success: true,
            data: {
                totalCandidates: candidates.length,
                rankedCandidates: rankedCandidates.length,
                candidates: rankedCandidates
            }
        });
    }
    catch (error) {
        console.error('Error ranking candidates:', error);
        if (error instanceof database_1.DatabaseError) {
            return res.status(error.statusCode).json({
                error: error.message,
                code: error.code
            });
        }
        res.status(500).json({
            error: 'Internal server error while ranking candidates'
        });
    }
});
router.post('/filter/threshold', async (req, res) => {
    try {
        const { candidateScores, minScore } = req.body;
        if (!candidateScores || !Array.isArray(candidateScores)) {
            return res.status(400).json({
                error: 'Candidate scores array is required'
            });
        }
        if (typeof minScore !== 'number' || minScore < 0 || minScore > 100) {
            return res.status(400).json({
                error: 'Minimum score must be a number between 0 and 100'
            });
        }
        const filteredCandidates = scoringService.filterByThreshold(candidateScores, minScore);
        res.json({
            success: true,
            data: {
                originalCount: candidateScores.length,
                filteredCount: filteredCandidates.length,
                minScore,
                candidates: filteredCandidates
            }
        });
    }
    catch (error) {
        console.error('Error filtering candidates by threshold:', error);
        if (error instanceof database_1.DatabaseError) {
            return res.status(error.statusCode).json({
                error: error.message,
                code: error.code
            });
        }
        res.status(500).json({
            error: 'Internal server error while filtering candidates'
        });
    }
});
router.post('/filter/recommendation', async (req, res) => {
    try {
        const { candidateScores, recommendation } = req.body;
        if (!candidateScores || !Array.isArray(candidateScores)) {
            return res.status(400).json({
                error: 'Candidate scores array is required'
            });
        }
        const validRecommendations = ['strong-hire', 'hire', 'maybe', 'no-hire'];
        if (!validRecommendations.includes(recommendation)) {
            return res.status(400).json({
                error: `Recommendation must be one of: ${validRecommendations.join(', ')}`
            });
        }
        const filteredCandidates = scoringService.getCandidatesByRecommendation(candidateScores, recommendation);
        res.json({
            success: true,
            data: {
                originalCount: candidateScores.length,
                filteredCount: filteredCandidates.length,
                recommendation,
                candidates: filteredCandidates
            }
        });
    }
    catch (error) {
        console.error('Error filtering candidates by recommendation:', error);
        if (error instanceof database_1.DatabaseError) {
            return res.status(error.statusCode).json({
                error: error.message,
                code: error.code
            });
        }
        res.status(500).json({
            error: 'Internal server error while filtering candidates'
        });
    }
});
router.post('/batch', async (req, res) => {
    try {
        const { scoringRequests } = req.body;
        if (!scoringRequests || !Array.isArray(scoringRequests)) {
            return res.status(400).json({
                error: 'Scoring requests array is required'
            });
        }
        const results = [];
        const processingErrors = [];
        for (const request of scoringRequests) {
            try {
                const { candidate, jobProfileId } = request;
                if (!candidate || !jobProfileId) {
                    processingErrors.push({
                        candidateId: candidate?.id || 'unknown',
                        error: 'Missing candidate or job profile ID'
                    });
                    continue;
                }
                const jobProfile = await jobProfileService.getJobProfileById(jobProfileId);
                if (!jobProfile) {
                    processingErrors.push({
                        candidateId: candidate.id,
                        error: 'Job profile not found'
                    });
                    continue;
                }
                const candidateScore = await scoringService.calculateCandidateScore(candidate, jobProfile);
                results.push(candidateScore);
            }
            catch (error) {
                processingErrors.push({
                    candidateId: request.candidate?.id || 'unknown',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        res.json({
            success: true,
            data: {
                totalRequests: scoringRequests.length,
                successfulScores: results.length,
                errorCount: processingErrors.length,
                results,
                errors: processingErrors
            }
        });
    }
    catch (error) {
        console.error('Error in batch scoring:', error);
        if (error instanceof database_1.DatabaseError) {
            return res.status(error.statusCode).json({
                error: error.message,
                code: error.code
            });
        }
        res.status(500).json({
            error: 'Internal server error during batch scoring'
        });
    }
});
exports.default = router;
//# sourceMappingURL=scoringRoutes.js.map