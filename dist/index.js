"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./utils/config");
const routes_1 = __importDefault(require("./routes"));
const test_models_1 = __importDefault(require("./models/test-models"));
const queues_1 = require("./queues");
const queueMonitor_1 = require("./utils/queueMonitor");
const rateLimiting_1 = require("./middleware/rateLimiting");
const auditLog_1 = require("./middleware/auditLog");
const validation_1 = require("./middleware/validation");
const logger_1 = require("./utils/logger");
const errorHandling_1 = require("./middleware/errorHandling");
const healthCheckService_1 = require("./services/healthCheckService");
const monitoringService_1 = require("./services/monitoringService");
const alertingService_1 = require("./services/alertingService");
const performanceInitializationService_1 = require("./services/performanceInitializationService");
const app = (0, express_1.default)();
(0, errorHandling_1.setupUnhandledRejectionHandler)();
if (config_1.config.security.trustProxy) {
    app.set('trust proxy', 1);
}
app.use(errorHandling_1.requestId);
app.use(errorHandling_1.performanceMonitoring);
app.use((0, errorHandling_1.requestTimeout)(30000));
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    frameguard: { action: 'deny' }
}));
app.use((0, cors_1.default)({
    origin: config_1.config.security.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(rateLimiting_1.generalRateLimit);
app.use(auditLog_1.auditLog);
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        if (buf.length > 1024 * 1024) {
            logger_1.logger.warn('Large payload received', {
                size: buf.length,
                ip: req.ip,
                path: req.path,
                method: req.method
            });
        }
    }
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use(validation_1.sanitizeInput);
app.use('/api', routes_1.default);
const frontendBuildPath = path_1.default.join(__dirname, '../frontend/build');
app.use(express_1.default.static(frontendBuildPath));
app.get(/^(?!\/api).*$/, (req, res) => {
    res.sendFile(path_1.default.join(frontendBuildPath, 'index.html'));
});
app.use(errorHandling_1.notFoundHandler);
app.use(errorHandling_1.globalErrorHandler);
async function startApplication() {
    try {
        logger_1.logger.info('Job Candidate Filtering Funnel System starting...', {
            service: 'application',
            operation: 'startup'
        });
        await performanceInitializationService_1.performanceInitializationService.initialize();
        logger_1.logger.info('Performance optimizations initialized successfully', {
            service: 'application',
            operation: 'startup'
        });
        const performanceHealth = await performanceInitializationService_1.performanceInitializationService.getHealthStatus();
        logger_1.logger.info('Performance health check completed', {
            service: 'application',
            operation: 'startup',
            performanceHealth
        });
        await queues_1.queueManager.initialize();
        logger_1.logger.info('Queue system initialized successfully', {
            service: 'application',
            operation: 'startup'
        });
        queueMonitor_1.queueMonitor.startMonitoring();
        logger_1.logger.info('Queue monitoring started', {
            service: 'application',
            operation: 'startup'
        });
        if (process.env.NODE_ENV !== 'production') {
            await (0, test_models_1.default)();
            logger_1.logger.info('Test models executed', {
                service: 'application',
                operation: 'startup'
            });
        }
        const server = app.listen(config_1.config.server.port, () => {
            logger_1.logger.info('HTTP server started', {
                service: 'application',
                operation: 'startup',
                port: config_1.config.server.port,
                environment: config_1.config.server.nodeEnv,
                apiUrl: `http://localhost:${config_1.config.server.port}/api`
            });
        });
        server.on('connection', () => {
            healthCheckService_1.healthCheckService.incrementConnections();
        });
        server.on('close', () => {
            healthCheckService_1.healthCheckService.decrementConnections();
        });
        const gracefulShutdown = async (signal) => {
            logger_1.logger.info(`${signal} received, shutting down gracefully`, {
                service: 'application',
                operation: 'shutdown'
            });
            server.close(async () => {
                try {
                    alertingService_1.alertingService.shutdown();
                    queueMonitor_1.queueMonitor.stopMonitoring();
                    await queues_1.queueManager.shutdown();
                    logger_1.logger.info('Queue system shutdown completed', {
                        service: 'application',
                        operation: 'shutdown'
                    });
                    await performanceInitializationService_1.performanceInitializationService.shutdown();
                    logger_1.logger.info('Performance services shutdown completed', {
                        service: 'application',
                        operation: 'shutdown'
                    });
                    logger_1.logger.info('Graceful shutdown completed', {
                        service: 'application',
                        operation: 'shutdown'
                    });
                    process.exit(0);
                }
                catch (error) {
                    logger_1.logger.error('Error during graceful shutdown', error, {
                        service: 'application',
                        operation: 'shutdown'
                    });
                    process.exit(1);
                }
            });
            setTimeout(() => {
                logger_1.logger.error('Forced shutdown after timeout', undefined, {
                    service: 'application',
                    operation: 'shutdown'
                });
                process.exit(1);
            }, 30000);
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        logger_1.logger.info('Application started successfully', {
            service: 'application',
            operation: 'startup',
            version: process.env.npm_package_version || '1.0.0',
            nodeVersion: process.version,
            platform: process.platform
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start application', error, {
            service: 'application',
            operation: 'startup'
        });
        monitoringService_1.monitoringService.createAlert('error', 'application', 'Application startup failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        });
        process.exit(1);
    }
}
startApplication();
//# sourceMappingURL=index.js.map