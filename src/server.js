// server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import logger, { requestLogger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { auditMiddleware } from './middleware/auditMiddleware.js';
import { authenticate } from './middleware/auth.js';

// Import route files
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRequestRoutes.js';
import userRoutes from './routes/userRoutes.js';

// Load environment variables
config();

// Validate environment variables
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Initialize Express and Prisma
const app = express();
const prisma = new PrismaClient({
  errorFormat: 'pretty',
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
  ],
});

// Log Prisma queries in development
if (getEnvVariable('NODE_ENV', 'development') !== 'production') {
  prisma.$on('query', (e) => {
    logger.debug(`Prisma Query: ${e.query} ${e.params} [${e.duration}ms]`);
  });
}

// === CORS Configuration ===
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      getEnvVariable('FRONTEND_URL', 'http://localhost:5173'),
      // Add other allowed origins if needed
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400,
};

// === Security Middleware ===
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
}));
app.use(cors(corsOptions));

// === Rate Limiting and Throttling ===
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(getEnvVariable('RATE_LIMIT_MAX', '100')),
  message: { status: 'error', message: 'Too many requests. Please try again later.' },
});
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: parseInt(getEnvVariable('SPEED_LIMIT_AFTER', '50')),
  delayMs: () => parseInt(getEnvVariable('SPEED_LIMIT_DELAY', '500')),
});

// Apply rate limiting only to protected routes
app.use('/api/auth', limiter, speedLimiter);
app.use('/api/employees', limiter, speedLimiter);
app.use('/api/departments', limiter, speedLimiter);
app.use('/api/attendance', limiter, speedLimiter);
app.use('/api/leave', limiter, speedLimiter);
app.use('/api/reports', limiter, speedLimiter);
app.use('/api/users', limiter, speedLimiter);

// === Body Parsing and Logging ===
app.use(express.json({ limit: getEnvVariable('BODY_LIMIT', '10mb') }));
app.use(express.urlencoded({ extended: true, limit: getEnvVariable('BODY_LIMIT', '10mb') }));
app.use(requestLogger); // From logger.js
app.use(auditMiddleware);

// === API Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/employees', authenticate, employeeRoutes);
app.use('/api/departments', authenticate, departmentRoutes);
app.use('/api/attendance', authenticate, attendanceRoutes);
app.use('/api/leave', authenticate, leaveRoutes);
app.use('/api/reports', authenticate, reportRoutes);
app.use('/api/users', authenticate, userRoutes);

// === Health Check ===
app.get('/api/health', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'OK',
      database: 'Connected',
      timestamp: new Date().toISOString(),
      environment: getEnvVariable('NODE_ENV', 'development'),
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'Service Unavailable',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

// === 404 Handler ===
app.use('/api/*', (req, res) => {
  req.logger.error('Route not found', { path: req.originalUrl });
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// === Global Error Handler ===
app.use(errorHandler);

// === Graceful Shutdown ===
const shutdown = async () => {
  logger.info('Shutting down server...');
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting database', { error: error.message });
  }
  server.close(() => {
    logger.info('Server stopped');
    process.exit(0);
  });
};

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  shutdown();
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: reason instanceof Error ? reason.message : reason });
  shutdown();
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const PORT = parseInt(getEnvVariable('PORT', '3000'));
const server = app.listen(PORT, () => {
  logger.info(`🚀 Backend running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`Frontend URL allowed: ${corsOptions.origin}`);
});

// Export for testing
export { app, server };
export default { app, server };