// Main application entry point
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import { database } from './utils/database';
import { config } from './utils/config';
import apiRoutes from './routes';
import testModels from './models/test-models';
import { queueManager } from './queues';
import { queueMonitor } from './utils/queueMonitor';
import { redisClient } from './utils/redis';
import { generalRateLimit } from './middleware/rateLimiting';
import { auditLog } from './middleware/auditLog';
import { sanitizeInput } from './middleware/validation';
import { logger } from './utils/logger';
import { 
  globalErrorHandler, 
  requestId, 
  performanceMonitoring, 
  requestTimeout, 
  notFoundHandler,
  setupUnhandledRejectionHandler
} from './middleware/errorHandling';
import { healthCheckService } from './services/healthCheckService';
import { monitoringService } from './services/monitoringService';
import { alertingService } from './services/alertingService';
import { performanceInitializationService } from './services/performanceInitializationService';

const app = express();

// Setup unhandled rejection handlers
setupUnhandledRejectionHandler();

// Trust proxy if configured (for rate limiting and IP detection)
if (config.security.trustProxy) {
  app.set('trust proxy', 1);
}

// Request tracking and monitoring middleware (early in the chain)
app.use(requestId);
app.use(performanceMonitoring);
app.use(requestTimeout(30000)); // 30 second timeout

// Security middleware
app.use(helmet({
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

// CORS configuration
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
app.use(generalRateLimit);

// Audit logging (before other middleware to capture all requests)
app.use(auditLog);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Log large payloads for security monitoring
    if (buf.length > 1024 * 1024) { // 1MB
      logger.warn('Large payload received', {
        size: buf.length,
        ip: (req as any).ip,
        path: (req as any).path,
        method: req.method
      });
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// API routes
app.use('/api', apiRoutes);

// Serve static files from the React app build directory
const frontendBuildPath = path.join(__dirname, '../frontend/build');
app.use(express.static(frontendBuildPath));

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(globalErrorHandler);

async function startApplication() {
  try {
    logger.info('Job Candidate Filtering Funnel System starting...', {
      service: 'application',
      operation: 'startup'
    });
    
    // Initialize performance optimizations (includes database and Redis setup)
    await performanceInitializationService.initialize();
    logger.info('Performance optimizations initialized successfully', {
      service: 'application',
      operation: 'startup'
    });
    
    // Perform comprehensive health check
    const performanceHealth = await performanceInitializationService.getHealthStatus();
    logger.info('Performance health check completed', {
      service: 'application',
      operation: 'startup',
      performanceHealth
    });
    
    // Initialize queue system
    await queueManager.initialize();
    logger.info('Queue system initialized successfully', {
      service: 'application',
      operation: 'startup'
    });
    
    // Start queue monitoring
    queueMonitor.startMonitoring();
    logger.info('Queue monitoring started', {
      service: 'application',
      operation: 'startup'
    });
    
    // Test models (only in development)
    if (process.env.NODE_ENV !== 'production') {
      await testModels();
      logger.info('Test models executed', {
        service: 'application',
        operation: 'startup'
      });
    }
    
    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      logger.info('HTTP server started', {
        service: 'application',
        operation: 'startup',
        port: config.server.port,
        environment: config.server.nodeEnv,
        apiUrl: `http://localhost:${config.server.port}/api`
      });
    });

    // Track server connections for health monitoring
    server.on('connection', () => {
      healthCheckService.incrementConnections();
    });
    
    server.on('close', () => {
      healthCheckService.decrementConnections();
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`, {
        service: 'application',
        operation: 'shutdown'
      });
      
      server.close(async () => {
        try {
          // Stop monitoring and alerting services
          alertingService.shutdown();
          queueMonitor.stopMonitoring();
          
          // Shutdown queue system
          await queueManager.shutdown();
          logger.info('Queue system shutdown completed', {
            service: 'application',
            operation: 'shutdown'
          });
          
          // Shutdown performance services (includes Redis and database)
          await performanceInitializationService.shutdown();
          logger.info('Performance services shutdown completed', {
            service: 'application',
            operation: 'shutdown'
          });
          
          logger.info('Graceful shutdown completed', {
            service: 'application',
            operation: 'shutdown'
          });
          
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown', error, {
            service: 'application',
            operation: 'shutdown'
          });
          process.exit(1);
        }
      });
      
      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout', undefined, {
          service: 'application',
          operation: 'shutdown'
        });
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    logger.info('Application started successfully', {
      service: 'application',
      operation: 'startup',
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform
    });
    
  } catch (error) {
    logger.error('Failed to start application', error, {
      service: 'application',
      operation: 'startup'
    });
    
    // Create critical alert for startup failure
    monitoringService.createAlert(
      'error',
      'application',
      'Application startup failed',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    );
    
    process.exit(1);
  }
}

startApplication();