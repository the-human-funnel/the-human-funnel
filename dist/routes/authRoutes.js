"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rateLimiting_1 = require("../middleware/rateLimiting");
const auditLog_1 = require("../middleware/auditLog");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.post('/login', rateLimiting_1.authRateLimit, validation_1.sanitizeInput, validation_1.validateLogin, async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await (0, auth_1.login)(username, password);
        if (!result) {
            (0, auditLog_1.logSecurityEvent)('LOGIN_FAILURE', req, { username });
            return res.status(401).json({
                success: false,
                message: 'Invalid username or password'
            });
        }
        (0, auditLog_1.logSecurityEvent)('LOGIN_SUCCESS', req, {
            userId: result.user.id,
            username: result.user.username
        });
        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                token: result.token,
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    role: result.user.role,
                    lastLogin: result.user.lastLogin
                }
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Login error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            username: req.body.username,
            ip: req.ip
        });
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});
router.post('/users', auth_1.authenticate, (0, auth_1.authorize)(['admin']), validation_1.sanitizeInput, validation_1.validateCreateUser, async (req, res) => {
    try {
        const { username, password, role } = req.body;
        const newUser = await (0, auth_1.createUser)({ username, password, role });
        return res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    role: newUser.role,
                    createdAt: newUser.createdAt
                }
            }
        });
    }
    catch (error) {
        logger_1.logger.error('User creation error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestedUsername: req.body.username,
            createdBy: req.user?.username
        });
        if (error instanceof Error && error.message === 'Username already exists') {
            return res.status(409).json({
                success: false,
                message: 'Username already exists'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to create user'
        });
    }
});
router.get('/users', auth_1.authenticate, (0, auth_1.authorize)(['admin']), (req, res) => {
    try {
        const users = (0, auth_1.getAllUsers)();
        res.json({
            success: true,
            data: {
                users,
                total: users.length
            }
        });
    }
    catch (error) {
        logger_1.logger.error('Get users error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            requestedBy: req.user?.username
        });
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve users'
        });
    }
});
router.delete('/users/:username', auth_1.authenticate, (0, auth_1.authorize)(['admin']), validation_1.sanitizeInput, async (req, res) => {
    try {
        const { username } = req.params;
        if (!username) {
            return res.status(400).json({
                success: false,
                message: 'Username is required'
            });
        }
        const deleted = (0, auth_1.deleteUser)(username);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        return res.json({
            success: true,
            message: 'User deleted successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('User deletion error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            targetUsername: req.params.username,
            deletedBy: req.user?.username
        });
        if (error instanceof Error && error.message === 'Cannot delete default admin user') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete default admin user'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to delete user'
        });
    }
});
router.get('/me', auth_1.authenticate, (req, res) => {
    res.json({
        success: true,
        data: {
            user: req.user
        }
    });
});
router.post('/logout', auth_1.authenticate, (req, res) => {
    logger_1.logger.info('User logged out', {
        userId: req.user?.id,
        username: req.user?.username
    });
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map