// routes/authRoutes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { validate, authSchemas } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { generateTokens, verifyRefreshToken, generatePasswordResetToken } from '../utils/authUtils.js';
import { AppError, AuthenticationError, ValidationError } from '../utils/errors.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import logger from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient({
  errorFormat: 'pretty',
});

// Validate environment variables
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Register
router.post('/register', validate(authSchemas.register), async (req, res, next) => {
  try {
    if (!req.validatedData?.body) {
      throw new ValidationError('Validation data missing', null, 'VALIDATION_FAILED');
    }
    const { email, password, role = 'EMPLOYEE' } = req.validatedData.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ValidationError('User already exists with this email', null, 'USER_EXISTS');
    }

    // Hash password
    const saltRounds = parseInt(getEnvVariable('BCRYPT_ROUNDS', '12'));
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user and refresh token in a transaction
    const [user, refreshTokenRecord] = await prisma.$transaction([
      prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
        },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.refreshToken.create({
        data: {
          token: '', // Placeholder, updated below
          userId: '', // Placeholder, updated below
          expiresAt: new Date(Date.now() + parseInt(getEnvVariable('REFRESH_TOKEN_EXPIRES_MS', '604800000'))), // 7 days
        },
      }),
    ]);

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({ userId: user.id, role: user.role });

    // Update refresh token record
    await prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { token: refreshToken, userId: user.id },
    });

    // Log audit
    await createAuditLog(user.id, 'CREATE', 'users', user.id, null, user, req);

    req.logger.info('User registered', { userId: user.id, email });
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: { user, accessToken, refreshToken },
    });
  } catch (error) {
    req.logger.error('Registration error', { error: error.message, email: req.validatedData?.body?.email });
    next(error);
  }
});

// Login
router.post('/login', validate(authSchemas.login), async (req, res, next) => {
  try {
    if (!req.validatedData?.body) {
      throw new ValidationError('Validation data missing', null, 'VALIDATION_FAILED');
    }
    const { email, password } = req.validatedData.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { employee: { include: { department: true, position: true } } },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid credentials', null, 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials', null, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({ userId: user.id, role: user.role });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + parseInt(getEnvVariable('REFRESH_TOKEN_EXPIRES_MS', '604800000'))),
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log audit
    await createAuditLog(user.id, 'LOGIN', 'users', user.id, null, null, req);

    // Remove password
    const { password: _, ...userWithoutPassword } = user;

    req.logger.info('User logged in', { userId: user.id, email });
    res.json({
      status: 'success',
      message: 'Login successful',
      data: { user: userWithoutPassword, accessToken, refreshToken },
    });
  } catch (error) {
    req.logger.error('Login error', { error: error.message, email: req.validatedData?.body?.email });
    next(error);
  }
});

// Refresh Token
router.post('/refresh', validate(authSchemas.refreshToken), async (req, res, next) => {
  try {
    if (!req.validatedData?.body) {
      throw new ValidationError('Validation data missing', null, 'VALIDATION_FAILED');
    }
    const { refreshToken } = req.validatedData.body;

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new AuthenticationError('Invalid or expired refresh token', null, 'INVALID_REFRESH_TOKEN');
    }

    // Generate new tokens
    const { accessToken, newRefreshToken } = generateTokens({ userId: storedToken.userId, role: storedToken.user.role });

    // Update refresh token in transaction
    await prisma.$transaction([
      prisma.refreshToken.delete({ where: { token: refreshToken } }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: storedToken.userId,
          expiresAt: new Date(Date.now() + parseInt(getEnvVariable('REFRESH_TOKEN_EXPIRES_MS', '604800000'))),
        },
      }),
    ]);

    req.logger.info('Token refreshed', { userId: storedToken.userId });
    res.json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    req.logger.error('Token refresh error', { error: error.message });
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user.id },
    });

    await createAuditLog(req.user.id, 'LOGOUT', 'users', req.user.id, null, null, req);

    req.logger.info('User logged out', { userId: req.user.id });
    res.json({
      status: 'success',
      message: 'Logout successful',
    });
  } catch (error) {
    req.logger.error('Logout error', { error: error.message, userId: req.user.id });
    next(error);
  }
});

// Request Password Reset
router.post('/reset-password', validate(authSchemas.resetPassword), async (req, res, next) => {
  try {
    if (!req.validatedData?.body) {
      throw new ValidationError('Validation data missing', null, 'VALIDATION_FAILED');
    }
    const { email } = req.validatedData.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      req.logger.info('Password reset requested for non-existent email', { email });
      return res.json({
        status: 'success',
        message: 'If the email exists, a reset link has been sent',
      });
    }

    const { token, expiresAt } = generatePasswordResetToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: new Date(expiresAt),
      },
    });

    // TODO: Implement email sending (e.g., using nodemailer)
    req.logger.info('Password reset token generated', { userId: user.id, email });

    res.json({
      status: 'success',
      message: 'If the email exists, a reset link has been sent',
    });
  } catch (error) {
    req.logger.error('Password reset request error', { error: error.message, email: req.validatedData?.body?.email });
    next(error);
  }
});

// Update Password
router.post('/update-password', validate(authSchemas.updatePassword), async (req, res, next) => {
  try {
    if (!req.validatedData?.body) {
      throw new ValidationError('Validation data missing', null, 'VALIDATION_FAILED');
    }
    const { token, newPassword } = req.validatedData.body;

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new AuthenticationError('Invalid or expired reset token', null, 'INVALID_RESET_TOKEN');
    }

    const saltRounds = parseInt(getEnvVariable('BCRYPT_ROUNDS', '12'));
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      }),
      prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    ]);

    await createAuditLog(user.id, 'PASSWORD_CHANGE', 'users', user.id, null, null, req);

    req.logger.info('Password updated', { userId: user.id });
    res.json({
      status: 'success',
      message: 'Password updated successfully',
    });
  } catch (error) {
    req.logger.error('Password update error', { error: error.message });
    next(error);
  }
});

// Get Current User Profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        employee: {
          include: {
            department: true,
            position: true,
            manager: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        employee: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('User not found', null, 'USER_NOT_FOUND');
    }

    req.logger.info('User profile retrieved', { userId: req.user.id });
    res.json({
      status: 'success',
      message: 'User profile retrieved successfully',
      data: { user },
    });
  } catch (error) {
    req.logger.error('Profile retrieval error', { error: error.message, userId: req.user.id });
    next(error);
  }
});

// Export for both ES Modules and CommonJS
export default router;
module.exports = router;