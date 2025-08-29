import { Router, Request, Response } from 'express';
import multer from 'multer';
import { BatchProcessingService, ResumeFile } from '../services/batchProcessingService';
import { ResumeProcessingService } from '../services/resumeProcessingService';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10000 // Maximum 10,000 files as per requirements
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

const batchProcessor = new BatchProcessingService();
const resumeProcessor = new ResumeProcessingService();

/**
 * POST /api/resumes/upload-batch
 * Upload and process multiple PDF resumes
 */
router.post('/upload-batch', upload.array('resumes', 10000), async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const { jobProfileId } = req.body;

    if (!files || files.length === 0) {
      res.status(400).json({
        error: 'No files uploaded',
        message: 'Please upload at least one PDF file'
      });
      return;
    }

    if (!jobProfileId) {
      res.status(400).json({
        error: 'Missing job profile ID',
        message: 'jobProfileId is required for batch processing'
      });
      return;
    }

    // Convert multer files to ResumeFile format
    const resumeFiles: ResumeFile[] = files.map(file => ({
      buffer: file.buffer,
      fileName: file.originalname
    }));

    // Start batch processing (async)
    const batch = await batchProcessor.processBatch(resumeFiles, jobProfileId);

    res.status(202).json({
      message: 'Batch processing started',
      batchId: batch.id,
      totalFiles: batch.totalCandidates,
      status: batch.status
    });

  } catch (error) {
    console.error('Batch upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Batch processing failed',
      message: errorMessage
    });
  }
});

/**
 * POST /api/resumes/upload-single
 * Upload and process a single PDF resume
 */
router.post('/upload-single', upload.single('resume'), async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a PDF file'
      });
      return;
    }

    // Process the single resume
    const resumeData = await resumeProcessor.processSingleResume(file.buffer, file.originalname);

    res.status(200).json({
      message: 'Resume processed successfully',
      resumeData
    });

  } catch (error) {
    console.error('Single resume processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Resume processing failed',
      message: errorMessage
    });
  }
});

/**
 * GET /api/resumes/batch/:batchId/progress
 * Get progress for a specific batch
 */
router.get('/batch/:batchId/progress', (req: Request, res: Response): void => {
  try {
    const { batchId } = req.params;
    
    if (!batchId) {
      res.status(400).json({
        error: 'Missing batch ID',
        message: 'Batch ID is required'
      });
      return;
    }
    
    const progress = batchProcessor.getBatchProgress(batchId);

    if (!progress) {
      res.status(404).json({
        error: 'Batch not found',
        message: `No active batch found with ID: ${batchId}`
      });
      return;
    }

    res.status(200).json(progress);

  } catch (error) {
    console.error('Get batch progress error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to get batch progress',
      message: errorMessage
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
      activeBatches,
      count: activeBatches.length
    });

  } catch (error) {
    console.error('Get active batches error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to get active batches',
      message: errorMessage
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
    
    if (!batchId) {
      res.status(400).json({
        error: 'Missing batch ID',
        message: 'Batch ID is required'
      });
      return;
    }
    
    const cancelled = batchProcessor.cancelBatch(batchId);

    if (!cancelled) {
      res.status(404).json({
        error: 'Cannot cancel batch',
        message: 'Batch not found or already completed'
      });
      return;
    }

    res.status(200).json({
      message: 'Batch cancelled successfully',
      batchId
    });

  } catch (error) {
    console.error('Cancel batch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Failed to cancel batch',
      message: errorMessage
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