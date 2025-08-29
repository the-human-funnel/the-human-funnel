// Main application entry point
import { database } from './models';
import testModels from './models/test-models';

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
    
    console.log('Application started successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

startApplication();