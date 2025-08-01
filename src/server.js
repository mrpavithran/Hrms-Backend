// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const { config } = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const logger = require('./utils/logger.js');
const { requestLogger } = require('./utils/logger.js');
const errorHandler = require('./middleware/errorHandler.js');
const { auditMiddleware } = require('./middleware/auditMiddleware.js');
const { authenticate } = require('./middleware/auth.js');

// Import route files
const authRoutes = require('./routes/authRoutes.js');
const employeeRoutes = require('./routes/employeeRoutes.js');
const departmentRoutes = require('./routes/departmentRoutes.js');
const attendanceRoutes = require('./routes/attendanceRoutes.js');
const leaveRoutes = require('./routes/leaveRequestRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const positionRoutes = require('./routes/positionRoutes.js');
const payrollRoutes = require('./routes/payrollRecordRoutes.js');
const documentRoutes = require('./routes/documentRoutes.js');
const auditLogRoutes = require('./routes/auditLogRoutes.js');

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
app.use('/api/users', authenticate, userRoutes);
app.use('/api/positions', authenticate, positionRoutes);
app.use('/api/payroll', authenticate, payrollRoutes);
app.use('/api/documents', authenticate, documentRoutes);
app.use('/api/audit-logs', authenticate, auditLogRoutes);

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
module.exports = { app, server };