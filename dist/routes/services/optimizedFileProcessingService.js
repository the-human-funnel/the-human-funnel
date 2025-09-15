"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizedFileProcessingService = exports.OptimizedFileProcessingService = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const stream = __importStar(require("stream"));
const util_1 = require("util");
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const logger_1 = require("../utils/logger");
const memoryManagementService_1 = require("./memoryManagementService");
const cachingService_1 = require("./cachingService");
const pipeline = (0, util_1.promisify)(stream.pipeline);
class OptimizedFileProcessingService {
    constructor(options) {
        this.processingQueue = [];
        this.activeProcessing = 0;
        this.options = {
            maxConcurrentFiles: 5,
            chunkSize: 1024 * 1024, // 1MB chunks
            useStreaming: true,
            enableCaching: true,
            tempDirectory: path.join(process.cwd(), 'temp'),
            ...options
        };
        this.contactRegexes = new Map([
            ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
            ['phone', /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g],
            ['linkedin', /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+/gi],
            ['github', /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-]+/gi],
            ['projectUrl', /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi]
        ]);
        this.ensureTempDirectory();
    }
    /**
     * Ensure temp directory exists
     */
    async ensureTempDirectory() {
        try {
            await fs.mkdir(this.options.tempDirectory, { recursive: true });
        }
        catch (error) {
            logger_1.logger.error('Failed to create temp directory:', error);
        }
    }
    /**
     * Process a batch of files with optimized memory usage
     */
    async processBatch(files) {
        const stats = {
            totalFiles: files.length,
            processedFiles: 0,
            successfulFiles: 0,
            failedFiles: 0,
            totalSize: files.reduce((sum, file) => sum + file.buffer.length, 0),
            averageProcessingTime: 0,
            startTime: new Date()
        };
        logger_1.logger.info(`Starting batch processing of ${files.length} files`, {
            service: 'optimizedFileProcessing',
            totalFiles: files.length,
            totalSize: stats.totalSize,
            maxConcurrent: this.options.maxConcurrentFiles
        });
        // Check if batch size is within memory limits
        if (!memoryManagementService_1.memoryManagementService.isBatchSizeAllowed(files.length)) {
            throw new Error(`Batch size ${files.length} exceeds memory limits`);
        }
        const results = [];
        const processingTimes = [];
        // Process files in chunks to manage memory
        const chunkSize = Math.min(this.options.maxConcurrentFiles, files.length);
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            // Check memory before processing each chunk
            if (!memoryManagementService_1.memoryManagementService.canStartNewJob()) {
                logger_1.logger.warn('Memory constraints detected, reducing chunk size');
                await this.waitForMemoryAvailability();
            }
            const chunkResults = await this.processChunk(chunk);
            results.push(...chunkResults);
            // Update stats
            for (const result of chunkResults) {
                stats.processedFiles++;
                processingTimes.push(result.processingTime);
                if (result.success) {
                    stats.successfulFiles++;
                }
                else {
                    stats.failedFiles++;
                }
            }
            // Force garbage collection between chunks if available
            if (global.gc && i + chunkSize < files.length) {
                global.gc();
            }
            logger_1.logger.info(`Processed chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(files.length / chunkSize)}`, {
                service: 'optimizedFileProcessing',
                processed: stats.processedFiles,
                successful: stats.successfulFiles,
                failed: stats.failedFiles
            });
        }
        stats.endTime = new Date();
        stats.averageProcessingTime = processingTimes.length > 0
            ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
            : 0;
        logger_1.logger.info('Batch processing completed', {
            service: 'optimizedFileProcessing',
            stats
        });
        return { results, stats };
    }
    /**
     * Process a chunk of files concurrently
     */
    async processChunk(files) {
        const promises = files.map(file => this.processFile(file.name, file.buffer));
        return Promise.all(promises);
    }
    /**
     * Process a single file with optimizations
     */
    async processFile(fileName, buffer) {
        const startTime = Date.now();
        const fileSize = buffer.length;
        // Check file size limits
        if (!memoryManagementService_1.memoryManagementService.isFileSizeAllowed(fileSize)) {
            return {
                fileName,
                success: false,
                fileSize,
                processingTime: Date.now() - startTime,
                error: `File size ${fileSize} exceeds limit`
            };
        }
        // Check cache first if enabled
        if (this.options.enableCaching) {
            const cacheKey = this.generateCacheKey(fileName, buffer);
            const cachedResult = await cachingService_1.cachingService.get('resumeData', cacheKey);
            if (cachedResult) {
                logger_1.logger.debug(`Cache hit for file: ${fileName}`);
                return {
                    ...cachedResult,
                    processingTime: Date.now() - startTime
                };
            }
        }
        try {
            let extractedText;
            if (this.options.useStreaming && fileSize > this.options.chunkSize) {
                extractedText = await this.processFileStreaming(fileName, buffer);
            }
            else {
                extractedText = await this.processFileInMemory(buffer);
            }
            const contactInfo = this.extractContactInformation(extractedText);
            const result = {
                fileName,
                success: true,
                extractedText,
                contactInfo,
                fileSize,
                processingTime: Date.now() - startTime
            };
            // Cache the result if enabled
            if (this.options.enableCaching) {
                const cacheKey = this.generateCacheKey(fileName, buffer);
                await cachingService_1.cachingService.set('resumeData', cacheKey, result);
            }
            return result;
        }
        catch (error) {
            const result = {
                fileName,
                success: false,
                fileSize,
                processingTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            logger_1.logger.error(`Failed to process file ${fileName}:`, error);
            return result;
        }
    }
    /**
     * Process file using streaming for large files
     */
    async processFileStreaming(fileName, buffer) {
        const tempFilePath = path.join(this.options.tempDirectory, `temp_${Date.now()}_${fileName}`);
        try {
            // Write buffer to temp file
            await fs.writeFile(tempFilePath, buffer);
            // Process file in chunks
            const fileHandle = await fs.open(tempFilePath, 'r');
            const chunks = [];
            try {
                let position = 0;
                const chunkSize = this.options.chunkSize;
                while (position < buffer.length) {
                    const chunk = Buffer.alloc(Math.min(chunkSize, buffer.length - position));
                    const { bytesRead } = await fileHandle.read(chunk, 0, chunk.length, position);
                    if (bytesRead === 0)
                        break;
                    chunks.push(chunk.slice(0, bytesRead));
                    position += bytesRead;
                }
            }
            finally {
                await fileHandle.close();
            }
            // Combine chunks and parse
            const combinedBuffer = Buffer.concat(chunks);
            const pdfData = await (0, pdf_parse_1.default)(combinedBuffer);
            return pdfData.text;
        }
        finally {
            // Clean up temp file
            try {
                await fs.unlink(tempFilePath);
            }
            catch (error) {
                logger_1.logger.warn(`Failed to clean up temp file ${tempFilePath}:`, error);
            }
        }
    }
    /**
     * Process file in memory for smaller files
     */
    async processFileInMemory(buffer) {
        const pdfData = await (0, pdf_parse_1.default)(buffer);
        return pdfData.text;
    }
    /**
     * Extract contact information from text
     */
    extractContactInformation(text) {
        const contactInfo = {
            projectUrls: []
        };
        // Extract email
        const emailMatch = text.match(this.contactRegexes.get('email'));
        if (emailMatch) {
            contactInfo.email = emailMatch[0];
        }
        // Extract phone
        const phoneMatch = text.match(this.contactRegexes.get('phone'));
        if (phoneMatch) {
            contactInfo.phone = phoneMatch[0];
        }
        // Extract LinkedIn URL
        const linkedinMatch = text.match(this.contactRegexes.get('linkedin'));
        if (linkedinMatch) {
            contactInfo.linkedInUrl = linkedinMatch[0];
        }
        // Extract GitHub URL
        const githubMatch = text.match(this.contactRegexes.get('github'));
        if (githubMatch) {
            contactInfo.githubUrl = githubMatch[0];
        }
        // Extract project URLs (excluding LinkedIn and GitHub)
        const urlMatches = text.match(this.contactRegexes.get('projectUrl')) || [];
        contactInfo.projectUrls = urlMatches
            .filter(url => !url.includes('linkedin.com') &&
            !url.includes('github.com'))
            .slice(0, 10); // Limit to 10 URLs
        return contactInfo;
    }
    /**
     * Generate cache key for file
     */
    generateCacheKey(fileName, buffer) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        return `${fileName}_${hash}`;
    }
    /**
     * Wait for memory availability
     */
    async waitForMemoryAvailability() {
        return new Promise((resolve) => {
            const checkMemory = () => {
                if (memoryManagementService_1.memoryManagementService.canStartNewJob()) {
                    resolve();
                }
                else {
                    setTimeout(checkMemory, 1000); // Check every second
                }
            };
            checkMemory();
        });
    }
    /**
     * Process files from file paths (for large batches)
     */
    async processBatchFromPaths(filePaths) {
        const stats = {
            totalFiles: filePaths.length,
            processedFiles: 0,
            successfulFiles: 0,
            failedFiles: 0,
            totalSize: 0,
            averageProcessingTime: 0,
            startTime: new Date()
        };
        const results = [];
        const processingTimes = [];
        // Process files in chunks to avoid loading all into memory
        const chunkSize = Math.min(this.options.maxConcurrentFiles, filePaths.length);
        for (let i = 0; i < filePaths.length; i += chunkSize) {
            const chunk = filePaths.slice(i, i + chunkSize);
            const chunkPromises = chunk.map(async (filePath) => {
                try {
                    const buffer = await fs.readFile(filePath);
                    const fileName = path.basename(filePath);
                    stats.totalSize += buffer.length;
                    return await this.processFile(fileName, buffer);
                }
                catch (error) {
                    return {
                        fileName: path.basename(filePath),
                        success: false,
                        fileSize: 0,
                        processingTime: 0,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            });
            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);
            // Update stats
            for (const result of chunkResults) {
                stats.processedFiles++;
                processingTimes.push(result.processingTime);
                if (result.success) {
                    stats.successfulFiles++;
                }
                else {
                    stats.failedFiles++;
                }
            }
            // Force garbage collection between chunks
            if (global.gc && i + chunkSize < filePaths.length) {
                global.gc();
            }
        }
        stats.endTime = new Date();
        stats.averageProcessingTime = processingTimes.length > 0
            ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
            : 0;
        return { results, stats };
    }
    /**
     * Get processing statistics
     */
    getProcessingOptions() {
        return { ...this.options };
    }
    /**
     * Update processing options
     */
    updateProcessingOptions(options) {
        Object.assign(this.options, options);
        logger_1.logger.info('File processing options updated', {
            service: 'optimizedFileProcessing',
            options: this.options
        });
    }
    /**
     * Health check for file processing service
     */
    async healthCheck() {
        try {
            // Check temp directory accessibility
            await fs.access(this.options.tempDirectory);
            // Check memory availability
            const memoryHealthy = memoryManagementService_1.memoryManagementService.canStartNewJob();
            return {
                healthy: memoryHealthy,
                details: {
                    tempDirectoryAccessible: true,
                    memoryAvailable: memoryHealthy,
                    processingOptions: this.options,
                    activeProcessing: this.activeProcessing
                }
            };
        }
        catch (error) {
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    tempDirectoryAccessible: false,
                    processingOptions: this.options
                }
            };
        }
    }
    /**
     * Cleanup temp files and resources
     */
    async cleanup() {
        try {
            // Clean up temp directory
            const files = await fs.readdir(this.options.tempDirectory);
            const tempFiles = files.filter(file => file.startsWith('temp_'));
            for (const file of tempFiles) {
                try {
                    await fs.unlink(path.join(this.options.tempDirectory, file));
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to clean up temp file ${file}:`, error);
                }
            }
            logger_1.logger.info(`Cleaned up ${tempFiles.length} temp files`);
        }
        catch (error) {
            logger_1.logger.error('Failed to cleanup temp files:', error);
        }
    }
}
exports.OptimizedFileProcessingService = OptimizedFileProcessingService;
// Export singleton instance
exports.optimizedFileProcessingService = new OptimizedFileProcessingService();
