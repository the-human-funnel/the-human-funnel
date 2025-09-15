"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = exports.DatabaseError = exports.DatabaseConnection = void 0;
exports.handleMongoError = handleMongoError;
exports.withTransaction = withTransaction;
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
                    maxPoolSize: 10,
                    serverSelectionTimeoutMS: 5000,
                    socketTimeoutMS: 45000,
                    bufferCommands: false,
                    readPreference: 'secondaryPreferred'
                });
                this.isConnected = true;
                console.log('Successfully connected to MongoDB');
                this.setupEventListeners();
                return;
            }
            catch (error) {
                retryCount++;
                console.error(`Database connection attempt ${retryCount} failed:`, error);
                if (retryCount >= maxRetries) {
                    throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error}`);
                }
                const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                console.log(`Retrying database connection in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
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
    isDbConnected() {
        return this.isConnected && mongoose_1.default.connection.readyState === 1;
    }
    isDatabaseConnected() {
        return mongoose_1.default.connection.db !== null && mongoose_1.default.connection.readyState === 1;
    }
    ensureDatabaseConnection() {
        if (!this.isDatabaseConnected()) {
            throw new DatabaseError('Database connection not established', 'CONNECTION_ERROR', 503);
        }
    }
    getConnectionStatus() {
        const states = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting'
        };
        return states[mongoose_1.default.connection.readyState] || 'unknown';
    }
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
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return {
                    connected: false,
                    status: 'unhealthy',
                    details: { message: 'Database not connected' }
                };
            }
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
    async createIndexes() {
        try {
            console.log('Creating database indexes...');
            this.ensureDatabaseConnection();
            const jobProfileIndexes = [
                { field: { title: 1 }, name: 'title_1' },
                { field: { experienceLevel: 1 }, name: 'experienceLevel_1' },
                { field: { createdAt: -1 }, name: 'createdAt_-1' },
                { field: { title: 'text', description: 'text' }, name: 'title_text_description_text' }
            ];
            for (const indexConfig of jobProfileIndexes) {
                try {
                    if (indexConfig.options) {
                        await mongoose_1.default.connection.db.collection('jobprofiles').createIndex(indexConfig.field, indexConfig.options);
                    }
                    else {
                        await mongoose_1.default.connection.db.collection('jobprofiles').createIndex(indexConfig.field);
                    }
                    console.log(`Created job profile index: ${indexConfig.name}`);
                }
                catch (error) {
                    const mongoError = error;
                    if (mongoError.code !== 86) {
                        console.log(`Error creating job profile index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
                    }
                }
            }
            const candidateIndexes = [
                { field: { processingStage: 1, createdAt: -1 }, name: 'processingStage_1_createdAt_-1' },
                { field: { 'finalScore.compositeScore': -1, 'finalScore.jobProfileId': 1 }, name: 'finalScore.compositeScore_-1_finalScore.jobProfileId_1' }
            ];
            for (const indexConfig of candidateIndexes) {
                try {
                    if (indexConfig.options) {
                        await mongoose_1.default.connection.db.collection('candidates').createIndex(indexConfig.field, indexConfig.options);
                    }
                    else {
                        await mongoose_1.default.connection.db.collection('candidates').createIndex(indexConfig.field);
                    }
                    console.log(`Created candidate index: ${indexConfig.name}`);
                }
                catch (error) {
                    const mongoError = error;
                    if (mongoError.code !== 86) {
                        console.log(`Error creating candidate index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
                    }
                }
            }
            try {
                const existingIndexes = await mongoose_1.default.connection.db.collection('candidates').listIndexes().toArray();
                const emailIndex = existingIndexes.find((idx) => idx.name === 'resumeData.contactInfo.email_1');
                if (emailIndex) {
                    if (!emailIndex.sparse || emailIndex.background) {
                        console.log('Dropping existing email index with incompatible options...');
                        await mongoose_1.default.connection.db.collection('candidates').dropIndex('resumeData.contactInfo.email_1');
                    }
                    else {
                        console.log('Email index already exists with correct options, skipping creation...');
                    }
                }
                const currentIndexes = await mongoose_1.default.connection.db.collection('candidates').listIndexes().toArray();
                const hasEmailIndex = currentIndexes.some((idx) => idx.name === 'resumeData.contactInfo.email_1');
                if (!hasEmailIndex) {
                    await mongoose_1.default.connection.db.collection('candidates').createIndex({ 'resumeData.contactInfo.email': 1 }, { sparse: true, name: 'resumeData.contactInfo.email_1' });
                    console.log('Created email index successfully');
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log('Error handling email index:', errorMessage);
            }
            const contactIndexes = [
                { field: { 'resumeData.contactInfo.phone': 1 }, options: { sparse: true }, name: 'resumeData.contactInfo.phone_1' },
                { field: { 'resumeData.contactInfo.linkedInUrl': 1 }, options: { sparse: true }, name: 'resumeData.contactInfo.linkedInUrl_1' },
                { field: { 'resumeData.contactInfo.githubUrl': 1 }, options: { sparse: true }, name: 'resumeData.contactInfo.githubUrl_1' }
            ];
            for (const indexConfig of contactIndexes) {
                try {
                    const existingIndexes = await mongoose_1.default.connection.db.collection('candidates').listIndexes().toArray();
                    const existingIndex = existingIndexes.find((idx) => idx.name === indexConfig.name);
                    if (existingIndex && (!existingIndex.sparse || existingIndex.background)) {
                        console.log(`Dropping existing ${indexConfig.name} index with incompatible options...`);
                        await mongoose_1.default.connection.db.collection('candidates').dropIndex(indexConfig.name);
                    }
                    const currentIndexes = await mongoose_1.default.connection.db.collection('candidates').listIndexes().toArray();
                    const hasIndex = currentIndexes.some((idx) => idx.name === indexConfig.name);
                    if (!hasIndex) {
                        await mongoose_1.default.connection.db.collection('candidates').createIndex(indexConfig.field, indexConfig.options);
                        console.log(`Created ${indexConfig.name} index successfully`);
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    console.log(`Error handling ${indexConfig.name} index:`, errorMessage);
                }
            }
            const compoundIndexes = [
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
                        await mongoose_1.default.connection.db.collection(indexConfig.collection).createIndex(indexConfig.field, indexConfig.options);
                    }
                    else {
                        await mongoose_1.default.connection.db.collection(indexConfig.collection).createIndex(indexConfig.field);
                    }
                    console.log(`Created compound index: ${indexConfig.name}`);
                }
                catch (error) {
                    const mongoError = error;
                    if (mongoError.code !== 86) {
                        console.log(`Error creating compound index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
                    }
                }
            }
            const analysisIndexes = [
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
                        await mongoose_1.default.connection.db.collection(indexConfig.collection).createIndex(indexConfig.field, indexConfig.options);
                    }
                    else {
                        await mongoose_1.default.connection.db.collection(indexConfig.collection).createIndex(indexConfig.field);
                    }
                    console.log(`Created analysis index: ${indexConfig.name}`);
                }
                catch (error) {
                    const mongoError = error;
                    if (mongoError.code !== 86) {
                        console.log(`Error creating analysis index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
                    }
                }
            }
            const batchIndexes = [
                { field: { jobProfileId: 1, status: 1 }, name: 'jobProfileId_1_status_1' },
                { field: { startedAt: -1 }, name: 'startedAt_-1' },
                { field: { status: 1, startedAt: -1 }, name: 'status_1_startedAt_-1' },
                { field: { jobProfileId: 1, status: 1, startedAt: -1 }, name: 'jobProfileId_status_startedAt_compound' }
            ];
            for (const indexConfig of batchIndexes) {
                try {
                    if (indexConfig.options) {
                        await mongoose_1.default.connection.db.collection('processingbatches').createIndex(indexConfig.field, indexConfig.options);
                    }
                    else {
                        await mongoose_1.default.connection.db.collection('processingbatches').createIndex(indexConfig.field);
                    }
                    console.log(`Created batch index: ${indexConfig.name}`);
                }
                catch (error) {
                    const mongoError = error;
                    if (mongoError.code !== 86) {
                        console.log(`Error creating batch index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
                    }
                }
            }
            const miscIndexes = [
                {
                    collection: 'candidates',
                    field: { 'resumeData.extractedText': 'text', 'resumeData.fileName': 'text' },
                    name: 'resume_text_search'
                },
                { collection: 'candidates', field: { updatedAt: -1 }, name: 'updatedAt_-1' },
                { collection: 'candidates', field: { createdAt: -1, processingStage: 1 }, name: 'createdAt_processingStage_compound' }
            ];
            for (const indexConfig of miscIndexes) {
                try {
                    if (indexConfig.options) {
                        await mongoose_1.default.connection.db.collection(indexConfig.collection).createIndex(indexConfig.field, indexConfig.options);
                    }
                    else {
                        await mongoose_1.default.connection.db.collection(indexConfig.collection).createIndex(indexConfig.field);
                    }
                    console.log(`Created misc index: ${indexConfig.name}`);
                }
                catch (error) {
                    const mongoError = error;
                    if (mongoError.code !== 86) {
                        console.log(`Error creating misc index ${indexConfig.name}:`, mongoError.message || 'Unknown error');
                    }
                }
            }
            console.log('Database indexes created successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error creating database indexes:', errorMessage);
            throw handleMongoError(error);
        }
    }
    async optimizeConnection() {
        try {
            this.ensureDatabaseConnection();
            console.log('Using read preference configured in connection options');
            if (process.env.NODE_ENV === 'development') {
                try {
                    await mongoose_1.default.connection.db.admin().command({
                        profile: 2,
                        slowms: 100
                    });
                    console.log('Query profiling enabled for development');
                }
                catch (profileError) {
                    const profileErrorMessage = profileError instanceof Error ? profileError.message : 'Unknown error';
                    console.warn('Could not enable query profiling (insufficient permissions):', profileErrorMessage);
                    console.warn('This is not critical - the application will continue without profiling');
                }
            }
            console.log('Database connection optimized');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error optimizing database connection:', errorMessage);
            throw handleMongoError(error);
        }
    }
    async getPerformanceStats() {
        try {
            this.ensureDatabaseConnection();
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
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error getting performance stats:', errorMessage);
            return null;
        }
    }
    async analyzeSlowQueries() {
        try {
            this.ensureDatabaseConnection();
            const profilingData = await mongoose_1.default.connection.db
                .collection('system.profile')
                .find({ ts: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
                .sort({ ts: -1 })
                .limit(100)
                .toArray();
            return profilingData.map((query) => ({
                timestamp: query.ts,
                duration: query.millis,
                command: query.command,
                collection: query.ns,
                planSummary: query.planSummary
            }));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error analyzing slow queries:', errorMessage);
            return [];
        }
    }
}
exports.DatabaseConnection = DatabaseConnection;
class DatabaseError extends Error {
    constructor(message, code = 'DATABASE_ERROR', statusCode = 500) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.statusCode = statusCode;
    }
}
exports.DatabaseError = DatabaseError;
function handleMongoError(error) {
    if (isMongoError(error)) {
        if (error.code === 11000) {
            const field = error.keyPattern ? Object.keys(error.keyPattern)[0] : 'unknown';
            return new DatabaseError(`Duplicate value for field: ${field}`, 'DUPLICATE_KEY_ERROR', 409);
        }
    }
    if (isValidationError(error)) {
        const messages = Object.values(error.errors).map((err) => err.message);
        return new DatabaseError(`Validation error: ${messages.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    if (isCastError(error)) {
        return new DatabaseError(`Invalid ${error.path}: ${error.value}`, 'CAST_ERROR', 400);
    }
    if (isNetworkError(error)) {
        return new DatabaseError('Database connection error', 'NETWORK_ERROR', 503);
    }
    const message = error instanceof Error ? error.message : 'Database operation failed';
    return new DatabaseError(message, 'DATABASE_ERROR', 500);
}
function isMongoError(error) {
    return typeof error === 'object' && error !== null && 'code' in error;
}
function isValidationError(error) {
    return typeof error === 'object' && error !== null &&
        'name' in error && error.name === 'ValidationError' && 'errors' in error;
}
function isCastError(error) {
    return typeof error === 'object' && error !== null &&
        'name' in error && error.name === 'CastError' && 'path' in error && 'value' in error;
}
function isNetworkError(error) {
    return typeof error === 'object' && error !== null &&
        'name' in error && error.name === 'MongoNetworkError';
}
async function withTransaction(operation) {
    const dbInstance = DatabaseConnection.getInstance();
    if (!dbInstance.isDbConnected()) {
        throw new DatabaseError('Database connection not established', 'CONNECTION_ERROR', 503);
    }
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
exports.database = DatabaseConnection.getInstance();
//# sourceMappingURL=database.js.map