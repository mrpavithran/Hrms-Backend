// src/middleware/auth.js
import { PrismaClient } from '@prisma/client';
import { AuthenticationError, AuthorizationError, ValidationError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/authUtils.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient({
  errorFormat: 'pretty',
});

// Get environment variable with logging
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Authentication middleware
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token required', null, 'TOKEN_REQUIRED');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        employee: {
          select: {
            id: true,
            departmentId: true,
            positionId: true,
            managerId: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive', null, 'USER_NOT_FOUND');
    }

    req.user = { ...user, role: decoded.role };
    req.logger.info('User authenticated', { userId: user.id, role: user.role, url: req.originalUrl });
    next();
  } catch (error) {
    req.logger.error('Authentication error', { error: error.message, url: req.originalUrl });
    next(error);
  }
};

// Role-based authorization middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      req.logger.error('Authentication required', { url: req.originalUrl });
      return next(new AuthenticationError('Authentication required', null, 'AUTH_REQUIRED'));
    }

    if (!roles.includes(req.user.role)) {
      req.logger.error('Insufficient permissions', { userId: req.user.id, role: req.user.role, url: req.originalUrl });
      return next(new AuthorizationError('Insufficient permissions', null, 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
};

// Employee-specific authorization middleware
export const authorizeEmployee = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.params.id;
    if (!employeeId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(employeeId)) {
      throw new ValidationError('Invalid employee ID', null, 'INVALID_ID');
    }

    if (!req.user) {
      throw new AuthenticationError('Authentication required', null, 'AUTH_REQUIRED');
    }

    if (['ADMIN', 'HR'].includes(req.user.role)) {
      return next();
    }

    if (req.user.role === 'MANAGER' && req.user.employee) {
      const subordinates = await prisma.employee.findMany({
        where: { managerId: req.user.employee.id },
        select: { id: true },
      });
      const subordinateIds = subordinates.map((sub) => sub.id);
      if (subordinateIds.includes(employeeId)) {
        return next();
      }
    }

    if (req.user.employee && req.user.employee.id === employeeId) {
      return next();
    }

    req.logger.error('Employee access denied', { userId: req.user.id, role: req.user.role, employeeId, url: req.originalUrl });
    return next(new AuthorizationError('Access denied', null, 'ACCESS_DENIED'));
  } catch (error) {
    req.logger.error('Employee authorization error', { error: error.message, url: req.originalUrl });
    next(error);
  }
};

// Export for ES Modules
export default {
  authenticate,
  authorize,
  authorizeEmployee,
};