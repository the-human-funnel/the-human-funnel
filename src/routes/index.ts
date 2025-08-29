// API route definitions
import { Router } from 'express';
import jobProfileRoutes from './jobProfileRoutes';
import resumeRoutes from './resumeRoutes';

const router = Router();

// Job Profile routes
router.use('/job-profiles', jobProfileRoutes);

// Resume processing routes
router.use('/resumes', resumeRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;
