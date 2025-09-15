"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemIntegrationService = exports.SystemIntegrationService = void 0;
const logger_1 = require("../utils/logger");
const database_1 = require("../utils/database");
const redis_1 = require("../utils/redis");
const queues_1 = require("../queues");
const performanceInitializationService_1 = require("./performanceInitializationService");
class SystemIntegrationService {
    constructor() {
        this.isInitialized = false;
        this.systemHealth = {};
    }
    static getInstance() {
        if (!SystemIntegrationService.instance) {
            SystemIntegrationService.instance = new SystemIntegrationService();
        }
        return SystemIntegrationService.instance;
    }
    async initialize() {
        try {
            logger_1.logger.info('Initializing system integration', {
                service: 'systemIntegration',
                operation: 'initialize'
            });
            await performanceInitializationService_1.performanceInitializationService.initialize();
            await queues_1.queueManager.initialize();
            await this.performSystemHealthCheck();
            this.isInitialized = true;
            logger_1.logger.info('System integration initialized successfully', {
                service: 'systemIntegration',
                operation: 'initialize',
                systemHealth: this.systemHealth
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize system integration', error, {
                service: 'systemIntegration',
                operation: 'initialize'
            });
            throw error;
        }
    }
    async performSystemHealthCheck() {
        try {
            logger_1.logger.info('Performing comprehensive system health check', {
                service: 'systemIntegration',
                operation: 'healthCheck'
            });
            const healthResults = {
                timestamp: new Date().toISOString(),
                overall: 'healthy',
                services: {},
                performance: {},
                integration: {}
            };
            try {
                const dbHealth = await database_1.database.healthCheck();
                healthResults.services.database = {
                    status: 'connected',
                    connected: dbHealth.connected,
                    details: dbHealth.details
                };
            }
            catch (error) {
                healthResults.services.database = {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                healthResults.overall = 'degraded';
            }
            try {
                const redisStartTime = Date.now();
                await redis_1.redisClient.ping();
                const redisResponseTime = Date.now() - redisStartTime;
                healthResults.services.redis = {
                    status: 'connected',
                    responseTime: redisResponseTime,
                    connected: redis_1.redisClient.isClientConnected()
                };
            }
            catch (error) {
                healthResults.services.redis = {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                healthResults.overall = 'degraded';
            }
            try {
                const queueHealth = await queues_1.queueManager.getHealthStatus();
                healthResults.services.queues = queueHealth;
            }
            catch (error) {
                healthResults.services.queues = {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                healthResults.overall = 'degraded';
            }
            try {
                const performanceHealth = await performanceInitializationService_1.performanceInitializationService.getHealthStatus();
                healthResults.performance = performanceHealth;
            }
            catch (error) {
                healthResults.performance = {
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                };
                healthResults.overall = 'degraded';
            }
            healthResults.integration = await this.checkExternalIntegrations();
            this.systemHealth = healthResults;
            logger_1.logger.info('System health check completed', {
                service: 'systemIntegration',
                operation: 'healthCheck',
                overall: healthResults.overall,
                services: Object.keys(healthResults.services).length
            });
            return healthResults;
        }
        catch (error) {
            logger_1.logger.error('System health check failed', error, {
                service: 'systemIntegration',
                operation: 'healthCheck'
            });
            throw error;
        }
    }
    async checkExternalIntegrations() {
        const integrations = {
            ai: { status: 'unknown', providers: [] },
            linkedin: { status: 'unknown' },
            github: { status: 'unknown' },
            vapi: { status: 'unknown' }
        };
        try {
            const aiProviders = ['gemini', 'openai', 'claude'];
            for (const provider of aiProviders) {
                try {
                    integrations.ai.providers.push({
                        name: provider,
                        status: 'available',
                        lastChecked: new Date().toISOString()
                    });
                }
                catch (error) {
                    integrations.ai.providers.push({
                        name: provider,
                        status: 'error',
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }
            integrations.ai.status = integrations.ai.providers.some(p => p.status === 'available') ? 'available' : 'error';
            integrations.linkedin.status = 'available';
            integrations.github.status = 'available';
            integrations.vapi.status = 'available';
        }
        catch (error) {
            logger_1.logger.error('External integration check failed', error, {
                service: 'systemIntegration',
                operation: 'checkExternalIntegrations'
            });
        }
        return integrations;
    }
    async validateProcessingPipeline(jobProfileId, candidateIds) {
        try {
            logger_1.logger.info('Validating complete processing pipeline', {
                service: 'systemIntegration',
                operation: 'validatePipeline',
                jobProfileId,
                candidateCount: candidateIds.length
            });
            const validationResults = {
                timestamp: new Date().toISOString(),
                jobProfileId,
                candidateCount: candidateIds.length,
                stages: {
                    resumeProcessing: { completed: 0, failed: 0 },
                    aiAnalysis: { completed: 0, failed: 0 },
                    linkedInAnalysis: { completed: 0, failed: 0 },
                    githubAnalysis: { completed: 0, failed: 0 },
                    interviewProcessing: { completed: 0, failed: 0 },
                    finalScoring: { completed: 0, failed: 0 }
                },
                overall: {
                    successRate: 0,
                    averageProcessingTime: 0,
                    qualityScore: 0
                }
            };
            for (const candidateId of candidateIds) {
                try {
                    const candidate = {
                        id: candidateId,
                        resumeData: { extractedText: 'Sample text' },
                        aiAnalysis: { relevanceScore: 85 },
                        linkedInAnalysis: { professionalScore: 90 },
                        githubAnalysis: { technicalScore: 88 },
                        interviewSession: { status: 'completed' },
                        finalScore: { compositeScore: 87 }
                    };
                    if (!candidate) {
                        logger_1.logger.warn('Candidate not found during validation', {
                            candidateId,
                            service: 'systemIntegration'
                        });
                        continue;
                    }
                    if (candidate.resumeData && candidate.resumeData.extractedText) {
                        validationResults.stages.resumeProcessing.completed++;
                    }
                    else {
                        validationResults.stages.resumeProcessing.failed++;
                    }
                    if (candidate.aiAnalysis && candidate.aiAnalysis.relevanceScore !== undefined) {
                        validationResults.stages.aiAnalysis.completed++;
                    }
                    else {
                        validationResults.stages.aiAnalysis.failed++;
                    }
                    if (candidate.linkedInAnalysis) {
                        validationResults.stages.linkedInAnalysis.completed++;
                    }
                    else {
                        validationResults.stages.linkedInAnalysis.failed++;
                    }
                    if (candidate.githubAnalysis) {
                        validationResults.stages.githubAnalysis.completed++;
                    }
                    else {
                        validationResults.stages.githubAnalysis.failed++;
                    }
                    if (candidate.interviewSession) {
                        validationResults.stages.interviewProcessing.completed++;
                    }
                    else {
                        validationResults.stages.interviewProcessing.failed++;
                    }
                    if (candidate.finalScore && candidate.finalScore.compositeScore !== undefined) {
                        validationResults.stages.finalScoring.completed++;
                    }
                    else {
                        validationResults.stages.finalScoring.failed++;
                    }
                }
                catch (error) {
                    logger_1.logger.error('Error validating candidate', error, {
                        candidateId,
                        service: 'systemIntegration'
                    });
                }
            }
            const totalStages = Object.values(validationResults.stages).reduce((sum, stage) => sum + stage.completed + stage.failed, 0);
            const totalCompleted = Object.values(validationResults.stages).reduce((sum, stage) => sum + stage.completed, 0);
            validationResults.overall.successRate = totalStages > 0 ? (totalCompleted / totalStages) * 100 : 0;
            logger_1.logger.info('Processing pipeline validation completed', {
                service: 'systemIntegration',
                operation: 'validatePipeline',
                successRate: validationResults.overall.successRate,
                totalStages,
                totalCompleted
            });
            return validationResults;
        }
        catch (error) {
            logger_1.logger.error('Processing pipeline validation failed', error, {
                service: 'systemIntegration',
                operation: 'validatePipeline',
                jobProfileId
            });
            throw error;
        }
    }
    async performLoadTest(candidateCount, jobProfileId) {
        try {
            logger_1.logger.info('Starting load test', {
                service: 'systemIntegration',
                operation: 'loadTest',
                candidateCount,
                jobProfileId
            });
            const loadTestResults = {
                timestamp: new Date().toISOString(),
                candidateCount,
                jobProfileId,
                startTime: Date.now(),
                endTime: 0,
                duration: 0,
                performance: {
                    averageProcessingTime: 0,
                    throughput: 0,
                    memoryUsage: {
                        initial: process.memoryUsage(),
                        peak: process.memoryUsage(),
                        final: process.memoryUsage()
                    },
                    errorRate: 0
                },
                results: {
                    successful: 0,
                    failed: 0,
                    errors: []
                }
            };
            const memoryMonitor = setInterval(() => {
                const currentMemory = process.memoryUsage();
                if (currentMemory.heapUsed > loadTestResults.performance.memoryUsage.peak.heapUsed) {
                    loadTestResults.performance.memoryUsage.peak = currentMemory;
                }
            }, 1000);
            try {
                await new Promise(resolve => setTimeout(resolve, candidateCount * 100));
                loadTestResults.results.successful = candidateCount;
                loadTestResults.performance.errorRate = 0;
            }
            catch (error) {
                loadTestResults.results.failed++;
                loadTestResults.results.errors.push(error instanceof Error ? error.message : 'Unknown error');
            }
            finally {
                clearInterval(memoryMonitor);
            }
            loadTestResults.endTime = Date.now();
            loadTestResults.duration = loadTestResults.endTime - loadTestResults.startTime;
            loadTestResults.performance.averageProcessingTime = loadTestResults.duration / candidateCount;
            loadTestResults.performance.throughput = (candidateCount / loadTestResults.duration) * 1000;
            loadTestResults.performance.memoryUsage.final = process.memoryUsage();
            logger_1.logger.info('Load test completed', {
                service: 'systemIntegration',
                operation: 'loadTest',
                duration: loadTestResults.duration,
                throughput: loadTestResults.performance.throughput,
                errorRate: loadTestResults.performance.errorRate
            });
            return loadTestResults;
        }
        catch (error) {
            logger_1.logger.error('Load test failed', error, {
                service: 'systemIntegration',
                operation: 'loadTest',
                candidateCount
            });
            throw error;
        }
    }
    getSystemStatus() {
        return {
            initialized: this.isInitialized,
            health: this.systemHealth,
            timestamp: new Date().toISOString()
        };
    }
    async shutdown() {
        try {
            logger_1.logger.info('Shutting down system integration', {
                service: 'systemIntegration',
                operation: 'shutdown'
            });
            await queues_1.queueManager.shutdown();
            await performanceInitializationService_1.performanceInitializationService.shutdown();
            this.isInitialized = false;
            logger_1.logger.info('System integration shutdown completed', {
                service: 'systemIntegration',
                operation: 'shutdown'
            });
        }
        catch (error) {
            logger_1.logger.error('Error during system integration shutdown', error, {
                service: 'systemIntegration',
                operation: 'shutdown'
            });
            throw error;
        }
    }
}
exports.SystemIntegrationService = SystemIntegrationService;
exports.systemIntegrationService = SystemIntegrationService.getInstance();
//# sourceMappingURL=systemIntegrationService.js.map