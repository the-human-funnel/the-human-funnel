"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryManagementService = exports.MemoryManagementService = void 0;
const logger_1 = require("../utils/logger");
const events_1 = require("events");
class MemoryManagementService extends events_1.EventEmitter {
    constructor() {
        super();
        this.monitoringInterval = null;
        this.monitoringIntervalMs = 30000;
        this.memoryHistory = [];
        this.maxHistorySize = 100;
        this.activeJobs = new Map();
        this.cleanupCallbacks = new Set();
        this.thresholds = {
            warning: 70,
            critical: 85,
            cleanup: 90
        };
        this.limits = {
            maxConcurrentJobs: this.calculateMaxConcurrentJobs(),
            maxBatchSize: this.calculateMaxBatchSize(),
            maxFileSize: 50 * 1024 * 1024,
            maxMemoryPerJob: 100 * 1024 * 1024
        };
        this.startMonitoring();
        this.setupProcessHandlers();
    }
    calculateMaxConcurrentJobs() {
        const totalMemory = this.getTotalSystemMemory();
        const availableForJobs = totalMemory * 0.6;
        const memoryPerJob = this.limits?.maxMemoryPerJob || 100 * 1024 * 1024;
        return Math.max(1, Math.floor(availableForJobs / memoryPerJob));
    }
    calculateMaxBatchSize() {
        const totalMemory = this.getTotalSystemMemory();
        const availableForBatch = totalMemory * 0.4;
        const memoryPerItem = 10 * 1024 * 1024;
        return Math.max(10, Math.floor(availableForBatch / memoryPerItem));
    }
    getTotalSystemMemory() {
        const os = require('os');
        return os.totalmem();
    }
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, this.monitoringIntervalMs);
        logger_1.logger.info('Memory monitoring started', {
            service: 'memoryManagement',
            interval: this.monitoringIntervalMs,
            thresholds: this.thresholds,
            limits: this.limits
        });
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
    setupProcessHandlers() {
        process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
        process.on('SIGINT', () => this.handleShutdown('SIGINT'));
        process.on('uncaughtException', (error) => this.handleUncaughtException(error));
        process.on('unhandledRejection', (reason) => this.handleUnhandledRejection(reason));
    }
    getMemoryStats() {
        const memUsage = process.memoryUsage();
        const os = require('os');
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        return {
            used: usedMem,
            total: totalMem,
            free: freeMem,
            percentage: (usedMem / totalMem) * 100,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss
        };
    }
    checkMemoryUsage() {
        const stats = this.getMemoryStats();
        this.memoryHistory.push(stats);
        if (this.memoryHistory.length > this.maxHistorySize) {
            this.memoryHistory.shift();
        }
        if (stats.percentage >= this.thresholds.cleanup) {
            this.handleCriticalMemory(stats);
        }
        else if (stats.percentage >= this.thresholds.critical) {
            this.handleHighMemory(stats);
        }
        else if (stats.percentage >= this.thresholds.warning) {
            this.handleWarningMemory(stats);
        }
        this.emit('memoryStats', stats);
    }
    handleWarningMemory(stats) {
        logger_1.logger.warn('Memory usage warning', {
            service: 'memoryManagement',
            memoryPercentage: stats.percentage,
            threshold: this.thresholds.warning,
            heapUsed: stats.heapUsed,
            rss: stats.rss
        });
        this.emit('memoryWarning', stats);
    }
    handleHighMemory(stats) {
        logger_1.logger.error('High memory usage detected', {
            service: 'memoryManagement',
            memoryPercentage: stats.percentage,
            threshold: this.thresholds.critical,
            heapUsed: stats.heapUsed,
            rss: stats.rss
        });
        this.forceGarbageCollection();
        this.limits.maxConcurrentJobs = Math.max(1, Math.floor(this.limits.maxConcurrentJobs * 0.7));
        this.limits.maxBatchSize = Math.max(10, Math.floor(this.limits.maxBatchSize * 0.7));
        this.emit('memoryHigh', stats);
    }
    handleCriticalMemory(stats) {
        logger_1.logger.error('Critical memory usage - forcing cleanup', {
            service: 'memoryManagement',
            memoryPercentage: stats.percentage,
            threshold: this.thresholds.cleanup,
            heapUsed: stats.heapUsed,
            rss: stats.rss
        });
        this.forceGarbageCollection();
        this.executeCleanupCallbacks();
        this.limits.maxConcurrentJobs = 1;
        this.limits.maxBatchSize = Math.max(5, Math.floor(this.limits.maxBatchSize * 0.5));
        this.emit('memoryCritical', stats);
    }
    forceGarbageCollection() {
        if (global.gc) {
            try {
                global.gc();
                logger_1.logger.info('Forced garbage collection completed');
            }
            catch (error) {
                logger_1.logger.error('Failed to force garbage collection:', error);
            }
        }
        else {
            logger_1.logger.warn('Garbage collection not available (run with --expose-gc flag)');
        }
    }
    async executeCleanupCallbacks() {
        const promises = Array.from(this.cleanupCallbacks).map(async (callback) => {
            try {
                await callback();
            }
            catch (error) {
                logger_1.logger.error('Cleanup callback failed:', error);
            }
        });
        await Promise.allSettled(promises);
        logger_1.logger.info(`Executed ${promises.length} cleanup callbacks`);
    }
    registerCleanupCallback(callback) {
        this.cleanupCallbacks.add(callback);
    }
    unregisterCleanupCallback(callback) {
        this.cleanupCallbacks.delete(callback);
    }
    canStartNewJob() {
        const stats = this.getMemoryStats();
        const activeJobCount = this.activeJobs.size;
        return (stats.percentage < this.thresholds.critical &&
            activeJobCount < this.limits.maxConcurrentJobs);
    }
    registerJob(jobId) {
        const stats = this.getMemoryStats();
        this.activeJobs.set(jobId, {
            startTime: new Date(),
            memoryAtStart: stats.heapUsed
        });
        logger_1.logger.debug(`Job registered: ${jobId}`, {
            service: 'memoryManagement',
            activeJobs: this.activeJobs.size,
            memoryAtStart: stats.heapUsed
        });
    }
    unregisterJob(jobId) {
        const jobInfo = this.activeJobs.get(jobId);
        if (jobInfo) {
            const stats = this.getMemoryStats();
            const duration = Date.now() - jobInfo.startTime.getTime();
            const memoryDelta = stats.heapUsed - jobInfo.memoryAtStart;
            logger_1.logger.debug(`Job unregistered: ${jobId}`, {
                service: 'memoryManagement',
                duration,
                memoryDelta,
                activeJobs: this.activeJobs.size - 1
            });
            this.activeJobs.delete(jobId);
        }
    }
    getProcessingLimits() {
        return { ...this.limits };
    }
    updateProcessingLimits(limits) {
        Object.assign(this.limits, limits);
        logger_1.logger.info('Processing limits updated', {
            service: 'memoryManagement',
            limits: this.limits
        });
    }
    getMemoryHistory() {
        return [...this.memoryHistory];
    }
    getActiveJobs() {
        return new Map(this.activeJobs);
    }
    isFileSizeAllowed(fileSize) {
        return fileSize <= this.limits.maxFileSize;
    }
    isBatchSizeAllowed(batchSize) {
        return batchSize <= this.limits.maxBatchSize;
    }
    getMemoryTrend() {
        if (this.memoryHistory.length < 5) {
            return 'stable';
        }
        const recent = this.memoryHistory.slice(-5);
        const first = recent[0]?.percentage;
        const last = recent[recent.length - 1]?.percentage;
        if (first === undefined || last === undefined) {
            return 'stable';
        }
        const diff = last - first;
        if (diff > 5)
            return 'increasing';
        if (diff < -5)
            return 'decreasing';
        return 'stable';
    }
    handleUncaughtException(error) {
        logger_1.logger.error('Uncaught exception detected', error);
        this.executeCleanupCallbacks();
        setTimeout(() => {
            process.exit(1);
        }, 5000);
    }
    handleUnhandledRejection(reason) {
        logger_1.logger.error('Unhandled promise rejection detected', reason);
        this.forceGarbageCollection();
    }
    async handleShutdown(signal) {
        logger_1.logger.info(`Received ${signal}, shutting down gracefully`);
        this.stopMonitoring();
        await this.executeCleanupCallbacks();
        process.exit(0);
    }
    async healthCheck() {
        const stats = this.getMemoryStats();
        const trend = this.getMemoryTrend();
        const healthy = stats.percentage < this.thresholds.critical;
        return {
            healthy,
            details: {
                memoryStats: stats,
                memoryTrend: trend,
                activeJobs: this.activeJobs.size,
                processingLimits: this.limits,
                thresholds: this.thresholds,
                historySize: this.memoryHistory.length
            }
        };
    }
    async shutdown() {
        logger_1.logger.info('Shutting down memory management service');
        this.stopMonitoring();
        await this.executeCleanupCallbacks();
        this.activeJobs.clear();
        this.memoryHistory.length = 0;
        this.cleanupCallbacks.clear();
        this.removeAllListeners();
    }
}
exports.MemoryManagementService = MemoryManagementService;
exports.memoryManagementService = new MemoryManagementService();
//# sourceMappingURL=memoryManagementService.js.map