"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const interviewAnalysisService_1 = require("../services/interviewAnalysisService");
const router = express_1.default.Router();
router.post('/analyze', async (req, res) => {
    try {
        const { candidateId, interviewSession, jobProfile } = req.body;
        if (!candidateId || !interviewSession || !jobProfile) {
            res.status(400).json({
                error: 'Missing required fields: candidateId, interviewSession, and jobProfile are required',
            });
            return;
        }
        if (!interviewSession.transcript) {
            res.status(400).json({
                error: 'Interview session must have a transcript for analysis',
            });
            return;
        }
        if (!jobProfile.requiredSkills || !Array.isArray(jobProfile.requiredSkills)) {
            res.status(400).json({
                error: 'Job profile must have requiredSkills array',
            });
            return;
        }
        console.log(`Starting interview analysis for candidate ${candidateId}`);
        const analysisResult = await interviewAnalysisService_1.interviewAnalysisService.analyzeTranscript(candidateId, interviewSession, jobProfile);
        console.log(`Completed interview analysis for candidate ${candidateId}`);
        res.json({
            success: true,
            data: analysisResult,
        });
    }
    catch (error) {
        console.error('Interview analysis failed:', error);
        res.status(500).json({
            error: 'Interview analysis failed',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
router.post('/batch-analyze', async (req, res) => {
    try {
        const { analysisRequests } = req.body;
        if (!Array.isArray(analysisRequests) || analysisRequests.length === 0) {
            res.status(400).json({
                error: 'analysisRequests must be a non-empty array',
            });
            return;
        }
        for (let i = 0; i < analysisRequests.length; i++) {
            const request = analysisRequests[i];
            if (!request.candidateId || !request.interviewSession || !request.jobProfile) {
                res.status(400).json({
                    error: `Invalid request at index ${i}: missing candidateId, interviewSession, or jobProfile`,
                });
                return;
            }
            if (!request.interviewSession.transcript) {
                res.status(400).json({
                    error: `Invalid request at index ${i}: interview session must have a transcript`,
                });
                return;
            }
        }
        console.log(`Starting batch interview analysis for ${analysisRequests.length} candidates`);
        const results = await interviewAnalysisService_1.interviewAnalysisService.batchAnalyzeTranscripts(analysisRequests);
        const successCount = results.filter(r => r.result).length;
        const errorCount = results.filter(r => r.error).length;
        console.log(`Completed batch interview analysis: ${successCount} successful, ${errorCount} failed`);
        res.json({
            success: true,
            data: {
                results,
                summary: {
                    total: results.length,
                    successful: successCount,
                    failed: errorCount,
                },
            },
        });
    }
    catch (error) {
        console.error('Batch interview analysis failed:', error);
        res.status(500).json({
            error: 'Batch interview analysis failed',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
router.get('/candidate/:candidateId', async (req, res) => {
    try {
        const { candidateId } = req.params;
        if (!candidateId) {
            res.status(400).json({
                error: 'Candidate ID is required',
            });
            return;
        }
        res.json({
            success: true,
            message: 'Analysis retrieval not yet implemented - requires database integration',
            candidateId,
        });
    }
    catch (error) {
        console.error('Failed to retrieve interview analysis:', error);
        res.status(500).json({
            error: 'Failed to retrieve interview analysis',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
router.get('/test-providers', async (req, res) => {
    try {
        console.log('Testing AI provider connectivity for interview analysis');
        const providerStatus = await interviewAnalysisService_1.interviewAnalysisService.testProviders();
        const allProvidersWorking = Object.values(providerStatus).some(status => status);
        const workingProviders = Object.entries(providerStatus)
            .filter(([_, status]) => status)
            .map(([provider, _]) => provider);
        res.json({
            success: true,
            data: {
                providerStatus,
                allProvidersWorking,
                workingProviders,
                message: allProvidersWorking
                    ? `Interview analysis service ready with providers: ${workingProviders.join(', ')}`
                    : 'No AI providers are currently working - interview analysis will fail',
            },
        });
    }
    catch (error) {
        console.error('Provider test failed:', error);
        res.status(500).json({
            error: 'Provider test failed',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
router.post('/validate-transcript', async (req, res) => {
    try {
        const { transcript } = req.body;
        if (!transcript || typeof transcript !== 'string') {
            res.status(400).json({
                error: 'Transcript is required and must be a string',
            });
            return;
        }
        const mockInterviewSession = {
            candidateId: 'test',
            jobProfileId: 'test',
            vapiCallId: 'test',
            scheduledAt: new Date(),
            status: 'completed',
            transcript,
            callQuality: 'good',
            retryCount: 0,
        };
        const mockJobProfile = {
            id: 'test',
            title: 'Test Position',
            description: 'Test',
            requiredSkills: ['test'],
            experienceLevel: 'mid',
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
        const service = interviewAnalysisService_1.interviewAnalysisService;
        const quality = service.assessTranscriptQuality ? service.assessTranscriptQuality(transcript) : 'good';
        const wordCount = transcript.split(/\s+/).length;
        const hasDialogue = transcript.includes(':') || transcript.includes('Interviewer') || transcript.includes('Candidate');
        const hasQuestionMarkers = /\?/.test(transcript);
        res.json({
            success: true,
            data: {
                quality,
                metrics: {
                    wordCount,
                    hasDialogue,
                    hasQuestionMarkers,
                    length: transcript.length,
                },
                recommendations: quality === 'poor'
                    ? ['Transcript quality is poor - manual review strongly recommended']
                    : quality === 'good'
                        ? ['Transcript quality is adequate for automated analysis']
                        : ['Transcript quality is excellent for automated analysis'],
            },
        });
    }
    catch (error) {
        console.error('Transcript validation failed:', error);
        res.status(500).json({
            error: 'Transcript validation failed',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
router.get('/health', async (req, res) => {
    try {
        res.json({
            success: true,
            service: 'Interview Analysis Service',
            status: 'healthy',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Health check failed',
            message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
    }
});
exports.default = router;
//# sourceMappingURL=interviewAnalysisRoutes.js.map