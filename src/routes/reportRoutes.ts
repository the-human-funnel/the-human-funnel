import express from 'express';
import { ReportGenerationService } from '../services/reportGenerationService';
import { Candidate, JobProfile, ProcessingBatch, InterviewAnalysisResult } from '../models/interfaces';
import { exportRateLimit } from '../middleware/rateLimiting';
import { authorize } from '../middleware/auth';

const router = express.Router();
const reportService = new ReportGenerationService();

/**
 * Generate PDF report for a single candidate
 * POST /api/reports/candidate/:candidateId/pdf
 */
router.post('/candidate/:candidateId/pdf', 
  exportRateLimit,
  authorize(['admin', 'recruiter', 'viewer']),
  async (req, res): Promise<void> => {
  try {
    const { candidate, jobProfile, interviewAnalysis } = req.body;

    if (!candidate || !jobProfile) {
      res.status(400).json({ 
        error: 'Candidate and job profile data are required' 
      });
      return;
    }

    const filePath = await reportService.generateCandidatePDF(
      candidate as Candidate,
      jobProfile as JobProfile,
      interviewAnalysis as InterviewAnalysisResult
    );

    res.json({
      success: true,
      filePath,
      message: 'Candidate PDF report generated successfully'
    });
  } catch (error) {
    console.error('Error generating candidate PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate candidate PDF report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate batch summary PDF report
 * POST /api/reports/batch/:batchId/pdf
 */
router.post('/batch/:batchId/pdf', 
  exportRateLimit,
  authorize(['admin', 'recruiter', 'viewer']),
  async (req, res): Promise<void> => {
  try {
    const { batch, candidates, jobProfile, interviewAnalyses } = req.body;

    if (!batch || !candidates || !jobProfile) {
      res.status(400).json({ 
        error: 'Batch, candidates, and job profile data are required' 
      });
      return;
    }

    const filePath = await reportService.generateBatchSummaryPDF(
      batch as ProcessingBatch,
      candidates as Candidate[],
      jobProfile as JobProfile,
      interviewAnalyses as InterviewAnalysisResult[]
    );

    res.json({
      success: true,
      filePath,
      message: 'Batch summary PDF report generated successfully'
    });
  } catch (error) {
    console.error('Error generating batch PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate batch PDF report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Export candidates data to CSV
 * POST /api/reports/candidates/csv
 */
router.post('/candidates/csv', 
  exportRateLimit,
  authorize(['admin', 'recruiter', 'viewer']),
  async (req, res): Promise<void> => {
  try {
    const { candidates, jobProfile, interviewAnalyses } = req.body;

    if (!candidates || !jobProfile) {
      res.status(400).json({ 
        error: 'Candidates and job profile data are required' 
      });
      return;
    }

    const filePath = await reportService.exportCandidatesCSV(
      candidates as Candidate[],
      jobProfile as JobProfile,
      interviewAnalyses as InterviewAnalysisResult[]
    );

    res.json({
      success: true,
      filePath,
      message: 'Candidates CSV export generated successfully'
    });
  } catch (error) {
    console.error('Error generating CSV export:', error);
    res.status(500).json({ 
      error: 'Failed to generate CSV export',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate candidate report data (without PDF generation)
 * POST /api/reports/candidate/:candidateId/data
 */
router.post('/candidate/:candidateId/data', async (req, res): Promise<void> => {
  try {
    const { candidate, jobProfile, interviewAnalysis } = req.body;

    if (!candidate || !jobProfile) {
      res.status(400).json({ 
        error: 'Candidate and job profile data are required' 
      });
      return;
    }

    const report = await reportService.generateCandidateReport(
      candidate as Candidate,
      jobProfile as JobProfile,
      interviewAnalysis as InterviewAnalysisResult
    );

    res.json({
      success: true,
      report,
      message: 'Candidate report data generated successfully'
    });
  } catch (error) {
    console.error('Error generating candidate report data:', error);
    res.status(500).json({ 
      error: 'Failed to generate candidate report data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate batch summary report data (without PDF generation)
 * POST /api/reports/batch/:batchId/data
 */
router.post('/batch/:batchId/data', async (req, res): Promise<void> => {
  try {
    const { batch, candidates, jobProfile, interviewAnalyses } = req.body;

    if (!batch || !candidates || !jobProfile) {
      res.status(400).json({ 
        error: 'Batch, candidates, and job profile data are required' 
      });
      return;
    }

    const report = await reportService.generateBatchSummaryReport(
      batch as ProcessingBatch,
      candidates as Candidate[],
      jobProfile as JobProfile,
      interviewAnalyses as InterviewAnalysisResult[]
    );

    res.json({
      success: true,
      report,
      message: 'Batch summary report data generated successfully'
    });
  } catch (error) {
    console.error('Error generating batch report data:', error);
    res.status(500).json({ 
      error: 'Failed to generate batch report data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Download generated report file
 * GET /api/reports/download/:filename
 */
router.get('/download/:filename', async (req, res): Promise<void> => {
  try {
    const { filename } = req.params;
    const filePath = `reports/${filename}`;
    
    res.download(filePath, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(404).json({ error: 'File not found' });
      }
    });
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ 
      error: 'Failed to download report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;