"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const candidateService_1 = require("../services/candidateService");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.get('/export', validation_1.validateCandidateSearch, validation_1.validateExportParams, async (req, res) => {
    try {
        const filters = {};
        if (req.query.jobProfileId) {
            filters.jobProfileId = req.query.jobProfileId;
        }
        if (req.query.processingStage) {
            filters.processingStage = req.query.processingStage;
        }
        if (req.query.minScore) {
            filters.minScore = parseFloat(req.query.minScore);
        }
        if (req.query.maxScore) {
            filters.maxScore = parseFloat(req.query.maxScore);
        }
        if (req.query.recommendation) {
            filters.recommendation = req.query.recommendation;
        }
        const exportOptions = {
            format: req.query.format || 'csv',
            includeDetails: req.query.includeDetails === 'true'
        };
        if (req.query.fields) {
            exportOptions.fields = req.query.fields.split(',');
        }
        const exportData = await candidateService_1.candidateService.exportCandidates(filters, exportOptions);
        const filename = `candidates_export_${new Date().toISOString().split('T')[0]}`;
        const contentType = exportOptions.format === 'csv'
            ? 'text/csv'
            : 'application/json';
        const fileExtension = exportOptions.format === 'csv' ? 'csv' : 'json';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.${fileExtension}"`);
        res.status(200).send(exportData);
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/stats', async (req, res) => {
    try {
        const jobProfileId = req.query.jobProfileId;
        const [totalCount, completedCount, strongHireCount, hireCount, maybeCount, noHireCount] = await Promise.all([
            candidateService_1.candidateService.getCandidatesCount({ jobProfileId }),
            candidateService_1.candidateService.getCandidatesCount({ jobProfileId, processingStage: 'completed' }),
            candidateService_1.candidateService.getCandidatesCount({ jobProfileId, recommendation: 'strong-hire' }),
            candidateService_1.candidateService.getCandidatesCount({ jobProfileId, recommendation: 'hire' }),
            candidateService_1.candidateService.getCandidatesCount({ jobProfileId, recommendation: 'maybe' }),
            candidateService_1.candidateService.getCandidatesCount({ jobProfileId, recommendation: 'no-hire' })
        ]);
        res.status(200).json({
            success: true,
            data: {
                total: totalCount,
                completed: completedCount,
                inProgress: totalCount - completedCount,
                recommendations: {
                    strongHire: strongHireCount,
                    hire: hireCount,
                    maybe: maybeCount,
                    noHire: noHireCount
                },
                completionRate: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
            },
            message: 'Candidate statistics retrieved successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/batch/:batchId/progress', validation_1.validateObjectId, async (req, res) => {
    try {
        const { batchId } = req.params;
        if (!batchId) {
            return res.status(400).json({
                success: false,
                message: 'Batch ID parameter is required'
            });
        }
        const progress = await candidateService_1.candidateService.getBatchProgress(batchId);
        if (!progress) {
            return res.status(404).json({
                success: false,
                message: 'Batch not found'
            });
        }
        const completedCount = progress.candidateProgress.filter(c => c.completed).length;
        const overallProgress = (completedCount / progress.candidateProgress.length) * 100;
        res.status(200).json({
            success: true,
            data: {
                batchId,
                batch: progress.batch,
                candidateProgress: progress.candidateProgress,
                summary: {
                    totalCandidates: progress.candidateProgress.length,
                    completedCandidates: completedCount,
                    overallProgress: Math.round(overallProgress * 100) / 100
                }
            },
            message: 'Batch progress retrieved successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/top/:jobProfileId', validation_1.validateObjectId, async (req, res) => {
    try {
        const { jobProfileId } = req.params;
        if (!jobProfileId) {
            return res.status(400).json({
                success: false,
                message: 'Job Profile ID parameter is required'
            });
        }
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
        if (limit > 100) {
            return res.status(400).json({
                success: false,
                message: 'Limit cannot exceed 100'
            });
        }
        const topCandidates = await candidateService_1.candidateService.getTopCandidates(jobProfileId, limit);
        res.status(200).json({
            success: true,
            data: topCandidates,
            meta: {
                jobProfileId,
                count: topCandidates.length,
                limit
            },
            message: 'Top candidates retrieved successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/', validation_1.validateCandidateSearch, async (req, res) => {
    try {
        const filters = {};
        if (req.query.jobProfileId) {
            filters.jobProfileId = req.query.jobProfileId;
        }
        if (req.query.processingStage) {
            filters.processingStage = req.query.processingStage;
        }
        if (req.query.minScore) {
            filters.minScore = parseFloat(req.query.minScore);
        }
        if (req.query.maxScore) {
            filters.maxScore = parseFloat(req.query.maxScore);
        }
        if (req.query.recommendation) {
            filters.recommendation = req.query.recommendation;
        }
        if (req.query.createdAfter) {
            filters.createdAfter = new Date(req.query.createdAfter);
        }
        if (req.query.createdBefore) {
            filters.createdBefore = new Date(req.query.createdBefore);
        }
        if (req.query.hasLinkedIn) {
            filters.hasLinkedIn = req.query.hasLinkedIn === 'true';
        }
        if (req.query.hasGitHub) {
            filters.hasGitHub = req.query.hasGitHub === 'true';
        }
        if (req.query.interviewCompleted) {
            filters.interviewCompleted = req.query.interviewCompleted === 'true';
        }
        const options = {};
        if (req.query.page) {
            options.page = parseInt(req.query.page, 10);
        }
        if (req.query.limit) {
            options.limit = Math.min(parseInt(req.query.limit, 10), 1000);
        }
        if (req.query.sortBy) {
            options.sortBy = req.query.sortBy;
        }
        if (req.query.sortOrder) {
            options.sortOrder = req.query.sortOrder;
        }
        const result = await candidateService_1.candidateService.searchCandidates(filters, options);
        res.status(200).json({
            success: true,
            data: result.candidates,
            meta: {
                total: result.total,
                page: result.page,
                totalPages: result.totalPages,
                limit: options.limit || 50
            },
            message: 'Candidates retrieved successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/:id', validation_1.validateObjectId, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID parameter is required'
            });
        }
        const candidate = await candidateService_1.candidateService.getCandidateById(id);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }
        res.status(200).json({
            success: true,
            data: candidate,
            message: 'Candidate retrieved successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/:id/status', validation_1.validateObjectId, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID parameter is required'
            });
        }
        const status = await candidateService_1.candidateService.getCandidateStatus(id);
        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }
        res.status(200).json({
            success: true,
            data: {
                candidateId: id,
                currentStage: status.candidate.processingStage,
                progress: status.progress,
                overallProgress: calculateOverallProgress(status.progress)
            },
            message: 'Candidate status retrieved successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
function calculateOverallProgress(progress) {
    const completedStages = progress.filter(p => p.completed).length;
    return Math.round((completedStages / progress.length) * 100);
}
function handleRouteError(error, res) {
    console.error('Candidate Route Error:', error);
    if (error.message.includes('not found')) {
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
    else if (error.message.includes('validation') || error.message.includes('invalid')) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
    else if (error.message.includes('Failed to retrieve candidate') ||
        error.message.includes('Failed to search candidates')) {
        res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }
    else {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
exports.default = router;
//# sourceMappingURL=candidateRoutes.js.map