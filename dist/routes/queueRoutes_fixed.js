"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueRoutes = void 0;
const express_1 = __importDefault(require("express"));
const queues_1 = require("../queues");
const queueOrchestrator_1 = require("../services/queueOrchestrator");
const queueMonitor_1 = require("../utils/queueMonitor");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
exports.queueRoutes = router;
router.get('/stats', async (req, res) => {
    try {
        const stats = await queues_1.queueManager.getAllQueueStats();
        return res.json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get queue stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get queue statistics',
        });
    }
});
router.get('/stats/:queueName', async (req, res) => {
    try {
        const { queueName } = req.params;
        const stats = await queues_1.queueManager.getQueueStats(queueName);
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get queue stats:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get queue statistics',
        });
    }
});
router.get('/batch/:batchId/progress', async (req, res) => {
    try {
        const { batchId } = req.params;
        const progress = await queues_1.queueManager.getBatchProgress(batchId);
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get batch progress:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get batch progress',
        });
    }
});
router.get('/job/:queueName/:jobId/progress', async (req, res) => {
    try {
        const { queueName, jobId } = req.params;
        const progress = await queues_1.queueManager.getJobProgress(queueName, jobId);
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
    }
    catch (error) {
        logger_1.logger.error('Failed to get job progress:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get job progress',
        });
    }
});
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
        const batch = await queueOrchestrator_1.queueOrchestrator.processCandidateBatch(candidateIds, jobProfileId);
        return res.json({
            success: true,
            data: batch,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start batch processing:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to start batch processing',
        });
    }
});
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
        const batchId = await queueOrchestrator_1.queueOrchestrator.processIndividualCandidate(candidateId, jobProfileId, startFromStage);
        return res.json({
            success: true,
            data: { batchId },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start individual candidate processing:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to start candidate processing',
        });
    }
});
router.post('/candidate/retry', async (req, res) => {
    try {
        const { candidateId, jobProfileId, stage } = req.body;
        if (!candidateId || !jobProfileId || !stage) {
            return res.status(400).json({
                success: false,
                error: 'candidateId, jobProfileId, and stage are required',
            });
        }
        const batchId = await queueOrchestrator_1.queueOrchestrator.retryFailedCandidateStage(candidateId, jobProfileId, stage);
        return res.json({
            success: true,
            data: { batchId },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to retry candidate stage:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to retry candidate stage',
        });
    }
});
router.post('/pause', async (req, res) => {
    try {
        const { queueName } = req.body;
        if (queueName) {
            await queues_1.queueManager.pauseQueue(queueName);
        }
        else {
            await queueOrchestrator_1.queueOrchestrator.pauseProcessing();
        }
        return res.json({
            success: true,
            message: queueName ? `Queue ${queueName} paused` : 'All queues paused',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to pause queue(s):', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to pause queue processing',
        });
    }
});
router.post('/resume', async (req, res) => {
    try {
        const { queueName } = req.body;
        if (queueName) {
            await queues_1.queueManager.resumeQueue(queueName);
        }
        else {
            await queueOrchestrator_1.queueOrchestrator.resumeProcessing();
        }
        return res.json({
            success: true,
            message: queueName ? `Queue ${queueName} resumed` : 'All queues resumed',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to resume queue(s):', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to resume queue processing',
        });
    }
});
router.post('/retry-failed', async (req, res) => {
    try {
        const { queueName } = req.body;
        if (queueName) {
            const retriedCount = await queues_1.queueManager.retryFailedJobs(queueName);
            return res.json({
                success: true,
                data: { [queueName]: retriedCount },
            });
        }
        else {
            const results = await queueOrchestrator_1.queueOrchestrator.retryAllFailedJobs();
            return res.json({
                success: true,
                data: results,
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to retry failed jobs:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to retry failed jobs',
        });
    }
});
router.post('/clean', async (req, res) => {
    try {
        const { gracePeriodMs = 24 * 60 * 60 * 1000 } = req.body;
        await queueOrchestrator_1.queueOrchestrator.cleanupOldJobs(gracePeriodMs);
        return res.json({
            success: true,
            message: 'Old jobs cleaned successfully',
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to clean old jobs:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clean old jobs',
        });
    }
});
router.get('/system/status', async (req, res) => {
    try {
        const status = await queueOrchestrator_1.queueOrchestrator.getSystemStatus();
        return res.json({
            success: true,
            data: status,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get system status:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get system status',
        });
    }
});
router.get('/metrics', async (req, res) => {
    try {
        const metrics = await queueMonitor_1.queueMonitor.getDetailedQueueMetrics();
        return res.json({
            success: true,
            data: metrics,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get queue metrics:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get queue metrics',
        });
    }
});
router.get('/health', async (req, res) => {
    try {
        const healthReport = await queueMonitor_1.queueMonitor.generateHealthReport();
        let statusCode = 200;
        if (healthReport.summary.overallHealth === 'warning') {
            statusCode = 200;
        }
        else if (healthReport.summary.overallHealth === 'critical') {
            statusCode = 503;
        }
        return res.status(statusCode).json({
            success: true,
            data: healthReport,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get health report:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get health report',
        });
    }
});
//# sourceMappingURL=queueRoutes_fixed.js.map