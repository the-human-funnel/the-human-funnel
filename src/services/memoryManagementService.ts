import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface MemoryStats {
  used: number;
  total: number;
  free: number;
  percentage: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface MemoryThresholds {
  warning: number; // Percentage
  critical: number; // Percentage
  cleanup: number; // Percentage
}

export interface ProcessingLimits {
  maxConcurrentJobs: number;
  maxBatchSize: number;
  maxFileSize: number; // bytes
  maxMemoryPerJob: number; // bytes
}

export class MemoryManagementService extends EventEmitter {
  private readonly thresholds: MemoryThresholds;
  private readonly limits: ProcessingLimits;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly monitoringIntervalMs = 30000; // 30 seconds
  private memoryHistory: MemoryStats[] = [];
  private readonly maxHistorySize = 100;
  private activeJobs = new Map<string, { startTime: Date; memoryAtStart: number }>();
  private cleanupCallbacks = new Set<() => Promise<void>>();

  constructor() {
    super();
    
    this.thresholds = {
      warning: 70,  // 70% memory usage
      critical: 85, // 85% memory usage
      cleanup: 90   // 90% memory usage - force cleanup
    };

    this.limits = {
      maxConcurrentJobs: this.calculateMaxConcurrentJobs(),
      maxBatchSize: this.calculateMaxBatchSize(),
      maxFileSize: 50 * 1024 * 1024, // 50MB per file
      maxMemoryPerJob: 100 * 1024 * 1024 // 100MB per job
    };

    this.startMonitoring();
    this.setupProcessHandlers();
  }

  /**
   * Calculate maximum concurrent jobs based on available memory
   */
  private calculateMaxConcurrentJobs(): number {
    const totalMemory = this.getTotalSystemMemory();
    const availableForJobs = totalMemory * 0.6; // Use 60% of total memory for jobs
    const memoryPerJob = this.limits?.maxMemoryPerJob || 100 * 1024 * 1024;
    
    return Math.max(1, Math.floor(availableForJobs / memoryPerJob));
  }

  /**
   * Calculate maximum batch size based on memory constraints
   */
  private calculateMaxBatchSize(): number {
    const totalMemory = this.getTotalSystemMemory();
    const availableForBatch = totalMemory * 0.4; // Use 40% of total memory for batch processing
    const memoryPerItem = 10 * 1024 * 1024; // Estimate 10MB per resume
    
    return Math.max(10, Math.floor(availableForBatch / memoryPerItem));
  }

  /**
   * Get total system memory
   */
  private getTotalSystemMemory(): number {
    const os = require('os');
    return os.totalmem();
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.monitoringIntervalMs);

    logger.info('Memory monitoring started', {
      service: 'memoryManagement',
      interval: this.monitoringIntervalMs,
      thresholds: this.thresholds,
      limits: this.limits
    });
  }

  /**
   * Stop memory monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Setup process handlers for graceful shutdown
   */
  private setupProcessHandlers(): void {
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('uncaughtException', (error) => this.handleUncaughtException(error));
    process.on('unhandledRejection', (reason) => this.handleUnhandledRejection(reason));
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): MemoryStats {
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

  /**
   * Check memory usage and trigger appropriate actions
   */
  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();
    
    // Add to history
    this.memoryHistory.push(stats);
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory.shift();
    }

    // Check thresholds
    if (stats.percentage >= this.thresholds.cleanup) {
      this.handleCriticalMemory(stats);
    } else if (stats.percentage >= this.thresholds.critical) {
      this.handleHighMemory(stats);
    } else if (stats.percentage >= this.thresholds.warning) {
      this.handleWarningMemory(stats);
    }

    // Emit memory stats event
    this.emit('memoryStats', stats);
  }

  /**
   * Handle warning level memory usage
   */
  private handleWarningMemory(stats: MemoryStats): void {
    logger.warn('Memory usage warning', {
      service: 'memoryManagement',
      memoryPercentage: stats.percentage,
      threshold: this.thresholds.warning,
      heapUsed: stats.heapUsed,
      rss: stats.rss
    });

    this.emit('memoryWarning', stats);
  }

  /**
   * Handle high memory usage
   */
  private handleHighMemory(stats: MemoryStats): void {
    logger.error('High memory usage detected', {
      service: 'memoryManagement',
      memoryPercentage: stats.percentage,
      threshold: this.thresholds.critical,
      heapUsed: stats.heapUsed,
      rss: stats.rss
    });

    // Trigger garbage collection
    this.forceGarbageCollection();
    
    // Reduce concurrent job limits
    this.limits.maxConcurrentJobs = Math.max(1, Math.floor(this.limits.maxConcurrentJobs * 0.7));
    this.limits.maxBatchSize = Math.max(10, Math.floor(this.limits.maxBatchSize * 0.7));

    this.emit('memoryHigh', stats);
  }

  /**
   * Handle critical memory usage
   */
  private handleCriticalMemory(stats: MemoryStats): void {
    logger.error('Critical memory usage - forcing cleanup', {
      service: 'memoryManagement',
      memoryPercentage: stats.percentage,
      threshold: this.thresholds.cleanup,
      heapUsed: stats.heapUsed,
      rss: stats.rss
    });

    // Force garbage collection
    this.forceGarbageCollection();
    
    // Execute cleanup callbacks
    this.executeCleanupCallbacks();
    
    // Drastically reduce limits
    this.limits.maxConcurrentJobs = 1;
    this.limits.maxBatchSize = Math.max(5, Math.floor(this.limits.maxBatchSize * 0.5));

    this.emit('memoryCritical', stats);
  }

  /**
   * Force garbage collection if available
   */
  private forceGarbageCollection(): void {
    if (global.gc) {
      try {
        global.gc();
        logger.info('Forced garbage collection completed');
      } catch (error) {
        logger.error('Failed to force garbage collection:', error);
      }
    } else {
      logger.warn('Garbage collection not available (run with --expose-gc flag)');
    }
  }

  /**
   * Execute all registered cleanup callbacks
   */
  private async executeCleanupCallbacks(): Promise<void> {
    const promises = Array.from(this.cleanupCallbacks).map(async (callback) => {
      try {
        await callback();
      } catch (error) {
        logger.error('Cleanup callback failed:', error);
      }
    });

    await Promise.allSettled(promises);
    logger.info(`Executed ${promises.length} cleanup callbacks`);
  }

  /**
   * Register a cleanup callback
   */
  registerCleanupCallback(callback: () => Promise<void>): void {
    this.cleanupCallbacks.add(callback);
  }

  /**
   * Unregister a cleanup callback
   */
  unregisterCleanupCallback(callback: () => Promise<void>): void {
    this.cleanupCallbacks.delete(callback);
  }

  /**
   * Check if we can start a new job based on memory constraints
   */
  canStartNewJob(): boolean {
    const stats = this.getMemoryStats();
    const activeJobCount = this.activeJobs.size;
    
    return (
      stats.percentage < this.thresholds.critical &&
      activeJobCount < this.limits.maxConcurrentJobs
    );
  }

  /**
   * Register a new job
   */
  registerJob(jobId: string): void {
    const stats = this.getMemoryStats();
    this.activeJobs.set(jobId, {
      startTime: new Date(),
      memoryAtStart: stats.heapUsed
    });

    logger.debug(`Job registered: ${jobId}`, {
      service: 'memoryManagement',
      activeJobs: this.activeJobs.size,
      memoryAtStart: stats.heapUsed
    });
  }

  /**
   * Unregister a completed job
   */
  unregisterJob(jobId: string): void {
    const jobInfo = this.activeJobs.get(jobId);
    if (jobInfo) {
      const stats = this.getMemoryStats();
      const duration = Date.now() - jobInfo.startTime.getTime();
      const memoryDelta = stats.heapUsed - jobInfo.memoryAtStart;

      logger.debug(`Job unregistered: ${jobId}`, {
        service: 'memoryManagement',
        duration,
        memoryDelta,
        activeJobs: this.activeJobs.size - 1
      });

      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Get current processing limits
   */
  getProcessingLimits(): ProcessingLimits {
    return { ...this.limits };
  }

  /**
   * Update processing limits
   */
  updateProcessingLimits(limits: Partial<ProcessingLimits>): void {
    Object.assign(this.limits, limits);
    
    logger.info('Processing limits updated', {
      service: 'memoryManagement',
      limits: this.limits
    });
  }

  /**
   * Get memory usage history
   */
  getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  /**
   * Get active job information
   */
  getActiveJobs(): Map<string, { startTime: Date; memoryAtStart: number }> {
    return new Map(this.activeJobs);
  }

  /**
   * Check if file size is within limits
   */
  isFileSizeAllowed(fileSize: number): boolean {
    return fileSize <= this.limits.maxFileSize;
  }

  /**
   * Check if batch size is within limits
   */
  isBatchSizeAllowed(batchSize: number): boolean {
    return batchSize <= this.limits.maxBatchSize;
  }

  /**
   * Get memory usage trend (increasing/decreasing/stable)
   */
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' {
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

    if (diff > 5) return 'increasing';
    if (diff < -5) return 'decreasing';
    return 'stable';
  }

  /**
   * Handle uncaught exceptions
   */
  private handleUncaughtException(error: Error): void {
    logger.error('Uncaught exception detected', error);
    
    // Force cleanup
    this.executeCleanupCallbacks();
    
    // Exit gracefully
    setTimeout(() => {
      process.exit(1);
    }, 5000);
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(reason: any): void {
    logger.error('Unhandled promise rejection detected', reason);
    
    // Force garbage collection
    this.forceGarbageCollection();
  }

  /**
   * Handle graceful shutdown
   */
  private async handleShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}, shutting down gracefully`);
    
    this.stopMonitoring();
    await this.executeCleanupCallbacks();
    
    process.exit(0);
  }

  /**
   * Health check for memory management service
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
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

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down memory management service');
    
    this.stopMonitoring();
    await this.executeCleanupCallbacks();
    
    this.activeJobs.clear();
    this.memoryHistory.length = 0;
    this.cleanupCallbacks.clear();
    this.removeAllListeners();
  }
}

// Export singleton instance
export const memoryManagementService = new MemoryManagementService();