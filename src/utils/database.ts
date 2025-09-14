// Database connection utilities and error handling
import mongoose from 'mongoose';
import { config } from './config';

// Type definitions for improved type safety using mongoose types
interface IndexConfig {
  field: Record<string, 1 | -1 | 'text'>;
  name: string;
  options?: Record<string, any>;
}

interface CompoundIndexConfig {
  collection: string;
  field: Record<string, 1 | -1 | 'text'>;
  name: string;
  options?: Record<string, any>;
}

interface DatabaseHealthCheck {
  connected: boolean;
  status: 'healthy' | 'unhealthy';
  details: {
    message?: string;
    error?: string;
    readyState?: string;
    host?: string;
    port?: number;
    name?: string;
  };
}

interface PerformanceStats {
  collections: number;
  dataSize: number;
  indexSize: number;
  storageSize: number;
  connections: any;
  opcounters: any;
  mem: any;
}

interface SlowQueryAnalysis {
  timestamp: Date;
  duration: number;
  command: any;
  collection: string;
  planSummary?: string;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private isConnected: boolean = false;

  private constructor() { }

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
          bufferCommands: false, // Disable mongoose buffering
          readPreference: 'secondaryPreferred' // Set read preference in connection options
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
   * Type guard to check if database connection is established
   */
  private isDatabaseConnected(): boolean {
    return mongoose.connection.db !== null && mongoose.connection.readyState === 1;
  }

  /**
   * Type guard to ensure database connection exists before operations
   */
  private ensureDatabaseConnection(): asserts this is { isConnected: true } {
    if (!this.isDatabaseConnected()) {
      throw new DatabaseError('Database connection not established', 'CONNECTION_ERROR', 503);
    }
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
  public async healthCheck(): Promise<DatabaseHealthCheck> {
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
   * Create comprehensive database indexes for better performance
   */
  public async createIndexes(): Promise<void> {
    try {
      console.log('Creating database indexes...');

      this.ensureDatabaseConnection();

      // Job Profiles indexes
      const jobProfileIndexes: IndexConfig[] = [
        { field: { title: 1 as const }, name: 'title_1' },
        { field: { experienceLevel: 1 as const }, name: 'experienceLevel_1' },
        { field: { createdAt: -1 as const }, name: 'createdAt_-1' },
        { field: { title: 'text' as const, description: 'text' as const }, name: 'title_text_description_text' }
      ];

      for (const indexConfig of jobProfileIndexes) {
        try {
          if (indexConfig.options) {
            await mongoose.connection.db!.collection('jobprofiles').createIndex(
              indexConfig.field,
              indexConfig.options
            );
          } else {
            await mongoose.connection.db!.collection('jobprofiles').createIndex(indexConfig.field);
          }
          console.log(`Created job profile index: ${indexConfig.name}`);
        } catch (error: unknown) {
          const mongoError = error as { code?: number; message?: string };
          if (mongoError.code !== 86) { // Ignore "index already exists" errors
            console.log(`Error creating job profile index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
          }
        }
      }

      // Candidates indexes - optimized for frequent queries
      const candidateIndexes: IndexConfig[] = [
        { field: { processingStage: 1, createdAt: -1 }, name: 'processingStage_1_createdAt_-1' },
        { field: { 'finalScore.compositeScore': -1, 'finalScore.jobProfileId': 1 }, name: 'finalScore.compositeScore_-1_finalScore.jobProfileId_1' }
      ];

      for (const indexConfig of candidateIndexes) {
        try {
          if (indexConfig.options) {
            await mongoose.connection.db!.collection('candidates').createIndex(
              indexConfig.field,
              indexConfig.options
            );
          } else {
            await mongoose.connection.db!.collection('candidates').createIndex(indexConfig.field);
          }
          console.log(`Created candidate index: ${indexConfig.name}`);
        } catch (error: unknown) {
          const mongoError = error as { code?: number; message?: string };
          if (mongoError.code !== 86) { // Ignore "index already exists" errors
            console.log(`Error creating candidate index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
          }
        }
      }

      // Handle email index creation with proper conflict resolution
      try {
        // Check if index exists and drop it if it has different options
        const existingIndexes = await mongoose.connection.db!.collection('candidates').listIndexes().toArray();
        const emailIndex = existingIndexes.find((idx: any) => idx.name === 'resumeData.contactInfo.email_1');

        if (emailIndex) {
          // Check if the existing index has different options than what we want
          if (!(emailIndex as any).sparse || (emailIndex as any).background) {
            console.log('Dropping existing email index with incompatible options...');
            await mongoose.connection.db!.collection('candidates').dropIndex('resumeData.contactInfo.email_1');
          } else {
            console.log('Email index already exists with correct options, skipping creation...');
          }
        }

        // Only create the index if it doesn't exist or was dropped
        const currentIndexes = await mongoose.connection.db!.collection('candidates').listIndexes().toArray();
        const hasEmailIndex = currentIndexes.some((idx: any) => idx.name === 'resumeData.contactInfo.email_1');

        if (!hasEmailIndex) {
          await mongoose.connection.db!.collection('candidates').createIndex(
            { 'resumeData.contactInfo.email': 1 },
            { sparse: true, name: 'resumeData.contactInfo.email_1' }
          );
          console.log('Created email index successfully');
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log('Error handling email index:', errorMessage);
        // Continue with other indexes
      }
      // Handle other contact info indexes with conflict resolution
      const contactIndexes: IndexConfig[] = [
        { field: { 'resumeData.contactInfo.phone': 1 }, options: { sparse: true }, name: 'resumeData.contactInfo.phone_1' },
        { field: { 'resumeData.contactInfo.linkedInUrl': 1 }, options: { sparse: true }, name: 'resumeData.contactInfo.linkedInUrl_1' },
        { field: { 'resumeData.contactInfo.githubUrl': 1 }, options: { sparse: true }, name: 'resumeData.contactInfo.githubUrl_1' }
      ];

      for (const indexConfig of contactIndexes) {
        try {
          const existingIndexes = await mongoose.connection.db!.collection('candidates').listIndexes().toArray();
          const existingIndex = existingIndexes.find((idx: any) => idx.name === indexConfig.name);

          if (existingIndex && (!(existingIndex as any).sparse || (existingIndex as any).background)) {
            console.log(`Dropping existing ${indexConfig.name} index with incompatible options...`);
            await mongoose.connection.db!.collection('candidates').dropIndex(indexConfig.name);
          }

          const currentIndexes = await mongoose.connection.db!.collection('candidates').listIndexes().toArray();
          const hasIndex = currentIndexes.some((idx: any) => idx.name === indexConfig.name);

          if (!hasIndex) {
            await mongoose.connection.db!.collection('candidates').createIndex(indexConfig.field, indexConfig.options);
            console.log(`Created ${indexConfig.name} index successfully`);
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.log(`Error handling ${indexConfig.name} index:`, errorMessage);
        }
      }

      // Compound indexes for common query patterns
      const compoundIndexes: CompoundIndexConfig[] = [
        {
          collection: 'candidates',
          field: { 'finalScore.jobProfileId': 1, 'finalScore.compositeScore': -1, processingStage: 1 },
          name: 'finalScore_compound_1'
        },
        {
          collection: 'candidates',
          field: { processingStage: 1, 'finalScore.jobProfileId': 1, createdAt: -1 },
          name: 'processingStage_compound_1'
        }
      ];

      for (const indexConfig of compoundIndexes) {
        try {
          if (indexConfig.options) {
            await mongoose.connection.db!.collection(indexConfig.collection).createIndex(
              indexConfig.field,
              indexConfig.options
            );
          } else {
            await mongoose.connection.db!.collection(indexConfig.collection).createIndex(indexConfig.field);
          }
          console.log(`Created compound index: ${indexConfig.name}`);
        } catch (error: unknown) {
          const mongoError = error as { code?: number; message?: string };
          if (mongoError.code !== 86) {
            console.log(`Error creating compound index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
          }
        }
      }

      // Analysis indexes
      const analysisIndexes: CompoundIndexConfig[] = [
        { collection: 'candidates', field: { 'aiAnalysis.provider': 1 }, name: 'aiAnalysis.provider_1' },
        { collection: 'candidates', field: { 'aiAnalysis.relevanceScore': -1 }, name: 'aiAnalysis.relevanceScore_-1' },
        { collection: 'candidates', field: { 'aiAnalysis.confidence': -1 }, name: 'aiAnalysis.confidence_-1' },
        { collection: 'candidates', field: { 'linkedInAnalysis.professionalScore': -1 }, name: 'linkedInAnalysis.professionalScore_-1' },
        { collection: 'candidates', field: { 'linkedInAnalysis.profileAccessible': 1 }, name: 'linkedInAnalysis.profileAccessible_1' },
        { collection: 'candidates', field: { 'githubAnalysis.technicalScore': -1 }, name: 'githubAnalysis.technicalScore_-1' },
        { collection: 'candidates', field: { 'githubAnalysis.profileStats.publicRepos': -1 }, name: 'githubAnalysis.publicRepos_-1' },
        { collection: 'candidates', field: { 'interviewSession.status': 1 }, name: 'interviewSession.status_1' },
        { collection: 'candidates', field: { 'interviewSession.scheduledAt': -1 }, name: 'interviewSession.scheduledAt_-1' }
      ];

      for (const indexConfig of analysisIndexes) {
        try {
          if (indexConfig.options) {
            await mongoose.connection.db!.collection(indexConfig.collection).createIndex(
              indexConfig.field,
              indexConfig.options
            );
          } else {
            await mongoose.connection.db!.collection(indexConfig.collection).createIndex(indexConfig.field);
          }
          console.log(`Created analysis index: ${indexConfig.name}`);
        } catch (error: unknown) {
          const mongoError = error as { code?: number; message?: string };
          if (mongoError.code !== 86) {
            console.log(`Error creating analysis index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
          }
        }
      }

      // Processing Batches indexes
      const batchIndexes: IndexConfig[] = [
        { field: { jobProfileId: 1, status: 1 }, name: 'jobProfileId_1_status_1' },
        { field: { startedAt: -1 }, name: 'startedAt_-1' },
        { field: { status: 1, startedAt: -1 }, name: 'status_1_startedAt_-1' },
        { field: { jobProfileId: 1, status: 1, startedAt: -1 }, name: 'jobProfileId_status_startedAt_compound' }
      ];

      for (const indexConfig of batchIndexes) {
        try {
          if (indexConfig.options) {
            await mongoose.connection.db!.collection('processingbatches').createIndex(
              indexConfig.field,
              indexConfig.options
            );
          } else {
            await mongoose.connection.db!.collection('processingbatches').createIndex(indexConfig.field);
          }
          console.log(`Created batch index: ${indexConfig.name}`);
        } catch (error: unknown) {
          const mongoError = error as { code?: number; message?: string };
          if (mongoError.code !== 86) {
            console.log(`Error creating batch index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
          }
        }
      }

      // Text search and performance indexes
      const miscIndexes: CompoundIndexConfig[] = [
        {
          collection: 'candidates',
          field: { 'resumeData.extractedText': 'text' as const, 'resumeData.fileName': 'text' as const },
          name: 'resume_text_search'
        },
        { collection: 'candidates', field: { updatedAt: -1 as const }, name: 'updatedAt_-1' },
        { collection: 'candidates', field: { createdAt: -1 as const, processingStage: 1 as const }, name: 'createdAt_processingStage_compound' }
      ];

      for (const indexConfig of miscIndexes) {
        try {
          if (indexConfig.options) {
            await mongoose.connection.db!.collection(indexConfig.collection).createIndex(
              indexConfig.field,
              indexConfig.options
            );
          } else {
            await mongoose.connection.db!.collection(indexConfig.collection).createIndex(indexConfig.field);
          }
          console.log(`Created misc index: ${indexConfig.name}`);
        } catch (error: unknown) {
          const mongoError = error as { code?: number; message?: string };
          if (mongoError.code !== 86) {
            console.log(`Error creating misc index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
          }
        }
      }

      console.log('Database indexes created successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error creating database indexes:', errorMessage);
      throw handleMongoError(error);
    }
  }

  /**
   * Optimize database queries with connection pooling
   */
  public async optimizeConnection(): Promise<void> {
    try {
      this.ensureDatabaseConnection();

      // Read preference is already set in connection options during connect()
      // No need to modify it after connection is established
      console.log('Using read preference configured in connection options');

      // Enable query profiling for slow queries (development only)
      if (process.env.NODE_ENV === 'development') {
        await mongoose.connection.db!.admin().command({
          profile: 2,
          slowms: 100 // Log queries slower than 100ms
        });
      }

      console.log('Database connection optimized');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error optimizing database connection:', errorMessage);
      throw handleMongoError(error);
    }
  }

  /**
   * Get database performance statistics
   */
  public async getPerformanceStats(): Promise<PerformanceStats | null> {
    try {
      this.ensureDatabaseConnection();

      const stats = await mongoose.connection.db!.stats();
      const serverStatus = await mongoose.connection.db!.admin().serverStatus();

      return {
        collections: stats.collections,
        dataSize: stats.dataSize,
        indexSize: stats.indexSize,
        storageSize: stats.storageSize,
        connections: serverStatus.connections,
        opcounters: serverStatus.opcounters,
        mem: serverStatus.mem
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error getting performance stats:', errorMessage);
      return null;
    }
  }

  /**
   * Analyze slow queries and suggest optimizations
   */
  public async analyzeSlowQueries(): Promise<SlowQueryAnalysis[]> {
    try {
      this.ensureDatabaseConnection();

      // Get profiling data (if enabled)
      const profilingData = await mongoose.connection.db!
        .collection('system.profile')
        .find({ ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }) // Last 24 hours
        .sort({ ts: -1 })
        .limit(100)
        .toArray();

      return profilingData.map((query: any): SlowQueryAnalysis => ({
        timestamp: query.ts,
        duration: query.millis,
        command: query.command,
        collection: query.ns,
        planSummary: query.planSummary
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error analyzing slow queries:', errorMessage);
      return [];
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
 * Handle MongoDB specific errors with proper type safety
 */
export function handleMongoError(error: unknown): DatabaseError {
  // Type guard for MongoDB errors
  if (isMongoError(error)) {
    if (error.code === 11000) {
      // Duplicate key error
      const field = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'unknown';
      return new DatabaseError(
        `Duplicate value for field: ${field}`,
        'DUPLICATE_KEY_ERROR',
        409
      );
    }
  }

  // Type guard for Mongoose validation errors
  if (isValidationError(error)) {
    const messages = Object.values(error.errors).map((err: any) => err.message);
    return new DatabaseError(
      `Validation error: ${messages.join(', ')}`,
      'VALIDATION_ERROR',
      400
    );
  }

  // Type guard for Mongoose cast errors
  if (isCastError(error)) {
    return new DatabaseError(
      `Invalid ${error.path}: ${error.value}`,
      'CAST_ERROR',
      400
    );
  }

  // Type guard for network errors
  if (isNetworkError(error)) {
    return new DatabaseError(
      'Database connection error',
      'NETWORK_ERROR',
      503
    );
  }

  // Generic database error
  const message = error instanceof Error ? error.message : 'Database operation failed';
  return new DatabaseError(message, 'DATABASE_ERROR', 500);
}

/**
 * Type guards for different error types
 */
function isMongoError(error: unknown): error is { code: number; keyPattern?: Record<string, any> } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function isValidationError(error: unknown): error is { name: string; errors: Record<string, any> } {
  return typeof error === 'object' && error !== null &&
    'name' in error && (error as any).name === 'ValidationError' && 'errors' in error;
}

function isCastError(error: unknown): error is { name: string; path: string; value: any } {
  return typeof error === 'object' && error !== null &&
    'name' in error && (error as any).name === 'CastError' && 'path' in error && 'value' in error;
}

function isNetworkError(error: unknown): error is { name: string } {
  return typeof error === 'object' && error !== null &&
    'name' in error && (error as any).name === 'MongoNetworkError';
}

/**
 * Transaction wrapper for atomic operations with proper error handling
 */
export async function withTransaction<T>(
  operation: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  // Ensure database connection before starting transaction
  const dbInstance = DatabaseConnection.getInstance();
  if (!dbInstance.isDbConnected()) {
    throw new DatabaseError('Database connection not established', 'CONNECTION_ERROR', 503);
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const result = await operation(session);
    await session.commitTransaction();
    return result;
  } catch (error: unknown) {
    await session.abortTransaction();
    throw handleMongoError(error);
  } finally {
    await session.endSession();
  }
}

// Export singleton instance
export const database = DatabaseConnection.getInstance();