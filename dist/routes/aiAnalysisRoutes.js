"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiAnalysisService_1 = require("../services/aiAnalysisService");
const router = (0, express_1.Router)();
router.post('/analyze', async (req, res) => {
    try {
        const { candidateId, resumeData, jobProfile } = req.body;
        if (!candidateId || !resumeData || !jobProfile) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: candidateId, resumeData, jobProfile'
            });
            return;
        }
        if (!resumeData.extractedText || !resumeData.fileName) {
            res.status(400).json({
                success: false,
                error: 'Invalid resumeData: missing extractedText or fileName'
            });
            return;
        }
        if (!jobProfile.title || !jobProfile.requiredSkills || !Array.isArray(jobProfile.requiredSkills)) {
            res.status(400).json({
                success: false,
                error: 'Invalid jobProfile: missing title or requiredSkills array'
            });
            return;
        }
        console.log(`Starting AI analysis for candidate ${candidateId}`);
        const analysisResult = await aiAnalysisService_1.aiAnalysisService.analyzeResume(candidateId, resumeData, jobProfile);
        console.log(`AI analysis completed for candidate ${candidateId} using ${analysisResult.provider}`);
        res.status(200).json({
            success: true,
            data: analysisResult
        });
    }
    catch (error) {
        console.error('AI analysis failed:', error);
        res.status(500).json({
            success: false,
            error: 'AI analysis failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/test-providers', async (req, res) => {
    try {
        console.log('Testing AI provider connectivity...');
        const providerStatus = await aiAnalysisService_1.aiAnalysisService.testProviders();
        const availableProviders = Object.entries(providerStatus)
            .filter(([_, available]) => available)
            .map(([provider, _]) => provider);
        res.status(200).json({
            success: true,
            data: {
                providerStatus,
                availableProviders,
                totalAvailable: availableProviders.length
            }
        });
    }
    catch (error) {
        console.error('Provider test failed:', error);
        res.status(500).json({
            success: false,
            error: 'Provider test failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/demo', async (req, res) => {
    try {
        const sampleJobProfile = {
            id: 'demo-job-123',
            title: 'Senior Software Engineer',
            description: 'Looking for an experienced software engineer with strong backend development skills',
            requiredSkills: ['JavaScript', 'Node.js', 'MongoDB', 'REST APIs', 'Git'],
            experienceLevel: 'Senior (5+ years)',
            scoringWeights: {
                resumeAnalysis: 25,
                linkedInAnalysis: 20,
                githubAnalysis: 25,
                interviewPerformance: 30,
            },
            interviewQuestions: ['Tell me about your experience with Node.js'],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const sampleResumeData = {
            id: 'demo-resume-123',
            fileName: 'john_doe_resume.pdf',
            extractedText: `
        John Doe
        Senior Software Engineer
        Email: john.doe@email.com
        Phone: (555) 123-4567
        
        Experience:
        - 6 years of experience in full-stack development
        - Proficient in JavaScript, Node.js, React, and MongoDB
        - Built REST APIs serving millions of requests
        - Experience with Git, Docker, and AWS
        - Led a team of 4 developers on multiple projects
        
        Education:
        - Bachelor's in Computer Science
        - Master's in Software Engineering
        
        Projects:
        - E-commerce platform using Node.js and MongoDB
        - Real-time chat application with WebSocket
        - Microservices architecture with Docker
      `,
            contactInfo: {
                email: 'john.doe@email.com',
                phone: '(555) 123-4567',
                projectUrls: [],
            },
            processingStatus: 'completed',
        };
        console.log('Running AI analysis demo...');
        const analysisResult = await aiAnalysisService_1.aiAnalysisService.analyzeResume('demo-candidate-123', sampleResumeData, sampleJobProfile);
        console.log(`Demo analysis completed using ${analysisResult.provider}`);
        res.status(200).json({
            success: true,
            message: 'Demo analysis completed successfully',
            data: {
                jobProfile: sampleJobProfile,
                resumeData: {
                    fileName: sampleResumeData.fileName,
                    extractedTextLength: sampleResumeData.extractedText.length,
                    contactInfo: sampleResumeData.contactInfo
                },
                analysisResult
            }
        });
    }
    catch (error) {
        console.error('Demo analysis failed:', error);
        res.status(500).json({
            success: false,
            error: 'Demo analysis failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            note: 'This is expected if no valid AI API keys are configured'
        });
    }
});
exports.default = router;
//# sourceMappingURL=aiAnalysisRoutes.js.map