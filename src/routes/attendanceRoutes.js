// src/routes/attendanceRoutes.js
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validation.js');
const { authenticate, authorize, authorizeEmployee } = require('../middleware/auth.js');
const { createAuditLog } = require('../middleware/auditMiddleware.js');
const { ValidationError, AppError } = require('../utils/errors.js');
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger.js');

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const attendanceSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    date: z.string().datetime('Invalid ISO 8601 date format'),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME']),
    checkIn: z.string().datetime().optional(),
    checkOut: z.string().datetime().optional(),
    notes: z.string().optional(),
  }),
});

const listSchema = z.object({
  query: z.object({
    page: z.string().optional().transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
    limit: z.string().optional().transform((val) => (val ? Math.min(parseInt(val), 100) : 10)),
    employeeId: z.string().uuid('Invalid employee ID').optional(),
    date: z.string().datetime('Invalid ISO 8601 date format').optional(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
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
  authorize('ADMIN', 'HR', 'MANAGER'),
  validate(listSchema),
  async (req, res, next) => {
    try {
      const { page, limit, employeeId, date, status, startDate, endDate } = req.validatedData.query;
      const skip = (page - 1) * limit;
      
      const filters = {};
      if (employeeId) filters.employeeId = employeeId;
      if (status) filters.status = status;
      
      // Date filtering
      if (date) {
        const targetDate = new Date(date);
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
        filters.date = { gte: startOfDay, lte: endOfDay };
      } else if (startDate || endDate) {
        filters.date = {};
        if (startDate) filters.date.gte = new Date(startDate);
        if (endDate) filters.date.lte = new Date(endDate);
      }

      const [records, total] = await Promise.all([
        prisma.attendance.findMany({
          where: filters,
          skip,
          take: limit,
          orderBy: { date: 'desc' },
          include: { 
            employee: { 
              select: { 
                id: true,
                employeeId: true,
                firstName: true, 
                lastName: true,
                department: {
                  select: { id: true, name: true }
                }
              } 
            } 
          },
        }),
        prisma.attendance.count({ where: filters }),
      ]);

      await createAuditLog(req.user.id, 'READ', 'attendance', null, null, null, req);
      
      res.json({
        success: true,
        data: { 
          records, 
          pagination: {
            page: Number(page), 
            limit: Number(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        },
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
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const record = await prisma.attendance.findUnique({
        where: { id },
        include: { 
          employee: { 
            select: { 
              id: true,
              employeeId: true,
              firstName: true, 
              lastName: true,
              department: {
                select: { id: true, name: true }
              }
            } 
          } 
        },
      });

      if (!record) {
        throw new AppError('Record not found', 404, null, 'NOT_FOUND');
      }

      // Check if employee can access this record
      if (req.user.role === 'EMPLOYEE' && req.user.employee?.id !== record.employeeId) {
        throw new AppError('Access denied', 403, null, 'ACCESS_DENIED');
      }

      await createAuditLog(req.user.id, 'READ', 'attendance', id, null, null, req);
      
      res.json({ 
        success: true, 
        data: { record } 
      });
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
  authorize('ADMIN', 'HR'),
  validate(attendanceSchema),
  async (req, res, next) => {
    try {
      const { employeeId, date, status, checkIn, checkOut, notes } = req.validatedData.body;

      // Validate employee exists
      const employee = await prisma.employee.findUnique({ 
        where: { id: employeeId },
        select: { id: true, firstName: true, lastName: true }
      });
      if (!employee) {
        throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
      }

      // Check if attendance record already exists for this date
      const existingRecord = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date: new Date(date)
          }
        }
      });

      if (existingRecord) {
        throw new ValidationError('Attendance record already exists for this date', null, 'DUPLICATE_RECORD');
      }

      const attendanceData = {
        employeeId,
        date: new Date(date),
        status,
        notes,
      };

      if (checkIn) attendanceData.checkIn = new Date(checkIn);
      if (checkOut) attendanceData.checkOut = new Date(checkOut);

      // Calculate hours worked if both check-in and check-out are provided
      if (checkIn && checkOut) {
        const checkInTime = new Date(checkIn);
        const checkOutTime = new Date(checkOut);
        const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        attendanceData.hoursWorked = Math.max(0, hoursWorked);
      }

      const newRecord = await prisma.attendance.create({
        data: attendanceData,
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      await createAuditLog(req.user.id, 'CREATE', 'attendance', newRecord.id, null, newRecord, req);
      
      res.status(201).json({ 
        success: true, 
        message: 'Attendance record created successfully',
        data: { record: newRecord } 
      });
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
  authorize('ADMIN', 'HR'),
  validate(idSchema.merge(attendanceSchema)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const { employeeId, date, status, checkIn, checkOut, notes } = req.validatedData.body;

      const existingRecord = await prisma.attendance.findUnique({ where: { id } });
      if (!existingRecord) {
        throw new AppError('Record not found', 404, null, 'NOT_FOUND');
      }

      // Validate employee exists
      const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!employee) {
        throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
      }

      const updateData = {
        employeeId,
        date: new Date(date),
        status,
        notes,
      };

      if (checkIn) updateData.checkIn = new Date(checkIn);
      if (checkOut) updateData.checkOut = new Date(checkOut);

      // Calculate hours worked if both check-in and check-out are provided
      if (checkIn && checkOut) {
        const checkInTime = new Date(checkIn);
        const checkOutTime = new Date(checkOut);
        const hoursWorked = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        updateData.hoursWorked = Math.max(0, hoursWorked);
      }

      const updatedRecord = await prisma.attendance.update({
        where: { id },
        data: updateData,
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      await createAuditLog(req.user.id, 'UPDATE', 'attendance', id, existingRecord, updatedRecord, req);
      
      res.json({ 
        success: true, 
        message: 'Attendance record updated successfully',
        data: { record: updatedRecord } 
      });
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
  authorize('ADMIN', 'HR'),
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
      
      res.json({ 
        success: true, 
        message: 'Attendance record deleted successfully' 
      });
    } catch (error) {
      req.logger.error('Error deleting attendance record', { error: error.message, id: req.params.id });
      next(error);
    }
  }
);

module.exports = router;