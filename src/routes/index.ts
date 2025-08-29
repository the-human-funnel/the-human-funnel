// API route definitions
import { Router } from 'express';
import jobProfileRoutes from './jobProfileRoutes';
import resumeRoutes from './resumeRoutes';
import aiAnalysisRoutes from './aiAnalysisRoutes';
import linkedInAnalysisRoutes from './linkedInAnalysisRoutes';
import githubAnalysisRoutes from './githubAnalysisRoutes';

const router = Router();

// Job Profile routes
router.use('/job-profiles', jobProfileRoutes);

// Resume processing routes
router.use('/resumes', resumeRoutes);

// AI Analysis routes
router.use('/ai-analysis', aiAnalysisRoutes);

// LinkedIn Analysis routes
router.use('/linkedin', linkedInAnalysisRoutes);

// GitHub Analysis routes
router.use('/github-analysis', githubAnalysisRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
