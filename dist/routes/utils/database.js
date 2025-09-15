"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = exports.DatabaseError = exports.DatabaseConnection = void 0;
exports.handleMongoError = handleMongoError;
exports.withTransaction = withTransaction;
// Database connection utilities and error handling
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
class DatabaseConnection {
    constructor() {
        this.isConnected = false;
    }
    static getInstance() {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }
    /**
     * Connect to MongoDB with retry logic and proper error handling
     */
    async connect() {
        if (this.isConnected) {
            console.log('Database already connected');
            return;
        }
        const maxRetries = 5;
        let retryCount = 0;
        while (retryCount < maxRetries) {
            try {
                await mongoose_1.default.connect(config_1.config.database.mongoUri, {
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
            }
            catch (error) {
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
    async disconnect() {
        if (!this.isConnected) {
            console.log('Database not connected');
            return;
        }
        try {
            await mongoose_1.default.disconnect();
            this.isConnected = false;
            console.log('Successfully disconnected from MongoDB');
        }
        catch (error) {
            console.error('Error disconnecting from database:', error);
            throw error;
        }
    }
    /**
     * Check if database is connected
     */
    isDbConnected() {
        return this.isConnected && mongoose_1.default.connection.readyState === 1;
    }
    /**
     * Get database connection status
     */
    getConnectionStatus() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        return states[mongoose_1.default.connection.readyState] || 'unknown';
    }
    /**
     * Setup event listeners for database connection
     */
    setupEventListeners() {
        mongoose_1.default.connection.on('connected', () => {
            console.log('Mongoose connected to MongoDB');
            this.isConnected = true;
        });
        mongoose_1.default.connection.on('error', (error) => {
            console.error('Mongoose connection error:', error);
            this.isConnected = false;
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.log('Mongoose disconnected from MongoDB');
            this.isConnected = false;
        });
        // Handle application termination
        process.on('SIGINT', async () => {
            try {
                await this.disconnect();
                console.log('Database connection closed due to application termination');
                process.exit(0);
            }
            catch (error) {
                console.error('Error during graceful shutdown:', error);
                process.exit(1);
            }
        });
    }
    /**
     * Health check for database connection
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return {
                    connected: false,
                    status: 'unhealthy',
                    details: { message: 'Database not connected' }
                };
            }
            // Perform a simple ping to verify connection
            if (mongoose_1.default.connection.db) {
                await mongoose_1.default.connection.db.admin().ping();
            }
            return {
                connected: true,
                status: 'healthy',
                details: {
                    readyState: this.getConnectionStatus(),
                    host: mongoose_1.default.connection.host,
                    port: mongoose_1.default.connection.port,
                    name: mongoose_1.default.connection.name
                }
            };
        }
        catch (error) {
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
    async reconnect() {
        try {
            if (this.isConnected) {
                await this.disconnect();
            }
            await this.connect();
        }
        catch (error) {
            console.error('Failed to reconnect to database:', error);
            throw error;
        }
    }
    /**
     * Create comprehensive database indexes for better performance
     */
    async createIndexes() {
        try {
            console.log('Creating database indexes...');
            if (!mongoose_1.default.connection.db) {
                throw new Error('Database connection not established');
            }
            // Job Profiles indexes
            await mongoose_1.default.connection.db.collection('jobprofiles').createIndex({ title: 1 });
            await mongoose_1.default.connection.db.collection('jobprofiles').createIndex({ experienceLevel: 1 });
            await mongoose_1.default.connection.db.collection('jobprofiles').createIndex({ createdAt: -1 });
            await mongoose_1.default.connection.db.collection('jobprofiles').createIndex({ title: 'text', description: 'text' });
            // Candidates indexes - optimized for frequent queries
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ processingStage: 1, createdAt: -1 });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'finalScore.compositeScore': -1, 'finalScore.jobProfileId': 1 });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'resumeData.contactInfo.email': 1 }, { sparse: true });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'resumeData.contactInfo.phone': 1 }, { sparse: true });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'resumeData.contactInfo.linkedInUrl': 1 }, { sparse: true });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'resumeData.contactInfo.githubUrl': 1 }, { sparse: true });
            // Compound indexes for common query patterns
            await mongoose_1.default.connection.db.collection('candidates').createIndex({
                'finalScore.jobProfileId': 1,
                'finalScore.compositeScore': -1,
                processingStage: 1
            });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({
                processingStage: 1,
                'finalScore.jobProfileId': 1,
                createdAt: -1
            });
            // AI Analysis indexes
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'aiAnalysis.provider': 1 });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'aiAnalysis.relevanceScore': -1 });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'aiAnalysis.confidence': -1 });
            // LinkedIn Analysis indexes
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'linkedInAnalysis.professionalScore': -1 });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'linkedInAnalysis.profileAccessible': 1 });
            // GitHub Analysis indexes
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'githubAnalysis.technicalScore': -1 });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'githubAnalysis.profileStats.publicRepos': -1 });
            // Interview Analysis indexes
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'interviewSession.status': 1 });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'interviewSession.scheduledAt': -1 });
            // Processing Batches indexes
            await mongoose_1.default.connection.db.collection('processingbatches').createIndex({ jobProfileId: 1, status: 1 });
            await mongoose_1.default.connection.db.collection('processingbatches').createIndex({ startedAt: -1 });
            await mongoose_1.default.connection.db.collection('processingbatches').createIndex({ status: 1, startedAt: -1 });
            await mongoose_1.default.connection.db.collection('processingbatches').createIndex({
                jobProfileId: 1,
                status: 1,
                startedAt: -1
            });
            // Text search indexes for resume content
            await mongoose_1.default.connection.db.collection('candidates').createIndex({
                'resumeData.extractedText': 'text',
                'resumeData.fileName': 'text'
            });
            // Performance monitoring indexes
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ updatedAt: -1 });
            await mongoose_1.default.connection.db.collection('candidates').createIndex({ createdAt: -1, processingStage: 1 });
            console.log('Database indexes created successfully');
        }
        catch (error) {
            console.error('Error creating database indexes:', error);
            throw error;
        }
    }
    /**
     * Optimize database queries with connection pooling
     */
    async optimizeConnection() {
        try {
            // Set read preference for better performance
            if (mongoose_1.default.connection.db) {
                mongoose_1.default.connection.db.readPreference = 'secondaryPreferred';
            }
            // Enable query profiling for slow queries (development only)
            if (process.env.NODE_ENV === 'development' && mongoose_1.default.connection.db) {
                await mongoose_1.default.connection.db.admin().command({
                    profile: 2,
                    slowms: 100 // Log queries slower than 100ms
                });
            }
            console.log('Database connection optimized');
        }
        catch (error) {
            console.error('Error optimizing database connection:', error);
        }
    }
    /**
     * Get database performance statistics
     */
    async getPerformanceStats() {
        try {
            if (!mongoose_1.default.connection.db) {
                throw new Error('Database connection not established');
            }
            const stats = await mongoose_1.default.connection.db.stats();
            const serverStatus = await mongoose_1.default.connection.db.admin().serverStatus();
            return {
                collections: stats.collections,
                dataSize: stats.dataSize,
                indexSize: stats.indexSize,
                storageSize: stats.storageSize,
                connections: serverStatus.connections,
                opcounters: serverStatus.opcounters,
                mem: serverStatus.mem
            };
        }
        catch (error) {
            console.error('Error getting performance stats:', error);
            return null;
        }
    }
    /**
     * Analyze slow queries and suggest optimizations
     */
    async analyzeSlowQueries() {
        try {
            if (!mongoose_1.default.connection.db) {
                throw new Error('Database connection not established');
            }
            // Get profiling data (if enabled)
            const profilingData = await mongoose_1.default.connection.db
                .collection('system.profile')
                .find({ ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }) // Last 24 hours
                .sort({ ts: -1 })
                .limit(100)
                .toArray();
            return profilingData.map(query => ({
                timestamp: query.ts,
                duration: query.millis,
                command: query.command,
                collection: query.ns,
                planSummary: query.planSummary
            }));
        }
        catch (error) {
            console.error('Error analyzing slow queries:', error);
            return [];
        }
    }
}
exports.DatabaseConnection = DatabaseConnection;
/**
 * Database error handling utilities
 */
class DatabaseError extends Error {
    constructor(message, code = 'DATABASE_ERROR', statusCode = 500) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.DatabaseError = DatabaseError;
/**
 * Handle MongoDB specific errors
 */
function handleMongoError(error) {
    if (error.code === 11000) {
        // Duplicate key error
        const field = Object.keys(error.keyPattern)[0];
        return new DatabaseError(`Duplicate value for field: ${field}`, 'DUPLICATE_KEY_ERROR', 409);
    }
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err) => err.message);
        return new DatabaseError(`Validation error: ${messages.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    if (error.name === 'CastError') {
        return new DatabaseError(`Invalid ${error.path}: ${error.value}`, 'CAST_ERROR', 400);
    }
    if (error.name === 'MongoNetworkError') {
        return new DatabaseError('Database connection error', 'NETWORK_ERROR', 503);
    }
    // Generic database error
    return new DatabaseError(error.message || 'Database operation failed', 'DATABASE_ERROR', 500);
}
/**
 * Transaction wrapper for atomic operations
 */
async function withTransaction(operation) {
    const session = await mongoose_1.default.startSession();
    try {
        session.startTransaction();
        const result = await operation(session);
        await session.commitTransaction();
        return result;
    }
    catch (error) {
        await session.abortTransaction();
        throw handleMongoError(error);
    }
    finally {
        await session.endSession();
    }
}
// Export singleton instance
exports.database = DatabaseConnection.getInstance();
