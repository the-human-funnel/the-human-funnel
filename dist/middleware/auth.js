"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.getAllUsers = exports.createUser = exports.login = exports.authorize = exports.authenticate = exports.verifyToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const users = new Map();
const initializeDefaultUser = async () => {
    const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    if (!users.has(defaultUsername)) {
        const passwordHash = await bcryptjs_1.default.hash(defaultPassword, 10);
        const defaultUser = {
            id: 'default-admin',
            username: defaultUsername,
            passwordHash,
            role: 'admin',
            createdAt: new Date()
        };
        users.set(defaultUsername, defaultUser);
        logger_1.logger.info('Default admin user created', { username: defaultUsername });
    }
};
initializeDefaultUser();
const generateToken = (user) => {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role
    };
    return jsonwebtoken_1.default.sign(payload, config_1.config.auth.jwtSecret, {
        expiresIn: config_1.config.auth.jwtExpiration
    });
};
exports.generateToken = generateToken;
const verifyToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, config_1.config.auth.jwtSecret);
    }
    catch (error) {
        throw new Error('Invalid token');
    }
};
exports.verifyToken = verifyToken;
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }
        const token = authHeader.substring(7);
        const decoded = (0, exports.verifyToken)(token);
        req.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role
        };
        logger_1.logger.info('User authenticated', {
            userId: req.user.id,
            username: req.user.username,
            endpoint: req.path
        });
        next();
    }
    catch (error) {
        logger_1.logger.warn('Authentication failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};
exports.authenticate = authenticate;
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        if (!allowedRoles.includes(req.user.role)) {
            logger_1.logger.warn('Authorization failed', {
                userId: req.user.id,
                userRole: req.user.role,
                requiredRoles: allowedRoles,
                endpoint: req.path
            });
            return res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
        }
        next();
    };
};
exports.authorize = authorize;
const login = async (username, password) => {
    const user = users.get(username);
    if (!user) {
        logger_1.logger.warn('Login attempt with invalid username', { username });
        return null;
    }
    const isValidPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!isValidPassword) {
        logger_1.logger.warn('Login attempt with invalid password', { username });
        return null;
    }
    user.lastLogin = new Date();
    users.set(username, user);
    const token = (0, exports.generateToken)(user);
    logger_1.logger.info('User logged in successfully', {
        userId: user.id,
        username: user.username
    });
    return { user, token };
};
exports.login = login;
const createUser = async (userData) => {
    if (users.has(userData.username)) {
        throw new Error('Username already exists');
    }
    const passwordHash = await bcryptjs_1.default.hash(userData.password, 10);
    const newUser = {
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        username: userData.username,
        passwordHash,
        role: userData.role,
        createdAt: new Date()
    };
    users.set(userData.username, newUser);
    logger_1.logger.info('New user created', {
        userId: newUser.id,
        username: newUser.username,
        role: newUser.role
    });
    return newUser;
};
exports.createUser = createUser;
const getAllUsers = () => {
    return Array.from(users.values()).map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
    }));
};
exports.getAllUsers = getAllUsers;
const deleteUser = (username) => {
    if (username === 'admin') {
        throw new Error('Cannot delete default admin user');
    }
    const deleted = users.delete(username);
    if (deleted) {
        logger_1.logger.info('User deleted', { username });
    }
    return deleted;
};
exports.deleteUser = deleteUser;
//# sourceMappingURL=auth.js.map