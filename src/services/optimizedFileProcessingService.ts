import * as fs from 'fs/promises';
import * as path from 'path';
import * as stream from 'stream';
import { promisify } from 'util';
import pdfParse from 'pdf-parse';
import { logger } from '../utils/logger';
import { memoryManagementService } from './memoryManagementService';
import { cachingService } from './cachingService';

const pipeline = promisify(stream.pipeline);

export interface FileProcessingOptions {
  maxConcurrentFiles: number;
  chunkSize: number;
  useStreaming: boolean;
  enableCaching: boolean;
  tempDirectory: string;
}

export interface ProcessingResult {
  fileName: string;
  success: boolean;
  extractedText?: string;
  contactInfo?: {
    phone?: string;
    email?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    projectUrls: string[];
  };
  fileSize: number;
  processingTime: number;
  error?: string;
}

export interface BatchProcessingStats {
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  totalSize: number;
  averageProcessingTime: number;
  startTime: Date;
  endTime?: Date;
}

export class OptimizedFileProcessingService {
  private readonly options: FileProcessingOptions;
  private readonly contactRegexes: Map<string, RegExp>;
  private processingQueue: Array<() => Promise<ProcessingResult>> = [];
  private activeProcessing = 0;

  constructor(options?: Partial<FileProcessingOptions>) {
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
  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.options.tempDirectory, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Process a batch of files with optimized memory usage
   */
  async processBatch(files: Array<{ name: string; buffer: Buffer }>): Promise<{
    results: ProcessingResult[];
    stats: BatchProcessingStats;
  }> {
    const stats: BatchProcessingStats = {
      totalFiles: files.length,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      totalSize: files.reduce((sum, file) => sum + file.buffer.length, 0),
      averageProcessingTime: 0,
      startTime: new Date()
    };

    logger.info(`Starting batch processing of ${files.length} files`, {
      service: 'optimizedFileProcessing',
      totalFiles: files.length,
      totalSize: stats.totalSize,
      maxConcurrent: this.options.maxConcurrentFiles
    });

    // Check if batch size is within memory limits
    if (!memoryManagementService.isBatchSizeAllowed(files.length)) {
      throw new Error(`Batch size ${files.length} exceeds memory limits`);
    }

    const results: ProcessingResult[] = [];
    const processingTimes: number[] = [];

    // Process files in chunks to manage memory
    const chunkSize = Math.min(this.options.maxConcurrentFiles, files.length);
    
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      
      // Check memory before processing each chunk
      if (!memoryManagementService.canStartNewJob()) {
        logger.warn('Memory constraints detected, reducing chunk size');
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
        } else {
          stats.failedFiles++;
        }
      }

      // Force garbage collection between chunks if available
      if (global.gc && i + chunkSize < files.length) {
        global.gc();
      }

      logger.info(`Processed chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(files.length / chunkSize)}`, {
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

    logger.info('Batch processing completed', {
      service: 'optimizedFileProcessing',
      stats
    });

    return { results, stats };
  }

  /**
   * Process a chunk of files concurrently
   */
  private async processChunk(files: Array<{ name: string; buffer: Buffer }>): Promise<ProcessingResult[]> {
    const promises = files.map(file => this.processFile(file.name, file.buffer));
    return Promise.all(promises);
  }

  /**
   * Process a single file with optimizations
   */
  async processFile(fileName: string, buffer: Buffer): Promise<ProcessingResult> {
    const startTime = Date.now();
    const fileSize = buffer.length;

    // Check file size limits
    if (!memoryManagementService.isFileSizeAllowed(fileSize)) {
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
      const cachedResult = await cachingService.get<ProcessingResult>('resumeData', cacheKey);
      
      if (cachedResult) {
        logger.debug(`Cache hit for file: ${fileName}`);
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime
        };
      }
    }

    try {
      let extractedText: string;

      if (this.options.useStreaming && fileSize > this.options.chunkSize) {
        extractedText = await this.processFileStreaming(fileName, buffer);
      } else {
        extractedText = await this.processFileInMemory(buffer);
      }

      const contactInfo = this.extractContactInformation(extractedText);
      
      const result: ProcessingResult = {
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
        await cachingService.set('resumeData', cacheKey, result);
      }

      return result;

    } catch (error) {
      const result: ProcessingResult = {
        fileName,
        success: false,
        fileSize,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      logger.error(`Failed to process file ${fileName}:`, error);
      return result;
    }
  }

  /**
   * Process file using streaming for large files
   */
  private async processFileStreaming(fileName: string, buffer: Buffer): Promise<string> {
    const tempFilePath = path.join(this.options.tempDirectory, `temp_${Date.now()}_${fileName}`);
    
    try {
      // Write buffer to temp file
      await fs.writeFile(tempFilePath, buffer);
      
      // Process file in chunks
      const fileHandle = await fs.open(tempFilePath, 'r');
      const chunks: Buffer[] = [];
      
      try {
        let position = 0;
        const chunkSize = this.options.chunkSize;
        
        while (position < buffer.length) {
          const chunk = Buffer.alloc(Math.min(chunkSize, buffer.length - position));
          const { bytesRead } = await fileHandle.read(chunk, 0, chunk.length, position);
          
          if (bytesRead === 0) break;
          
          chunks.push(chunk.slice(0, bytesRead));
          position += bytesRead;
        }
      } finally {
        await fileHandle.close();
      }
      
      // Combine chunks and parse
      const combinedBuffer = Buffer.concat(chunks);
      const pdfData = await pdfParse(combinedBuffer);
      
      return pdfData.text;
      
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (error) {
        logger.warn(`Failed to clean up temp file ${tempFilePath}:`, { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  /**
   * Process file in memory for smaller files
   */
  private async processFileInMemory(buffer: Buffer): Promise<string> {
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  }

  /**
   * Extract contact information from text
   */
  private extractContactInformation(text: string): {
    phone?: string;
    email?: string;
    linkedInUrl?: string;
    githubUrl?: string;
    projectUrls: string[];
  } {
    const contactInfo: {
      phone?: string;
      email?: string;
      linkedInUrl?: string;
      githubUrl?: string;
      projectUrls: string[];
    } = {
      projectUrls: []
    };

    // Extract email
    const emailMatch = text.match(this.contactRegexes.get('email')!);
    if (emailMatch) {
      contactInfo.email = emailMatch[0];
    }

    // Extract phone
    const phoneMatch = text.match(this.contactRegexes.get('phone')!);
    if (phoneMatch) {
      contactInfo.phone = phoneMatch[0];
    }

    // Extract LinkedIn URL
    const linkedinMatch = text.match(this.contactRegexes.get('linkedin')!);
    if (linkedinMatch) {
      contactInfo.linkedInUrl = linkedinMatch[0];
    }

    // Extract GitHub URL
    const githubMatch = text.match(this.contactRegexes.get('github')!);
    if (githubMatch) {
      contactInfo.githubUrl = githubMatch[0];
    }

    // Extract project URLs (excluding LinkedIn and GitHub)
    const urlMatches = text.match(this.contactRegexes.get('projectUrl')!) || [];
    contactInfo.projectUrls = urlMatches
      .filter(url => 
        !url.includes('linkedin.com') && 
        !url.includes('github.com')
      )
      .slice(0, 10); // Limit to 10 URLs

    return contactInfo;
  }

  /**
   * Generate cache key for file
   */
  private generateCacheKey(fileName: string, buffer: Buffer): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    return `${fileName}_${hash}`;
  }

  /**
   * Wait for memory availability
   */
  private async waitForMemoryAvailability(): Promise<void> {
    return new Promise((resolve) => {
      const checkMemory = () => {
        if (memoryManagementService.canStartNewJob()) {
          resolve();
        } else {
          setTimeout(checkMemory, 1000); // Check every second
        }
      };
      checkMemory();
    });
  }

  /**
   * Process files from file paths (for large batches)
   */
  async processBatchFromPaths(filePaths: string[]): Promise<{
    results: ProcessingResult[];
    stats: BatchProcessingStats;
  }> {
    const stats: BatchProcessingStats = {
      totalFiles: filePaths.length,
      processedFiles: 0,
      successfulFiles: 0,
      failedFiles: 0,
      totalSize: 0,
      averageProcessingTime: 0,
      startTime: new Date()
    };

    const results: ProcessingResult[] = [];
    const processingTimes: number[] = [];

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
        } catch (error) {
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
        } else {
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
  getProcessingOptions(): FileProcessingOptions {
    return { ...this.options };
  }

  /**
   * Update processing options
   */
  updateProcessingOptions(options: Partial<FileProcessingOptions>): void {
    Object.assign(this.options, options);
    logger.info('File processing options updated', {
      service: 'optimizedFileProcessing',
      options: this.options
    });
  }

  /**
   * Health check for file processing service
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      // Check temp directory accessibility
      await fs.access(this.options.tempDirectory);
      
      // Check memory availability
      const memoryHealthy = memoryManagementService.canStartNewJob();
      
      return {
        healthy: memoryHealthy,
        details: {
          tempDirectoryAccessible: true,
          memoryAvailable: memoryHealthy,
          processingOptions: this.options,
          activeProcessing: this.activeProcessing
        }
      };
    } catch (error) {
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
  async cleanup(): Promise<void> {
    try {
      // Clean up temp directory
      const files = await fs.readdir(this.options.tempDirectory);
      const tempFiles = files.filter(file => file.startsWith('temp_'));
      
      for (const file of tempFiles) {
        try {
          await fs.unlink(path.join(this.options.tempDirectory, file));
        } catch (error) {
          logger.warn(`Failed to clean up temp file ${file}:`, { error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
      
      logger.info(`Cleaned up ${tempFiles.length} temp files`);
    } catch (error) {
      logger.error('Failed to cleanup temp files:', error);
    }
  }
}

// Export singleton instance
export const optimizedFileProcessingService = new OptimizedFileProcessingService();