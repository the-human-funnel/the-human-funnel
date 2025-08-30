// Database connection utilities and error handling
import mongoose from 'mongoose';
import { config } from './config';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Connect to MongoDB with retry logic and proper error handling
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('Database already connected');
      return;
    }

    const maxRetries = 5;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        await mongoose.connect(config.database.mongoUri, {
          maxPoolSize: 10, // Maintain up to 10 socket connections
          serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
          socketTimeoutMS: 45000, // Close sockets after 45 seconds
          bufferCommands: false // Disable mongoose buffering
        });

        this.isConnected = true;
        console.log('Successfully connected to MongoDB');
        
        // Set up connection event listeners
        this.setupEventListeners();
        
        return;
      } catch (error) {
        retryCount++;
        console.error(`Database connection attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error}`);
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        console.log(`Retrying database connection in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Disconnect from MongoDB
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      console.log('Database not connected');
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('Successfully disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from database:', error);
      throw error;
    }
  }

  /**
   * Check if database is connected
   */
  public isDbConnected(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get database connection status
   */
  public getConnectionStatus(): string {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[mongoose.connection.readyState as keyof typeof states] || 'unknown';
  }

  /**
   * Setup event listeners for database connection
   */
  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to MongoDB');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      console.error('Mongoose connection error:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      try {
        await this.disconnect();
        console.log('Database connection closed due to application termination');
        process.exit(0);
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  }

  /**
   * Health check for database connection
   */
  public async healthCheck(): Promise<{ connected: boolean; status: string; details: any }> {
    try {
      if (!this.isConnected) {
        return {
          connected: false,
          status: 'unhealthy',
          details: { message: 'Database not connected' }
        };
      }

      // Perform a simple ping to verify connection
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      }
      
      return {
        connected: true,
        status: 'healthy',
        details: {
          readyState: this.getConnectionStatus(),
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      return {
        connected: false,
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Reconnect to database (for error recovery)
   */
  public async reconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.disconnect();
      }
      await this.connect();
    } catch (error) {
      console.error('Failed to reconnect to database:', error);
      throw error;
    }
  }

  /**
   * Create database indexes for better performance
   */
  public async createIndexes(): Promise<void> {
    try {
      console.log('Creating database indexes...');
      
      if (!mongoose.connection.db) {
        throw new Error('Database connection not established');
      }
      
      // The indexes are already defined in the schemas, but we can ensure they're created
      await mongoose.connection.db.collection('jobprofiles').createIndex({ title: 1 });
      await mongoose.connection.db.collection('jobprofiles').createIndex({ experienceLevel: 1 });
      await mongoose.connection.db.collection('jobprofiles').createIndex({ createdAt: -1 });
      
      await mongoose.connection.db.collection('candidates').createIndex({ processingStage: 1, createdAt: -1 });
      await mongoose.connection.db.collection('candidates').createIndex({ 'finalScore.compositeScore': -1, 'finalScore.jobProfileId': 1 });
      await mongoose.connection.db.collection('candidates').createIndex({ 'resumeData.contactInfo.email': 1 }, { sparse: true });
      
      await mongoose.connection.db.collection('processingbatches').createIndex({ jobProfileId: 1, status: 1 });
      await mongoose.connection.db.collection('processingbatches').createIndex({ startedAt: -1 });
      
      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating database indexes:', error);
      throw error;
    }
  }
}

/**
 * Database error handling utilities
 */
export class DatabaseError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string = 'DATABASE_ERROR', statusCode: number = 500) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Handle MongoDB specific errors
 */
export function handleMongoError(error: any): DatabaseError {
  if (error.code === 11000) {
    // Duplicate key error
    const field = Object.keys(error.keyPattern)[0];
    return new DatabaseError(
      `Duplicate value for field: ${field}`,
      'DUPLICATE_KEY_ERROR',
      409
    );
  }

  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return new DatabaseError(
      `Validation error: ${messages.join(', ')}`,
      'VALIDATION_ERROR',
      400
    );
  }

  if (error.name === 'CastError') {
    return new DatabaseError(
      `Invalid ${error.path}: ${error.value}`,
      'CAST_ERROR',
      400
    );
  }

  if (error.name === 'MongoNetworkError') {
    return new DatabaseError(
      'Database connection error',
      'NETWORK_ERROR',
      503
    );
  }

  // Generic database error
  return new DatabaseError(
    error.message || 'Database operation failed',
    'DATABASE_ERROR',
    500
  );
}

/**
 * Transaction wrapper for atomic operations
 */
export async function withTransaction<T>(
  operation: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw handleMongoError(error);
  } finally {
    await session.endSession();
  }
}

// Export singleton instance
export const database = DatabaseConnection.getInstance();