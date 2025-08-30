import { Router, Request, Response } from 'express';
import multer from 'multer';
import { BatchProcessingService, ResumeFile } from '../services/batchProcessingService';
import { ResumeProcessingService } from '../services/resumeProcessingService';
import { uploadRateLimit } from '../middleware/rateLimiting';
import { authorize } from '../middleware/auth';

const router = Router();

// Configure multer for file uploads with enhanced validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10000 // Maximum 10,000 files as per requirements
  },
  fileFilter: (req, file, cb) => {
    // Validate file type
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF files are allowed.`));
    }
    
    // Validate file name
    if (!file.originalname || file.originalname.trim().length === 0) {
      return cb(new Error('File name is required'));
    }
    
    // Check for valid file extension
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return cb(new Error('File must have .pdf extension'));
    }
    
    // Validate file name length
    if (file.originalname.length > 255) {
      return cb(new Error('File name is too long (max 255 characters)'));
    }
    
    // Check for potentially dangerous characters in filename
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (dangerousChars.test(file.originalname)) {
      return cb(new Error('File name contains invalid characters'));
    }
    
    cb(null, true);
  }
});

const batchProcessor = new BatchProcessingService();
const resumeProcessor = new ResumeProcessingService();

/**
 * Middleware to handle multer errors
 */
function handleMulterError(error: any, req: Request, res: Response, next: any): void {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(400).json({
          success: false,
          error: 'File too large',
          message: 'Each file must be smaller than 10MB'
        });
        return;
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          success: false,
          error: 'Too many files',
          message: 'Maximum 10,000 files allowed per batch'
        });
        return;
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          success: false,
          error: 'Unexpected file field',
          message: 'Use "resumes" field for file uploads'
        });
        return;
      default:
        res.status(400).json({
          success: false,
          error: 'File upload error',
          message: error.message
        });
        return;
    }
  } else if (error.message.includes('Only PDF files are allowed') || 
             error.message.includes('Invalid file type') ||
             error.message.includes('File name') ||
             error.message.includes('invalid characters')) {
    res.status(400).json({
      success: false,
      error: 'File validation error',
      message: error.message
    });
    return;
  }
  
  next(error);
}

/**
 * POST /api/resumes/upload-batch
 * Upload and process multiple PDF resumes
 */
router.post('/upload-batch', 
  uploadRateLimit,
  authorize(['admin', 'recruiter']),
  upload.array('resumes', 10000), 
  handleMulterError, 
  async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const { jobProfileId } = req.body;

    // Validate input
    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No files uploaded',
        message: 'Please upload at least one PDF file'
      });
      return;
    }

    if (!jobProfileId || typeof jobProfileId !== 'string' || jobProfileId.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing job profile ID',
        message: 'jobProfileId is required for batch processing'
      });
      return;
    }

    // Additional validation for file array
    const validFiles = files.filter(file => file && file.buffer && file.originalname);
    if (validFiles.length !== files.length) {
      res.status(400).json({
        success: false,
        error: 'Invalid files detected',
        message: 'Some uploaded files are corrupted or invalid'
      });
      return;
    }

    // Check for duplicate file names
    const fileNames = validFiles.map(f => f.originalname);
    const uniqueNames = new Set(fileNames);
    if (uniqueNames.size !== fileNames.length) {
      res.status(400).json({
        success: false,
        error: 'Duplicate file names',
        message: 'Each file must have a unique name'
      });
      return;
    }

    // Convert multer files to ResumeFile format
    const resumeFiles: ResumeFile[] = validFiles.map(file => ({
      buffer: file.buffer,
      fileName: file.originalname
    }));

    // Start batch processing (async)
    const batch = await batchProcessor.processBatch(resumeFiles, jobProfileId);

    res.status(202).json({
      success: true,
      message: 'Batch processing started successfully',
      data: {
        batchId: batch.id,
        totalFiles: batch.totalCandidates,
        status: batch.status,
        startedAt: batch.startedAt
      }
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('job profile') || errorMessage.includes('not found')) {
      res.status(404).json({
        success: false,
        error: 'Job profile not found',
        message: 'The specified job profile does not exist'
      });
    } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        message: errorMessage
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Batch processing failed',
        message: 'An internal error occurred while starting batch processing',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
});

/**
 * POST /api/resumes/upload-single
 * Upload and process a single PDF resume
 */
router.post('/upload-single', 
  uploadRateLimit,
  authorize(['admin', 'recruiter']),
  upload.single('resume'), 
  handleMulterError, 
  async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please upload a PDF file'
      });
      return;
    }

    // Validate file buffer
    if (!file.buffer || file.buffer.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Empty file',
        message: 'The uploaded file is empty'
      });
      return;
    }

    // Process the single resume
    const resumeData = await resumeProcessor.processSingleResume(file.buffer, file.originalname);

    res.status(200).json({
      success: true,
      message: 'Resume processed successfully',
      data: resumeData
    });

  } catch (error) {
    console.error('Single resume processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('PDF') || errorMessage.includes('parse')) {
      res.status(400).json({
        success: false,
        error: 'PDF processing error',
        message: 'Unable to process the PDF file. Please ensure it is a valid PDF document.'
      });
    } else if (errorMessage.includes('text extraction')) {
      res.status(422).json({
        success: false,
        error: 'Text extraction failed',
        message: 'Could not extract text from the PDF. The file may be image-based or corrupted.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Resume processing failed',
        message: 'An internal error occurred while processing the resume',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
});

/**
 * GET /api/resumes/batch/:batchId/progress
 * Get progress for a specific batch
 */
router.get('/batch/:batchId/progress', (req: Request, res: Response): void => {
  try {
    const { batchId } = req.params;
    
    if (!batchId || typeof batchId !== 'string' || batchId.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing batch ID',
        message: 'Batch ID is required'
      });
      return;
    }
    
    const progress = batchProcessor.getBatchProgress(batchId);

    if (!progress) {
      res.status(404).json({
        success: false,
        error: 'Batch not found',
        message: `No active batch found with ID: ${batchId}`
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: progress,
      message: 'Batch progress retrieved successfully'
    });

  } catch (error) {
    console.error('Get batch progress error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to get batch progress',
      message: 'An internal error occurred while retrieving batch progress',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

/**
 * GET /api/resumes/batches/active
 * Get all active batches
 */
router.get('/batches/active', (req: Request, res: Response): void => {
  try {
    const activeBatches = batchProcessor.getActiveBatches();
    res.status(200).json({
      success: true,
      data: {
        activeBatches,
        count: activeBatches.length
      },
      message: 'Active batches retrieved successfully'
    });

  } catch (error) {
    console.error('Get active batches error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to get active batches',
      message: 'An internal error occurred while retrieving active batches',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

/**
 * DELETE /api/resumes/batch/:batchId
 * Cancel a batch processing
 */
router.delete('/batch/:batchId', (req: Request, res: Response): void => {
  try {
    const { batchId } = req.params;
    
    if (!batchId || typeof batchId !== 'string' || batchId.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing batch ID',
        message: 'Batch ID is required'
      });
      return;
    }
    
    const cancelled = batchProcessor.cancelBatch(batchId);

    if (!cancelled) {
      res.status(404).json({
        success: false,
        error: 'Cannot cancel batch',
        message: 'Batch not found or already completed'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Batch cancelled successfully',
      data: { batchId }
    });

  } catch (error) {
    console.error('Cancel batch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to cancel batch',
      message: 'An internal error occurred while cancelling the batch',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

// Set up event listeners for batch processing events
batchProcessor.on('progress', (progress) => {
  console.log(`Batch ${progress.batchId}: ${progress.progress}% complete (${progress.processedFiles}/${progress.totalFiles})`);
});

batchProcessor.on('completed', ({ batch, candidates }) => {
  console.log(`Batch ${batch.id} completed: ${batch.processedCandidates} candidates processed`);
});

batchProcessor.on('error', ({ batch, error }) => {
  console.error(`Batch ${batch.id} failed:`, error);
});

export default router;