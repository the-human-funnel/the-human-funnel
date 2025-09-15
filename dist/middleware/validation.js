"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePaginationQuery = exports.validateObjectIdParam = exports.validateCreateUser = exports.validateLogin = exports.handleValidationErrors = exports.sanitizeInput = exports.sanitizeObject = exports.sanitizeString = void 0;
exports.validateCreateJobProfile = validateCreateJobProfile;
exports.validateUpdateJobProfile = validateUpdateJobProfile;
exports.validateObjectId = validateObjectId;
exports.validateCandidateSearch = validateCandidateSearch;
exports.validateExportParams = validateExportParams;
const express_validator_1 = require("express-validator");
const logger_1 = require("../utils/logger");
const sanitizeString = (str) => {
    if (typeof str !== 'string')
        return '';
    const withoutHtml = str.replace(/<[^>]*>/g, '');
    const sanitized = withoutHtml
        .replace(/[<>'"&]/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    return sanitized;
};
exports.sanitizeString = sanitizeString;
const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
        return (0, exports.sanitizeString)(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(exports.sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[(0, exports.sanitizeString)(key)] = (0, exports.sanitizeObject)(value);
        }
        return sanitized;
    }
    return obj;
};
exports.sanitizeObject = sanitizeObject;
const sanitizeInput = (req, res, next) => {
    try {
        if (req.body && typeof req.body === 'object') {
            req.body = (0, exports.sanitizeObject)(req.body);
        }
        if (req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0) {
            try {
                const sanitizedQuery = (0, exports.sanitizeObject)(req.query);
                const descriptor = Object.getOwnPropertyDescriptor(req, 'query');
                if (descriptor && descriptor.writable !== false) {
                    req.query = sanitizedQuery;
                }
            }
            catch (queryError) {
                logger_1.logger.debug('Query sanitization skipped (read-only)', {
                    method: req.method,
                    path: req.path
                });
            }
        }
        logger_1.logger.debug('Input sanitized', {
            method: req.method,
            path: req.path,
            userId: req.user?.id,
            ip: req.ip
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('Input sanitization failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            method: req.method,
            path: req.path,
            ip: req.ip
        });
        res.status(400).json({
            success: false,
            message: 'Invalid input format'
        });
    }
};
exports.sanitizeInput = sanitizeInput;
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        logger_1.logger.warn('Validation failed', {
            errors: errors.array(),
            method: req.method,
            path: req.path,
            userId: req.user?.id,
            ip: req.ip
        });
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
exports.validateLogin = [
    (0, express_validator_1.body)('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6, max: 100 })
        .withMessage('Password must be between 6 and 100 characters'),
    exports.handleValidationErrors
];
exports.validateCreateUser = [
    (0, express_validator_1.body)('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8, max: 100 })
        .withMessage('Password must be between 8 and 100 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    (0, express_validator_1.body)('role')
        .isIn(['admin', 'recruiter', 'viewer'])
        .withMessage('Role must be admin, recruiter, or viewer'),
    exports.handleValidationErrors
];
exports.validateObjectIdParam = [
    (0, express_validator_1.param)('id')
        .matches(/^[0-9a-fA-F]{24}$/)
        .withMessage('Invalid ID format'),
    exports.handleValidationErrors
];
exports.validatePaginationQuery = [
    (0, express_validator_1.query)('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    (0, express_validator_1.query)('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000'),
    exports.handleValidationErrors
];
function validateCreateJobProfile(req, res, next) {
    const { title, description, requiredSkills, experienceLevel, scoringWeights, interviewQuestions } = req.body;
    const errors = [];
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        errors.push('Title is required and must be a non-empty string');
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        errors.push('Description is required and must be a non-empty string');
    }
    if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
        errors.push('Required skills must be a non-empty array');
    }
    else {
        requiredSkills.forEach((skill, index) => {
            if (typeof skill !== 'string' || skill.trim().length === 0) {
                errors.push(`Required skill at index ${index} must be a non-empty string`);
            }
        });
    }
    if (!experienceLevel || typeof experienceLevel !== 'string' || experienceLevel.trim().length === 0) {
        errors.push('Experience level is required and must be a non-empty string');
    }
    if (!scoringWeights || typeof scoringWeights !== 'object') {
        errors.push('Scoring weights are required and must be an object');
    }
    else {
        const requiredWeights = ['resumeAnalysis', 'linkedInAnalysis', 'githubAnalysis', 'interviewPerformance'];
        requiredWeights.forEach(weight => {
            if (typeof scoringWeights[weight] !== 'number' || scoringWeights[weight] < 0 || scoringWeights[weight] > 100) {
                errors.push(`${weight} must be a number between 0 and 100`);
            }
        });
        const total = requiredWeights.reduce((sum, weight) => sum + (scoringWeights[weight] || 0), 0);
        if (Math.abs(total - 100) > 0.01) {
            errors.push(`Scoring weights must sum to 100%. Current total: ${total}%`);
        }
    }
    if (!Array.isArray(interviewQuestions) || interviewQuestions.length === 0) {
        errors.push('Interview questions must be a non-empty array');
    }
    else {
        interviewQuestions.forEach((question, index) => {
            if (typeof question !== 'string' || question.trim().length === 0) {
                errors.push(`Interview question at index ${index} must be a non-empty string`);
            }
        });
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }
    next();
}
function validateUpdateJobProfile(req, res, next) {
    const { title, description, requiredSkills, experienceLevel, scoringWeights, interviewQuestions } = req.body;
    const errors = [];
    if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
        errors.push('Title must be a non-empty string if provided');
    }
    if (description !== undefined && (typeof description !== 'string' || description.trim().length === 0)) {
        errors.push('Description must be a non-empty string if provided');
    }
    if (requiredSkills !== undefined) {
        if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) {
            errors.push('Required skills must be a non-empty array if provided');
        }
        else {
            requiredSkills.forEach((skill, index) => {
                if (typeof skill !== 'string' || skill.trim().length === 0) {
                    errors.push(`Required skill at index ${index} must be a non-empty string`);
                }
            });
        }
    }
    if (experienceLevel !== undefined && (typeof experienceLevel !== 'string' || experienceLevel.trim().length === 0)) {
        errors.push('Experience level must be a non-empty string if provided');
    }
    if (scoringWeights !== undefined) {
        if (typeof scoringWeights !== 'object') {
            errors.push('Scoring weights must be an object if provided');
        }
        else {
            const requiredWeights = ['resumeAnalysis', 'linkedInAnalysis', 'githubAnalysis', 'interviewPerformance'];
            requiredWeights.forEach(weight => {
                if (scoringWeights[weight] !== undefined &&
                    (typeof scoringWeights[weight] !== 'number' || scoringWeights[weight] < 0 || scoringWeights[weight] > 100)) {
                    errors.push(`${weight} must be a number between 0 and 100 if provided`);
                }
            });
            const providedWeights = requiredWeights.filter(weight => scoringWeights[weight] !== undefined);
            if (providedWeights.length === requiredWeights.length) {
                const total = requiredWeights.reduce((sum, weight) => sum + (scoringWeights[weight] || 0), 0);
                if (Math.abs(total - 100) > 0.01) {
                    errors.push(`Scoring weights must sum to 100% when all weights are provided. Current total: ${total}%`);
                }
            }
        }
    }
    if (interviewQuestions !== undefined) {
        if (!Array.isArray(interviewQuestions) || interviewQuestions.length === 0) {
            errors.push('Interview questions must be a non-empty array if provided');
        }
        else {
            interviewQuestions.forEach((question, index) => {
                if (typeof question !== 'string' || question.trim().length === 0) {
                    errors.push(`Interview question at index ${index} must be a non-empty string`);
                }
            });
        }
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }
    next();
}
function validateObjectId(req, res, next) {
    const { id, candidateId, jobProfileId, batchId } = req.params;
    const idToValidate = id || candidateId || jobProfileId || batchId;
    if (!idToValidate || typeof idToValidate !== 'string' || idToValidate.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format'
        });
    }
    if (!/^[0-9a-fA-F]{24}$/.test(idToValidate)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format'
        });
    }
    next();
}
function validateCandidateSearch(req, res, next) {
    const errors = [];
    if (req.query.page && (!Number.isInteger(Number(req.query.page)) || Number(req.query.page) < 1)) {
        errors.push('Page must be a positive integer');
    }
    if (req.query.limit) {
        const limit = Number(req.query.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
            errors.push('Limit must be an integer between 1 and 1000');
        }
    }
    if (req.query.minScore) {
        const minScore = Number(req.query.minScore);
        if (isNaN(minScore) || minScore < 0 || minScore > 100) {
            errors.push('minScore must be a number between 0 and 100');
        }
    }
    if (req.query.maxScore) {
        const maxScore = Number(req.query.maxScore);
        if (isNaN(maxScore) || maxScore < 0 || maxScore > 100) {
            errors.push('maxScore must be a number between 0 and 100');
        }
    }
    if (req.query.minScore && req.query.maxScore) {
        const minScore = Number(req.query.minScore);
        const maxScore = Number(req.query.maxScore);
        if (minScore > maxScore) {
            errors.push('minScore cannot be greater than maxScore');
        }
    }
    if (req.query.recommendation) {
        const validRecommendations = ['strong-hire', 'hire', 'maybe', 'no-hire'];
        if (!validRecommendations.includes(req.query.recommendation)) {
            errors.push('recommendation must be one of: strong-hire, hire, maybe, no-hire');
        }
    }
    if (req.query.processingStage) {
        const validStages = ['resume', 'ai-analysis', 'linkedin', 'github', 'interview', 'scoring', 'completed'];
        if (!validStages.includes(req.query.processingStage)) {
            errors.push('processingStage must be one of: resume, ai-analysis, linkedin, github, interview, scoring, completed');
        }
    }
    if (req.query.sortBy) {
        const validSortFields = ['score', 'createdAt', 'name'];
        if (!validSortFields.includes(req.query.sortBy)) {
            errors.push('sortBy must be one of: score, createdAt, name');
        }
    }
    if (req.query.sortOrder) {
        const validSortOrders = ['asc', 'desc'];
        if (!validSortOrders.includes(req.query.sortOrder)) {
            errors.push('sortOrder must be either asc or desc');
        }
    }
    if (req.query.createdAfter) {
        const date = new Date(req.query.createdAfter);
        if (isNaN(date.getTime())) {
            errors.push('createdAfter must be a valid date');
        }
    }
    if (req.query.createdBefore) {
        const date = new Date(req.query.createdBefore);
        if (isNaN(date.getTime())) {
            errors.push('createdBefore must be a valid date');
        }
    }
    if (req.query.hasLinkedIn && !['true', 'false'].includes(req.query.hasLinkedIn)) {
        errors.push('hasLinkedIn must be true or false');
    }
    if (req.query.hasGitHub && !['true', 'false'].includes(req.query.hasGitHub)) {
        errors.push('hasGitHub must be true or false');
    }
    if (req.query.interviewCompleted && !['true', 'false'].includes(req.query.interviewCompleted)) {
        errors.push('interviewCompleted must be true or false');
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }
    next();
}
function validateExportParams(req, res, next) {
    const errors = [];
    if (req.query.format && !['csv', 'json'].includes(req.query.format)) {
        errors.push('format must be either csv or json');
    }
    if (req.query.includeDetails && !['true', 'false'].includes(req.query.includeDetails)) {
        errors.push('includeDetails must be true or false');
    }
    if (req.query.fields) {
        const fields = req.query.fields.split(',');
        const validFields = [
            'id', 'resumeData.fileName', 'resumeData.contactInfo.email', 'resumeData.contactInfo.phone',
            'resumeData.contactInfo.linkedInUrl', 'resumeData.contactInfo.githubUrl', 'processingStage',
            'finalScore.compositeScore', 'finalScore.recommendation', 'createdAt', 'finalScore.stageScores.resumeAnalysis',
            'finalScore.stageScores.linkedInAnalysis', 'finalScore.stageScores.githubAnalysis',
            'finalScore.stageScores.interviewPerformance', 'aiAnalysis.reasoning'
        ];
        const invalidFields = fields.filter(field => !validFields.includes(field.trim()));
        if (invalidFields.length > 0) {
            errors.push(`Invalid fields: ${invalidFields.join(', ')}`);
        }
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors
        });
    }
    next();
}
//# sourceMappingURL=validation.js.map