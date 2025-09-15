"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const batchProcessingService_1 = require("../services/batchProcessingService");
const resumeProcessingService_1 = require("../services/resumeProcessingService");
const rateLimiting_1 = require("../middleware/rateLimiting");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10000
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF files are allowed.`));
        }
        if (!file.originalname || file.originalname.trim().length === 0) {
            return cb(new Error('File name is required'));
        }
        if (!file.originalname.toLowerCase().endsWith('.pdf')) {
            return cb(new Error('File must have .pdf extension'));
        }
        if (file.originalname.length > 255) {
            return cb(new Error('File name is too long (max 255 characters)'));
        }
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (dangerousChars.test(file.originalname)) {
            return cb(new Error('File name contains invalid characters'));
        }
        cb(null, true);
    }
});
const batchProcessor = new batchProcessingService_1.BatchProcessingService();
const resumeProcessor = new resumeProcessingService_1.ResumeProcessingService();
function handleMulterError(error, req, res, next) {
    if (error instanceof multer_1.default.MulterError) {
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
    }
    else if (error.message.includes('Only PDF files are allowed') ||
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
router.post('/upload-batch', rateLimiting_1.uploadRateLimit, (0, auth_1.authorize)(['admin', 'recruiter']), upload.array('resumes', 10000), handleMulterError, async (req, res) => {
    try {
        const files = req.files;
        const { jobProfileId } = req.body;
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
        const validFiles = files.filter(file => file && file.buffer && file.originalname);
        if (validFiles.length !== files.length) {
            res.status(400).json({
                success: false,
                error: 'Invalid files detected',
                message: 'Some uploaded files are corrupted or invalid'
            });
            return;
        }
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
        const resumeFiles = validFiles.map(file => ({
            buffer: file.buffer,
            fileName: file.originalname
        }));
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
    }
    catch (error) {
        console.error('Batch upload error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('job profile') || errorMessage.includes('not found')) {
            res.status(404).json({
                success: false,
                error: 'Job profile not found',
                message: 'The specified job profile does not exist'
            });
        }
        else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
            res.status(400).json({
                success: false,
                error: 'Validation error',
                message: errorMessage
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Batch processing failed',
                message: 'An internal error occurred while starting batch processing',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
            });
        }
    }
});
router.post('/upload-single', rateLimiting_1.uploadRateLimit, (0, auth_1.authorize)(['admin', 'recruiter']), upload.single('resume'), handleMulterError, async (req, res) => {
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
        if (!file.buffer || file.buffer.length === 0) {
            res.status(400).json({
                success: false,
                error: 'Empty file',
                message: 'The uploaded file is empty'
            });
            return;
        }
        const resumeData = await resumeProcessor.processSingleResume(file.buffer, file.originalname);
        res.status(200).json({
            success: true,
            message: 'Resume processed successfully',
            data: resumeData
        });
    }
    catch (error) {
        console.error('Single resume processing error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('PDF') || errorMessage.includes('parse')) {
            res.status(400).json({
                success: false,
                error: 'PDF processing error',
                message: 'Unable to process the PDF file. Please ensure it is a valid PDF document.'
            });
        }
        else if (errorMessage.includes('text extraction')) {
            res.status(422).json({
                success: false,
                error: 'Text extraction failed',
                message: 'Could not extract text from the PDF. The file may be image-based or corrupted.'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Resume processing failed',
                message: 'An internal error occurred while processing the resume',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
            });
        }
    }
});
router.get('/batch/:batchId/progress', (req, res) => {
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
    }
    catch (error) {
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
router.get('/batches/active', (req, res) => {
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
    }
    catch (error) {
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
router.delete('/batch/:batchId', (req, res) => {
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
    }
    catch (error) {
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
batchProcessor.on('progress', (progress) => {
    console.log(`Batch ${progress.batchId}: ${progress.progress}% complete (${progress.processedFiles}/${progress.totalFiles})`);
});
batchProcessor.on('completed', ({ batch, candidates }) => {
    console.log(`Batch ${batch.id} completed: ${batch.processedCandidates} candidates processed`);
});
batchProcessor.on('error', ({ batch, error }) => {
    console.error(`Batch ${batch.id} failed:`, error);
});
exports.default = router;
//# sourceMappingURL=resumeRoutes.js.map