"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express = __importStar(require("express"));
const githubAnalysisService_1 = require("../services/githubAnalysisService");
const router = express.Router();
router.post('/analyze', async (req, res) => {
    try {
        const { candidateId, githubUrl, jobProfile, resumeProjectUrls } = req.body;
        if (!candidateId || !githubUrl || !jobProfile) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: candidateId, githubUrl, and jobProfile are required',
            });
            return;
        }
        if (!jobProfile.title || !jobProfile.requiredSkills || !Array.isArray(jobProfile.requiredSkills)) {
            res.status(400).json({
                success: false,
                error: 'Invalid job profile: title and requiredSkills array are required',
            });
            return;
        }
        console.log(`Received GitHub analysis request for candidate ${candidateId}`);
        const analysis = await githubAnalysisService_1.githubAnalysisService.analyzeGitHubProfile(candidateId, githubUrl, jobProfile, resumeProjectUrls || []);
        res.json({
            success: true,
            data: analysis,
        });
    }
    catch (error) {
        console.error('GitHub analysis endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error during GitHub analysis',
        });
    }
});
router.post('/batch', async (req, res) => {
    try {
        const { candidates, jobProfile } = req.body;
        if (!candidates || !Array.isArray(candidates) || !jobProfile) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: candidates array and jobProfile are required',
            });
            return;
        }
        if (!jobProfile.title || !jobProfile.requiredSkills || !Array.isArray(jobProfile.requiredSkills)) {
            res.status(400).json({
                success: false,
                error: 'Invalid job profile: title and requiredSkills array are required',
            });
            return;
        }
        console.log(`Received batch GitHub analysis request for ${candidates.length} candidates`);
        const results = [];
        const errors = [];
        for (const candidate of candidates) {
            try {
                if (!candidate.candidateId || !candidate.githubUrl) {
                    errors.push({
                        candidateId: candidate.candidateId || 'unknown',
                        error: 'Missing candidateId or githubUrl',
                    });
                    continue;
                }
                const analysis = await githubAnalysisService_1.githubAnalysisService.analyzeGitHubProfile(candidate.candidateId, candidate.githubUrl, jobProfile, candidate.resumeProjectUrls || []);
                results.push(analysis);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            catch (error) {
                console.error(`Batch GitHub analysis failed for candidate ${candidate.candidateId}:`, error);
                errors.push({
                    candidateId: candidate.candidateId,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        res.json({
            success: true,
            data: {
                results,
                errors,
                summary: {
                    total: candidates.length,
                    successful: results.length,
                    failed: errors.length,
                },
            },
        });
    }
    catch (error) {
        console.error('Batch GitHub analysis endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error during batch GitHub analysis',
        });
    }
});
router.get('/test-connection', async (req, res) => {
    try {
        console.log('Testing GitHub API connection...');
        const isConnected = await githubAnalysisService_1.githubAnalysisService.testConnection();
        if (isConnected) {
            const rateLimitStatus = await githubAnalysisService_1.githubAnalysisService.getRateLimitStatus();
            res.json({
                success: true,
                connected: true,
                message: 'GitHub API connection successful',
                rateLimit: rateLimitStatus,
            });
        }
        else {
            res.status(503).json({
                success: false,
                connected: false,
                message: 'GitHub API connection failed',
            });
        }
    }
    catch (error) {
        console.error('GitHub API connection test error:', error);
        res.status(500).json({
            success: false,
            connected: false,
            error: error instanceof Error ? error.message : 'Connection test failed',
        });
    }
});
router.get('/rate-limit', async (req, res) => {
    try {
        const rateLimitStatus = await githubAnalysisService_1.githubAnalysisService.getRateLimitStatus();
        if (rateLimitStatus) {
            res.json({
                success: true,
                data: rateLimitStatus,
            });
        }
        else {
            res.status(503).json({
                success: false,
                error: 'Unable to retrieve rate limit status - GitHub token may not be configured',
            });
        }
    }
    catch (error) {
        console.error('GitHub rate limit check error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check rate limit',
        });
    }
});
router.post('/validate-url', async (req, res) => {
    try {
        const { githubUrl } = req.body;
        if (!githubUrl) {
            res.status(400).json({
                success: false,
                error: 'GitHub URL is required',
            });
            return;
        }
        const githubRegex = /^https?:\/\/(www\.)?github\.com\/([a-zA-Z0-9-_]+)\/?([a-zA-Z0-9-_]+\/?)?$/;
        const match = githubUrl.match(githubRegex);
        if (!match) {
            res.json({
                success: true,
                valid: false,
                message: 'Invalid GitHub URL format',
            });
            return;
        }
        const username = match[2];
        const repository = match[3];
        res.json({
            success: true,
            valid: true,
            data: {
                username,
                repository: repository || null,
                type: repository ? 'repository' : 'profile',
            },
        });
    }
    catch (error) {
        console.error('GitHub URL validation error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'URL validation failed',
        });
    }
});
exports.default = router;
//# sourceMappingURL=githubAnalysisRoutes.js.map