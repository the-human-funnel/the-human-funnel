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
            chunkSize: 1024 * 1024,
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
    async ensureTempDirectory() {
        try {
            await fs.mkdir(this.options.tempDirectory, { recursive: true });
        }
        catch (error) {
            logger_1.logger.error('Failed to create temp directory:', error);
        }
    }
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
        if (!memoryManagementService_1.memoryManagementService.isBatchSizeAllowed(files.length)) {
            throw new Error(`Batch size ${files.length} exceeds memory limits`);
        }
        const results = [];
        const processingTimes = [];
        const chunkSize = Math.min(this.options.maxConcurrentFiles, files.length);
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            if (!memoryManagementService_1.memoryManagementService.canStartNewJob()) {
                logger_1.logger.warn('Memory constraints detected, reducing chunk size');
                await this.waitForMemoryAvailability();
            }
            const chunkResults = await this.processChunk(chunk);
            results.push(...chunkResults);
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
    async processChunk(files) {
        const promises = files.map(file => this.processFile(file.name, file.buffer));
        return Promise.all(promises);
    }
    async processFile(fileName, buffer) {
        const startTime = Date.now();
        const fileSize = buffer.length;
        if (!memoryManagementService_1.memoryManagementService.isFileSizeAllowed(fileSize)) {
            return {
                fileName,
                success: false,
                fileSize,
                processingTime: Date.now() - startTime,
                error: `File size ${fileSize} exceeds limit`
            };
        }
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
    async processFileStreaming(fileName, buffer) {
        const tempFilePath = path.join(this.options.tempDirectory, `temp_${Date.now()}_${fileName}`);
        try {
            await fs.writeFile(tempFilePath, buffer);
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
            const combinedBuffer = Buffer.concat(chunks);
            const pdfData = await (0, pdf_parse_1.default)(combinedBuffer);
            return pdfData.text;
        }
        finally {
            try {
                await fs.unlink(tempFilePath);
            }
            catch (error) {
                logger_1.logger.warn(`Failed to clean up temp file ${tempFilePath}:`, { error: error instanceof Error ? error.message : 'Unknown error' });
            }
        }
    }
    async processFileInMemory(buffer) {
        const pdfData = await (0, pdf_parse_1.default)(buffer);
        return pdfData.text;
    }
    extractContactInformation(text) {
        const contactInfo = {
            projectUrls: []
        };
        const emailMatch = text.match(this.contactRegexes.get('email'));
        if (emailMatch) {
            contactInfo.email = emailMatch[0];
        }
        const phoneMatch = text.match(this.contactRegexes.get('phone'));
        if (phoneMatch) {
            contactInfo.phone = phoneMatch[0];
        }
        const linkedinMatch = text.match(this.contactRegexes.get('linkedin'));
        if (linkedinMatch) {
            contactInfo.linkedInUrl = linkedinMatch[0];
        }
        const githubMatch = text.match(this.contactRegexes.get('github'));
        if (githubMatch) {
            contactInfo.githubUrl = githubMatch[0];
        }
        const urlMatches = text.match(this.contactRegexes.get('projectUrl')) || [];
        contactInfo.projectUrls = urlMatches
            .filter(url => !url.includes('linkedin.com') &&
            !url.includes('github.com'))
            .slice(0, 10);
        return contactInfo;
    }
    generateCacheKey(fileName, buffer) {
        const crypto = require('crypto');
        const hash = crypto.createHash('md5').update(buffer).digest('hex');
        return `${fileName}_${hash}`;
    }
    async waitForMemoryAvailability() {
        return new Promise((resolve) => {
            const checkMemory = () => {
                if (memoryManagementService_1.memoryManagementService.canStartNewJob()) {
                    resolve();
                }
                else {
                    setTimeout(checkMemory, 1000);
                }
            };
            checkMemory();
        });
    }
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
    getProcessingOptions() {
        return { ...this.options };
    }
    updateProcessingOptions(options) {
        Object.assign(this.options, options);
        logger_1.logger.info('File processing options updated', {
            service: 'optimizedFileProcessing',
            options: this.options
        });
    }
    async healthCheck() {
        try {
            await fs.access(this.options.tempDirectory);
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
    async cleanup() {
        try {
            const files = await fs.readdir(this.options.tempDirectory);
            const tempFiles = files.filter(file => file.startsWith('temp_'));
            for (const file of tempFiles) {
                try {
                    await fs.unlink(path.join(this.options.tempDirectory, file));
                }
                catch (error) {
                    logger_1.logger.warn(`Failed to clean up temp file ${file}:`, { error: error instanceof Error ? error.message : 'Unknown error' });
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
exports.optimizedFileProcessingService = new OptimizedFileProcessingService();
//# sourceMappingURL=optimizedFileProcessingService.js.map