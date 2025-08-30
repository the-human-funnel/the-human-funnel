// API route definitions
import { Router } from 'express';
import authRoutes from './authRoutes';
import auditRoutes from './auditRoutes';
import jobProfileRoutes from './jobProfileRoutes';
import resumeRoutes from './resumeRoutes';
import candidateRoutes from './candidateRoutes';
import aiAnalysisRoutes from './aiAnalysisRoutes';
import linkedInAnalysisRoutes from './linkedInAnalysisRoutes';
import githubAnalysisRoutes from './githubAnalysisRoutes';
import vapiInterviewRoutes from './vapiInterviewRoutes';
import interviewAnalysisRoutes from './interviewAnalysisRoutes';
import scoringRoutes from './scoringRoutes';
import reportRoutes from './reportRoutes';
import { queueRoutes } from './queueRoutes';
import healthRoutes from './healthRoutes';
import { authenticate } from '../middleware/auth';

const router = Router();

// Authentication routes (public)
router.use('/auth', authRoutes);

// Audit routes (admin only)
router.use('/audit', auditRoutes);

// Protected routes (require authentication)
// Job Profile routes
router.use('/job-profiles', authenticate, jobProfileRoutes);

// Resume processing routes
router.use('/resumes', authenticate, resumeRoutes);

// Candidate management routes
router.use('/candidates', authenticate, candidateRoutes);

// AI Analysis routes
router.use('/ai-analysis', authenticate, aiAnalysisRoutes);

// LinkedIn Analysis routes
router.use('/linkedin', authenticate, linkedInAnalysisRoutes);

// GitHub Analysis routes
router.use('/github-analysis', authenticate, githubAnalysisRoutes);

// VAPI Interview routes
router.use('/vapi', authenticate, vapiInterviewRoutes);

// Interview Analysis routes
router.use('/interview-analysis', authenticate, interviewAnalysisRoutes);

// Scoring and Ranking routes
router.use('/scoring', authenticate, scoringRoutes);

// Report Generation routes
router.use('/reports', authenticate, reportRoutes);

// Queue Management routes
router.use('/queues', authenticate, queueRoutes);

// Health and monitoring routes
router.use('/', healthRoutes);

export default router;
