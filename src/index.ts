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

const app = express();

// Trust proxy if configured (for rate limiting and IP detection)
if (config.security.trustProxy) {
  app.set('trust proxy', 1);
}

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

// API health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    message: 'Job Candidate Filtering Funnel System API',
    version: '1.0.0',
    status: 'running'
  });
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

async function startApplication() {
  try {
    console.log('Job Candidate Filtering Funnel System starting...');
    
    // Connect to database
    await database.connect();
    
    // Create indexes for better performance
    await database.createIndexes();
    
    // Perform health check
    const healthCheck = await database.healthCheck();
    console.log('Database health check:', healthCheck);
    
    // Connect to Redis
    await redisClient.connect();
    console.log('Redis connected successfully');
    
    // Initialize queue system
    await queueManager.initialize();
    console.log('Queue system initialized successfully');
    
    // Start queue monitoring
    queueMonitor.startMonitoring();
    console.log('Queue monitoring started');
    
    // Test models (only in development)
    if (process.env.NODE_ENV !== 'production') {
      await testModels();
    }
    
    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      console.log(`Server running on port ${config.server.port}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
      console.log(`API available at: http://localhost:${config.server.port}/api`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        queueMonitor.stopMonitoring();
        await queueManager.shutdown();
        await redisClient.disconnect();
        await database.disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(async () => {
        queueMonitor.stopMonitoring();
        await queueManager.shutdown();
        await redisClient.disconnect();
        await database.disconnect();
        process.exit(0);
      });
    });
    
    console.log('Application started successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

startApplication();