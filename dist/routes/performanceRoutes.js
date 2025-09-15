"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const performanceInitializationService_1 = require("../services/performanceInitializationService");
const cachingService_1 = require("../services/cachingService");
const connectionPoolService_1 = require("../services/connectionPoolService");
const memoryManagementService_1 = require("../services/memoryManagementService");
const optimizedFileProcessingService_1 = require("../services/optimizedFileProcessingService");
const database_1 = require("../utils/database");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.get('/health', auth_1.authenticate, async (req, res) => {
    try {
        const healthStatus = await performanceInitializationService_1.performanceInitializationService.getHealthStatus();
        res.json({
            success: true,
            data: healthStatus
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get performance health status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance health status'
        });
    }
});
router.get('/stats', auth_1.authenticate, async (req, res) => {
    try {
        const performanceStats = await performanceInitializationService_1.performanceInitializationService.getPerformanceStats();
        res.json({
            success: true,
            data: performanceStats
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get performance statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance statistics'
        });
    }
});
router.get('/cache/stats', auth_1.authenticate, async (req, res) => {
    try {
        const cacheStats = await cachingService_1.cachingService.getStats();
        res.json({
            success: true,
            data: cacheStats
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get cache statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get cache statistics'
        });
    }
});
router.delete('/cache', auth_1.authenticate, async (req, res) => {
    try {
        const { type, pattern } = req.query;
        let deletedCount = 0;
        if (type && typeof type === 'string') {
            deletedCount = await cachingService_1.cachingService.invalidateType(type);
        }
        else if (pattern && typeof pattern === 'string') {
            deletedCount = await cachingService_1.cachingService.invalidateByPattern(pattern);
        }
        else {
            return res.status(400).json({
                success: false,
                error: 'Either type or pattern parameter is required'
            });
        }
        return res.json({
            success: true,
            data: {
                deletedCount,
                type: type || null,
                pattern: pattern || null
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to clear cache:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to clear cache'
        });
    }
});
router.get('/connections/stats', auth_1.authenticate, async (req, res) => {
    try {
        const connectionStats = connectionPoolService_1.connectionPoolService.getStats();
        res.json({
            success: true,
            data: connectionStats
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get connection statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get connection statistics'
        });
    }
});
router.post('/connections/reset-stats', auth_1.authenticate, async (req, res) => {
    try {
        const { endpoint } = req.body;
        connectionPoolService_1.connectionPoolService.resetStats(endpoint);
        res.json({
            success: true,
            message: endpoint ? `Statistics reset for endpoint: ${endpoint}` : 'All connection statistics reset'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to reset connection statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset connection statistics'
        });
    }
});
router.get('/memory/stats', auth_1.authenticate, async (req, res) => {
    try {
        const memoryStats = memoryManagementService_1.memoryManagementService.getMemoryStats();
        const memoryHistory = memoryManagementService_1.memoryManagementService.getMemoryHistory();
        const memoryTrend = memoryManagementService_1.memoryManagementService.getMemoryTrend();
        const activeJobs = memoryManagementService_1.memoryManagementService.getActiveJobs();
        const processingLimits = memoryManagementService_1.memoryManagementService.getProcessingLimits();
        res.json({
            success: true,
            data: {
                current: memoryStats,
                history: memoryHistory,
                trend: memoryTrend,
                activeJobs: Array.from(activeJobs.entries()).map(([jobId, info]) => ({
                    jobId,
                    ...info
                })),
                processingLimits
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get memory statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get memory statistics'
        });
    }
});
router.put('/memory/limits', auth_1.authenticate, async (req, res) => {
    try {
        const { maxConcurrentJobs, maxBatchSize, maxFileSize, maxMemoryPerJob } = req.body;
        const updates = {};
        if (maxConcurrentJobs !== undefined)
            updates.maxConcurrentJobs = maxConcurrentJobs;
        if (maxBatchSize !== undefined)
            updates.maxBatchSize = maxBatchSize;
        if (maxFileSize !== undefined)
            updates.maxFileSize = maxFileSize;
        if (maxMemoryPerJob !== undefined)
            updates.maxMemoryPerJob = maxMemoryPerJob;
        memoryManagementService_1.memoryManagementService.updateProcessingLimits(updates);
        res.json({
            success: true,
            data: {
                updatedLimits: memoryManagementService_1.memoryManagementService.getProcessingLimits(),
                message: 'Processing limits updated successfully'
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update processing limits:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update processing limits'
        });
    }
});
router.post('/memory/gc', auth_1.authenticate, async (req, res) => {
    try {
        if (global.gc) {
            const beforeStats = memoryManagementService_1.memoryManagementService.getMemoryStats();
            global.gc();
            const afterStats = memoryManagementService_1.memoryManagementService.getMemoryStats();
            res.json({
                success: true,
                data: {
                    message: 'Garbage collection executed',
                    memoryBefore: beforeStats,
                    memoryAfter: afterStats,
                    memoryFreed: beforeStats.heapUsed - afterStats.heapUsed
                }
            });
        }
        else {
            res.status(400).json({
                success: false,
                error: 'Garbage collection not available (run with --expose-gc flag)'
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to execute garbage collection:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to execute garbage collection'
        });
    }
});
router.get('/file-processing/stats', auth_1.authenticate, async (req, res) => {
    try {
        const processingOptions = optimizedFileProcessingService_1.optimizedFileProcessingService.getProcessingOptions();
        res.json({
            success: true,
            data: {
                processingOptions,
                healthStatus: await optimizedFileProcessingService_1.optimizedFileProcessingService.healthCheck()
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get file processing statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get file processing statistics'
        });
    }
});
router.put('/file-processing/options', auth_1.authenticate, async (req, res) => {
    try {
        const { maxConcurrentFiles, chunkSize, useStreaming, enableCaching } = req.body;
        const updates = {};
        if (maxConcurrentFiles !== undefined)
            updates.maxConcurrentFiles = maxConcurrentFiles;
        if (chunkSize !== undefined)
            updates.chunkSize = chunkSize;
        if (useStreaming !== undefined)
            updates.useStreaming = useStreaming;
        if (enableCaching !== undefined)
            updates.enableCaching = enableCaching;
        optimizedFileProcessingService_1.optimizedFileProcessingService.updateProcessingOptions(updates);
        res.json({
            success: true,
            data: {
                updatedOptions: optimizedFileProcessingService_1.optimizedFileProcessingService.getProcessingOptions(),
                message: 'File processing options updated successfully'
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to update file processing options:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update file processing options'
        });
    }
});
router.post('/file-processing/cleanup', auth_1.authenticate, async (req, res) => {
    try {
        await optimizedFileProcessingService_1.optimizedFileProcessingService.cleanup();
        res.json({
            success: true,
            message: 'Temporary files cleaned up successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to cleanup temporary files:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cleanup temporary files'
        });
    }
});
router.get('/database/stats', auth_1.authenticate, async (req, res) => {
    try {
        const dbStats = await database_1.database.getPerformanceStats();
        const slowQueries = await database_1.database.analyzeSlowQueries();
        res.json({
            success: true,
            data: {
                performance: dbStats,
                slowQueries: slowQueries.slice(0, 10),
                connectionStatus: database_1.database.getConnectionStatus()
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get database statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get database statistics'
        });
    }
});
router.post('/database/reindex', auth_1.authenticate, async (req, res) => {
    try {
        await database_1.database.createIndexes();
        res.json({
            success: true,
            message: 'Database indexes recreated successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to recreate database indexes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to recreate database indexes'
        });
    }
});
exports.default = router;
//# sourceMappingURL=performanceRoutes.js.map