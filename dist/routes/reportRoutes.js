"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const reportGenerationService_1 = require("../services/reportGenerationService");
const rateLimiting_1 = require("../middleware/rateLimiting");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const reportService = new reportGenerationService_1.ReportGenerationService();
router.post('/candidate/:candidateId/pdf', rateLimiting_1.exportRateLimit, (0, auth_1.authorize)(['admin', 'recruiter', 'viewer']), async (req, res) => {
    try {
        const { candidate, jobProfile, interviewAnalysis } = req.body;
        if (!candidate || !jobProfile) {
            res.status(400).json({
                error: 'Candidate and job profile data are required'
            });
            return;
        }
        const filePath = await reportService.generateCandidatePDF(candidate, jobProfile, interviewAnalysis);
        res.json({
            success: true,
            filePath,
            message: 'Candidate PDF report generated successfully'
        });
    }
    catch (error) {
        console.error('Error generating candidate PDF:', error);
        res.status(500).json({
            error: 'Failed to generate candidate PDF report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/batch/:batchId/pdf', rateLimiting_1.exportRateLimit, (0, auth_1.authorize)(['admin', 'recruiter', 'viewer']), async (req, res) => {
    try {
        const { batch, candidates, jobProfile, interviewAnalyses } = req.body;
        if (!batch || !candidates || !jobProfile) {
            res.status(400).json({
                error: 'Batch, candidates, and job profile data are required'
            });
            return;
        }
        const filePath = await reportService.generateBatchSummaryPDF(batch, candidates, jobProfile, interviewAnalyses);
        res.json({
            success: true,
            filePath,
            message: 'Batch summary PDF report generated successfully'
        });
    }
    catch (error) {
        console.error('Error generating batch PDF:', error);
        res.status(500).json({
            error: 'Failed to generate batch PDF report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/candidates/csv', rateLimiting_1.exportRateLimit, (0, auth_1.authorize)(['admin', 'recruiter', 'viewer']), async (req, res) => {
    try {
        const { candidates, jobProfile, interviewAnalyses } = req.body;
        if (!candidates || !jobProfile) {
            res.status(400).json({
                error: 'Candidates and job profile data are required'
            });
            return;
        }
        const filePath = await reportService.exportCandidatesCSV(candidates, jobProfile, interviewAnalyses);
        res.json({
            success: true,
            filePath,
            message: 'Candidates CSV export generated successfully'
        });
    }
    catch (error) {
        console.error('Error generating CSV export:', error);
        res.status(500).json({
            error: 'Failed to generate CSV export',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/candidate/:candidateId/data', async (req, res) => {
    try {
        const { candidate, jobProfile, interviewAnalysis } = req.body;
        if (!candidate || !jobProfile) {
            res.status(400).json({
                error: 'Candidate and job profile data are required'
            });
            return;
        }
        const report = await reportService.generateCandidateReport(candidate, jobProfile, interviewAnalysis);
        res.json({
            success: true,
            report,
            message: 'Candidate report data generated successfully'
        });
    }
    catch (error) {
        console.error('Error generating candidate report data:', error);
        res.status(500).json({
            error: 'Failed to generate candidate report data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/batch/:batchId/data', async (req, res) => {
    try {
        const { batch, candidates, jobProfile, interviewAnalyses } = req.body;
        if (!batch || !candidates || !jobProfile) {
            res.status(400).json({
                error: 'Batch, candidates, and job profile data are required'
            });
            return;
        }
        const report = await reportService.generateBatchSummaryReport(batch, candidates, jobProfile, interviewAnalyses);
        res.json({
            success: true,
            report,
            message: 'Batch summary report data generated successfully'
        });
    }
    catch (error) {
        console.error('Error generating batch report data:', error);
        res.status(500).json({
            error: 'Failed to generate batch report data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = `reports/${filename}`;
        res.download(filePath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(404).json({ error: 'File not found' });
            }
        });
    }
    catch (error) {
        console.error('Error downloading report:', error);
        res.status(500).json({
            error: 'Failed to download report',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=reportRoutes.js.map