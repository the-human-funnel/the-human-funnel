"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const linkedInAnalysisService_1 = require("../services/linkedInAnalysisService");
const schemas_1 = require("../models/schemas");
const router = (0, express_1.Router)();
router.post('/analyze', async (req, res) => {
    try {
        const { candidateId, linkedInUrl, jobProfileId } = req.body;
        if (!candidateId || !linkedInUrl || !jobProfileId) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: candidateId, linkedInUrl, jobProfileId',
            });
            return;
        }
        const candidate = await schemas_1.CandidateModel.findById(candidateId);
        if (!candidate) {
            res.status(404).json({
                success: false,
                error: 'Candidate not found',
            });
            return;
        }
        const mockJobProfile = {
            id: jobProfileId,
            title: 'Software Engineer',
            description: 'Full-stack software engineer position',
            requiredSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL'],
            experienceLevel: 'Mid-level',
            scoringWeights: {
                resumeAnalysis: 25,
                linkedInAnalysis: 20,
                githubAnalysis: 25,
                interviewPerformance: 30,
            },
            interviewQuestions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const analysis = await linkedInAnalysisService_1.linkedInAnalysisService.analyzeLinkedInProfile(candidateId, linkedInUrl, mockJobProfile);
        candidate.linkedInAnalysis = analysis;
        candidate.processingStage = 'github';
        await candidate.save();
        res.json({
            success: true,
            data: analysis,
        });
    }
    catch (error) {
        console.error('LinkedIn analysis API error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
router.get('/candidate/:candidateId', async (req, res) => {
    try {
        const { candidateId } = req.params;
        const candidate = await schemas_1.CandidateModel.findById(candidateId);
        if (!candidate) {
            res.status(404).json({
                success: false,
                error: 'Candidate not found',
            });
            return;
        }
        if (!candidate.linkedInAnalysis) {
            res.status(404).json({
                success: false,
                error: 'LinkedIn analysis not found for this candidate',
            });
            return;
        }
        res.json({
            success: true,
            data: candidate.linkedInAnalysis,
        });
    }
    catch (error) {
        console.error('Get LinkedIn analysis API error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
router.post('/batch-analyze', async (req, res) => {
    try {
        const { candidateIds, jobProfileId } = req.body;
        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
            res.status(400).json({
                success: false,
                error: 'candidateIds must be a non-empty array',
            });
            return;
        }
        if (!jobProfileId) {
            res.status(400).json({
                success: false,
                error: 'jobProfileId is required',
            });
            return;
        }
        const candidates = await schemas_1.CandidateModel.find({
            _id: { $in: candidateIds },
            'resumeData.contactInfo.linkedInUrl': { $exists: true, $ne: null },
        });
        if (candidates.length === 0) {
            res.status(404).json({
                success: false,
                error: 'No candidates found with LinkedIn URLs',
            });
            return;
        }
        const mockJobProfile = {
            id: jobProfileId,
            title: 'Software Engineer',
            description: 'Full-stack software engineer position',
            requiredSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL'],
            experienceLevel: 'Mid-level',
            scoringWeights: {
                resumeAnalysis: 25,
                linkedInAnalysis: 20,
                githubAnalysis: 25,
                interviewPerformance: 30,
            },
            interviewQuestions: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const results = [];
        for (const candidate of candidates) {
            try {
                const linkedInUrl = candidate.resumeData.contactInfo.linkedInUrl;
                if (!linkedInUrl) {
                    results.push({
                        candidateId: candidate.id,
                        success: false,
                        error: 'No LinkedIn URL found',
                    });
                    continue;
                }
                const analysis = await linkedInAnalysisService_1.linkedInAnalysisService.analyzeLinkedInProfile(candidate.id, linkedInUrl, mockJobProfile);
                candidate.linkedInAnalysis = analysis;
                candidate.processingStage = 'github';
                await candidate.save();
                results.push({
                    candidateId: candidate.id,
                    success: true,
                    analysis,
                });
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            catch (error) {
                results.push({
                    candidateId: candidate.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.length - successCount;
        res.json({
            success: true,
            data: {
                processed: results.length,
                successful: successCount,
                failed: failureCount,
                results,
            },
        });
    }
    catch (error) {
        console.error('Batch LinkedIn analysis API error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
router.get('/test-connection', async (req, res) => {
    try {
        const isConnected = await linkedInAnalysisService_1.linkedInAnalysisService.testConnection();
        res.json({
            success: true,
            data: {
                connected: isConnected,
                message: isConnected
                    ? 'LinkedIn scraper API is accessible'
                    : 'LinkedIn scraper API is not accessible',
            },
        });
    }
    catch (error) {
        console.error('LinkedIn connection test error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
router.get('/usage', async (req, res) => {
    try {
        const usage = await linkedInAnalysisService_1.linkedInAnalysisService.getApiUsage();
        if (!usage) {
            res.status(503).json({
                success: false,
                error: 'LinkedIn API usage information not available',
            });
            return;
        }
        res.json({
            success: true,
            data: usage,
        });
    }
    catch (error) {
        console.error('LinkedIn usage API error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=linkedInAnalysisRoutes.js.map