import { Router, Request, Response } from 'express';
import { aiAnalysisService } from '../services/aiAnalysisService';
import { JobProfile, ResumeData } from '../models/interfaces';

const router = Router();

/**
 * POST /ai-analysis/analyze
 * Analyze a resume against a job profile using AI
 */
router.post('/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const { candidateId, resumeData, jobProfile } = req.body;

    // Validate required fields
    if (!candidateId || !resumeData || !jobProfile) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: candidateId, resumeData, jobProfile'
      });
      return;
    }

    // Validate resume data structure
    if (!resumeData.extractedText || !resumeData.fileName) {
      res.status(400).json({
        success: false,
        error: 'Invalid resumeData: missing extractedText or fileName'
      });
      return;
    }

    // Validate job profile structure
    if (!jobProfile.title || !jobProfile.requiredSkills || !Array.isArray(jobProfile.requiredSkills)) {
      res.status(400).json({
        success: false,
        error: 'Invalid jobProfile: missing title or requiredSkills array'
      });
      return;
    }

    console.log(`Starting AI analysis for candidate ${candidateId}`);

    // Perform AI analysis
    const analysisResult = await aiAnalysisService.analyzeResume(
      candidateId,
      resumeData as ResumeData,
      jobProfile as JobProfile
    );

    console.log(`AI analysis completed for candidate ${candidateId} using ${analysisResult.provider}`);

    res.status(200).json({
      success: true,
      data: analysisResult
    });

  } catch (error) {
    console.error('AI analysis failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'AI analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /ai-analysis/test-providers
 * Test connectivity to all AI providers
 */
router.get('/test-providers', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Testing AI provider connectivity...');
    
    const providerStatus = await aiAnalysisService.testProviders();
    
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

  } catch (error) {
    console.error('Provider test failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Provider test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /ai-analysis/demo
 * Demo endpoint with sample data for testing
 */
router.post('/demo', async (req: Request, res: Response): Promise<void> => {
  try {
    // Sample job profile
    const sampleJobProfile: JobProfile = {
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

    // Sample resume data
    const sampleResumeData: ResumeData = {
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

    // Perform AI analysis with sample data
    const analysisResult = await aiAnalysisService.analyzeResume(
      'demo-candidate-123',
      sampleResumeData,
      sampleJobProfile
    );

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

  } catch (error) {
    console.error('Demo analysis failed:', error);
    
    res.status(500).json({
      success: false,
      error: 'Demo analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      note: 'This is expected if no valid AI API keys are configured'
    });
  }
});

export default router;