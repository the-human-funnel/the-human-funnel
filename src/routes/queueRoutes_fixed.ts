import express from 'express';
import { queueManager } from '../queues';
import { queueOrchestrator } from '../services/queueOrchestrator';
import { queueMonitor } from '../utils/queueMonitor';
import { logger } from '../utils/logger';

const router = express.Router();

// Get queue statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await queueManager.getAllQueueStats();
    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get queue statistics',
    });
  }
});

// Get specific queue statistics
router.get('/stats/:queueName', async (req, res) => {
  try {
    const { queueName } = req.params;
    const stats = await queueManager.getQueueStats(queueName);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Queue not found',
      });
    }

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get queue stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get queue statistics',
    });
  }
});

// Get batch progress
router.get('/batch/:batchId/progress', async (req, res) => {
  try {
    const { batchId } = req.params;
    const progress = await queueManager.getBatchProgress(batchId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found',
      });
    }

    return res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error('Failed to get batch progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get batch progress',
    });
  }
});

// Get job progress
router.get('/job/:queueName/:jobId/progress', async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const progress = await queueManager.getJobProgress(queueName, jobId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
      });
    }

    return res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    logger.error('Failed to get job progress:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get job progress',
    });
  }
});

// Start batch processing
router.post('/batch/process', async (req, res) => {
  try {
    const { candidateIds, jobProfileId } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'candidateIds must be a non-empty array',
      });
    }

    if (!jobProfileId) {
      return res.status(400).json({
        success: false,
        error: 'jobProfileId is required',
      });
    }

    const batch = await queueOrchestrator.processCandidateBatch(candidateIds, jobProfileId);

    return res.json({
      success: true,
      data: batch,
    });
  } catch (error) {
    logger.error('Failed to start batch processing:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start batch processing',
    });
  }
});

// Process individual candidate
router.post('/candidate/process', async (req, res) => {
  try {
    const { candidateId, jobProfileId, startFromStage } = req.body;

    if (!candidateId) {
      return res.status(400).json({
        success: false,
        error: 'candidateId is required',
      });
    }

    if (!jobProfileId) {
      return res.status(400).json({
        success: false,
        error: 'jobProfileId is required',
      });
    }

    const batchId = await queueOrchestrator.processIndividualCandidate(
      candidateId,
      jobProfileId,
      startFromStage
    );

    return res.json({
      success: true,
      data: { batchId },
    });
  } catch (error) {
    logger.error('Failed to start individual candidate processing:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start candidate processing',
    });
  }
});

// Retry failed candidate stage
router.post('/candidate/retry', async (req, res) => {
  try {
    const { candidateId, jobProfileId, stage } = req.body;

    if (!candidateId || !jobProfileId || !stage) {
      return res.status(400).json({
        success: false,
        error: 'candidateId, jobProfileId, and stage are required',
      });
    }

    const batchId = await queueOrchestrator.retryFailedCandidateStage(
      candidateId,
      jobProfileId,
      stage
    );

    return res.json({
      success: true,
      data: { batchId },
    });
  } catch (error) {
    logger.error('Failed to retry candidate stage:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retry candidate stage',
    });
  }
});

// Pause queue processing
router.post('/pause', async (req, res) => {
  try {
    const { queueName } = req.body;

    if (queueName) {
      await queueManager.pauseQueue(queueName);
    } else {
      await queueOrchestrator.pauseProcessing();
    }

    return res.json({
      success: true,
      message: queueName ? `Queue ${queueName} paused` : 'All queues paused',
    });
  } catch (error) {
    logger.error('Failed to pause queue(s):', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to pause queue processing',
    });
  }
});

// Resume queue processing
router.post('/resume', async (req, res) => {
  try {
    const { queueName } = req.body;

    if (queueName) {
      await queueManager.resumeQueue(queueName);
    } else {
      await queueOrchestrator.resumeProcessing();
    }

    return res.json({
      success: true,
      message: queueName ? `Queue ${queueName} resumed` : 'All queues resumed',
    });
  } catch (error) {
    logger.error('Failed to resume queue(s):', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to resume queue processing',
    });
  }
});

// Retry failed jobs
router.post('/retry-failed', async (req, res) => {
  try {
    const { queueName } = req.body;

    if (queueName) {
      const retriedCount = await queueManager.retryFailedJobs(queueName);
      return res.json({
        success: true,
        data: { [queueName]: retriedCount },
      });
    } else {
      const results = await queueOrchestrator.retryAllFailedJobs();
      return res.json({
        success: true,
        data: results,
      });
    }
  } catch (error) {
    logger.error('Failed to retry failed jobs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retry failed jobs',
    });
  }
});

// Clean old jobs
router.post('/clean', async (req, res) => {
  try {
    const { gracePeriodMs = 24 * 60 * 60 * 1000 } = req.body; // Default 24 hours

    await queueOrchestrator.cleanupOldJobs(gracePeriodMs);

    return res.json({
      success: true,
      message: 'Old jobs cleaned successfully',
    });
  } catch (error) {
    logger.error('Failed to clean old jobs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clean old jobs',
    });
  }
});

// Get system status
router.get('/system/status', async (req, res) => {
  try {
    const status = await queueOrchestrator.getSystemStatus();
    return res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Failed to get system status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get system status',
    });
  }
});

// Get detailed queue metrics
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await queueMonitor.getDetailedQueueMetrics();
    return res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error('Failed to get queue metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get queue metrics',
    });
  }
});

// Get health report
router.get('/health', async (req, res) => {
  try {
    const healthReport = await queueMonitor.generateHealthReport();
    
    // Set appropriate HTTP status based on health
    let statusCode = 200;
    if (healthReport.summary.overallHealth === 'warning') {
      statusCode = 200; // Still OK, but with warnings
    } else if (healthReport.summary.overallHealth === 'critical') {
      statusCode = 503; // Service unavailable
    }

    return res.status(statusCode).json({
      success: true,
      data: healthReport,
    });
  } catch (error) {
    logger.error('Failed to get health report:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get health report',
    });
  }
});

export { router as queueRoutes };
