"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jobProfileService_1 = require("../services/jobProfileService");
const database_1 = require("../utils/database");
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.post('/', validation_1.validateCreateJobProfile, async (req, res) => {
    try {
        const jobProfileData = req.body;
        const jobProfile = await jobProfileService_1.jobProfileService.createJobProfile(jobProfileData);
        res.status(201).json({
            success: true,
            data: jobProfile,
            message: 'Job profile created successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/', async (req, res) => {
    try {
        const filters = {};
        if (req.query.title) {
            filters.title = req.query.title;
        }
        if (req.query.experienceLevel) {
            filters.experienceLevel = req.query.experienceLevel;
        }
        if (req.query.createdAfter) {
            filters.createdAfter = new Date(req.query.createdAfter);
        }
        if (req.query.createdBefore) {
            filters.createdBefore = new Date(req.query.createdBefore);
        }
        const jobProfiles = await jobProfileService_1.jobProfileService.getJobProfiles(filters);
        const totalCount = await jobProfileService_1.jobProfileService.getJobProfilesCount(filters);
        res.status(200).json({
            success: true,
            data: jobProfiles,
            meta: {
                total: totalCount,
                count: jobProfiles.length
            },
            message: 'Job profiles retrieved successfully'
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
        const jobProfile = await jobProfileService_1.jobProfileService.getJobProfileById(id);
        if (!jobProfile) {
            return res.status(404).json({
                success: false,
                message: 'Job profile not found'
            });
        }
        res.status(200).json({
            success: true,
            data: jobProfile,
            message: 'Job profile retrieved successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.put('/:id', validation_1.validateObjectId, validation_1.validateUpdateJobProfile, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID parameter is required'
            });
        }
        const updateData = { ...req.body, id };
        const jobProfile = await jobProfileService_1.jobProfileService.updateJobProfile(updateData);
        if (!jobProfile) {
            return res.status(404).json({
                success: false,
                message: 'Job profile not found'
            });
        }
        res.status(200).json({
            success: true,
            data: jobProfile,
            message: 'Job profile updated successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.delete('/:id', validation_1.validateObjectId, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID parameter is required'
            });
        }
        const deleted = await jobProfileService_1.jobProfileService.deleteJobProfile(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Job profile not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Job profile deleted successfully'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
router.get('/:id/exists', validation_1.validateObjectId, async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'ID parameter is required'
            });
        }
        const exists = await jobProfileService_1.jobProfileService.jobProfileExists(id);
        res.status(200).json({
            success: true,
            data: { exists },
            message: exists ? 'Job profile exists' : 'Job profile does not exist'
        });
    }
    catch (error) {
        handleRouteError(error, res);
    }
});
function handleRouteError(error, res) {
    console.error('Job Profile Route Error:', error);
    if (error instanceof database_1.DatabaseError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message,
            code: error.code
        });
    }
    else if (error.name === 'ValidationError') {
        res.status(400).json({
            success: false,
            message: 'Validation error',
            details: error.message
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
//# sourceMappingURL=jobProfileRoutes.js.map