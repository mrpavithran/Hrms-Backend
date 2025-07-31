// src/routes/attendanceRoutes.js
import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validation.js';
import { authenticate, authorize, authorizeEmployee } from '../middleware/auth.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { ValidationError, AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Validation schemas
const attendanceSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    date: z.string().datetime('Invalid ISO 8601 date format'),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME']),
  }),
});

const listSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
    limit: z.string().optional().transform((val) => (val ? Math.min(parseInt(val), 100) : 10)),
    employeeId: z.string().uuid('Invalid employee ID').optional(),
    date: z.string().datetime('Invalid ISO 8601 date format').optional(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME']).optional(),
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid attendance ID'),
  }),
});

// GET / - List attendance records
router.get(
  '/',
  authenticate,
  authorize(['ADMIN', 'HR', 'MANAGER']),
  validate(listSchema),
  async (req, res, next) => {
    try {
      const { page, limit, employeeId, date, status } = req.validatedData.query;
      const filters = {};
      if (employeeId) filters.employeeId = employeeId;
      if (date) filters.date = { gte: new Date(date), lte: new Date(date) };
      if (status) filters.status = status;

      const [records, total] = await Promise.all([
        prisma.attendance.findMany({
          where: filters,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { date: 'desc' },
          include: { employee: { select: { firstName: true, lastName: true } } },
        }),
        prisma.attendance.count({ where: filters }),
      ]);

      await createAuditLog(req.user.id, 'READ', 'attendance', null, null, null, req);
      res.json({
        status: 'success',
        data: { records, total, page: Number(page), limit: Number(limit) },
      });
    } catch (error) {
      req.logger.error('Error listing attendance records', { error: error.message });
      next(new AppError('Server error', 500, null, 'SERVER_ERROR'));
    }
  }
);

// GET /:id - Get single attendance record
router.get(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  authorizeEmployee,
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const record = await prisma.attendance.findUnique({
        where: { id },
        include: { employee: { select: { firstName: true, lastName: true } } },
      });

      if (!record) {
        throw new AppError('Record not found', 404, null, 'NOT_FOUND');
      }

      await createAuditLog(req.user.id, 'READ', 'attendance', id, null, null, req);
      res.json({ status: 'success', data: record });
    } catch (error) {
      req.logger.error('Error fetching attendance record', { error: error.message, id: req.params.id });
      next(error);
    }
  }
);

// POST / - Create attendance record
router.post(
  '/',
  authenticate,
  authorize(['ADMIN', 'HR']),
  validate(attendanceSchema),
  async (req, res, next) => {
    try {
      const { employeeId, date, status } = req.validatedData.body;

      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) {
        throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
      }

      const newRecord = await prisma.attendance.create({
        data: {
          employeeId,
          date: new Date(date),
          status,
        },
      });

      await createAuditLog(req.user.id, 'CREATE', 'attendance', newRecord.id, null, newRecord, req);
      res.status(201).json({ status: 'success', data: newRecord });
    } catch (error) {
      req.logger.error('Error creating attendance record', { error: error.message });
      next(error);
    }
  }
);

// PUT /:id - Update attendance record
router.put(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'HR']),
  validate(idSchema.merge(attendanceSchema)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const { employeeId, date, status } = req.validatedData.body;

      const existingRecord = await prisma.attendance.findUnique({ where: { id } });
      if (!existingRecord) {
        throw new AppError('Record not found', 404, null, 'NOT_FOUND');
      }

      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) {
        throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
      }

      const updatedRecord = await prisma.attendance.update({
        where: { id },
        data: {
          employeeId,
          date: new Date(date),
          status,
        },
      });

      await createAuditLog(req.user.id, 'UPDATE', 'attendance', id, existingRecord, updatedRecord, req);
      res.json({ status: 'success', data: updatedRecord });
    } catch (error) {
      req.logger.error('Error updating attendance record', { error: error.message, id: req.params.id });
      next(error);
    }
  }
);

// DELETE /:id - Delete attendance record
router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN', 'HR']),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const existingRecord = await prisma.attendance.findUnique({ where: { id } });
      if (!existingRecord) {
        throw new AppError('Record not found', 404, null, 'NOT_FOUND');
      }

      await prisma.attendance.delete({ where: { id } });
      await createAuditLog(req.user.id, 'DELETE', 'attendance', id, existingRecord, null, req);
      res.json({ status: 'success', message: 'Attendance record deleted' });
    } catch (error) {
      req.logger.error('Error deleting attendance record', { error: error.message, id: req.params.id });
      next(error);
    }
  }
);

export default router;