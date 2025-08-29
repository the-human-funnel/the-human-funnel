// Main application entry point
import express from 'express';
import { database } from './utils/database';
import { config } from './utils/config';
import apiRoutes from './routes';
import testModels from './models/test-models';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Job Candidate Filtering Funnel System API',
    version: '1.0.0',
    status: 'running'
  });
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