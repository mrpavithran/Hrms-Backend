const express = require('express');
const { employeeService } = require('../services/employeeService');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createAuditLog } = require('../middleware/auditMiddleware');
const { z } = require('zod');

const router = express.Router();

// Validation schemas
const employeeSchemas = {
  create: z.object({
    body: z.object({
      employeeId: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      dateOfBirth: z.string().datetime().optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
      maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']).optional(),
      nationality: z.string().optional(),
      address: z.string().optional(),
      departmentId: z.string().uuid().optional(),
      positionId: z.string().uuid().optional(),
      managerId: z.string().uuid().optional(),
      employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT']).optional(),
      hireDate: z.string().datetime(),
      baseSalary: z.number().optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid employee ID') }),
    body: z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      departmentId: z.string().uuid().optional(),
      positionId: z.string().uuid().optional(),
      managerId: z.string().uuid().optional(),
      employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE', 'PROBATION']).optional(),
      baseSalary: z.number().optional(),
    }),
  }),
  getAll: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).optional().default('1'),
      limit: z.string().regex(/^\d+$/).optional().default('10'),
      search: z.string().optional(),
      departmentId: z.string().uuid().optional(),
      employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE', 'PROBATION']).optional(),
    }),
  }),
};

// Get all employees
router.get('/', authenticate, authorize('ADMIN', 'HR', 'MANAGER'), validate(employeeSchemas.getAll), async (req, res, next) => {
  try {
    const { page, limit, search, departmentId, employmentStatus } = req.validatedData.query;
    const employees = await employeeService.getAllEmployees({ page, limit, search, departmentId, employmentStatus, user: req.user });
    await createAuditLog(req.user.id, 'READ', 'employees', null, null, null, req);
    res.json({ success: true, message: 'Employees fetched successfully', data: employees });
  } catch (error) {
    next(error);
  }
});

// Get single employee
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await employeeService.getEmployee(id, req.user);
    await createAuditLog(req.user.id, 'READ', 'employees', id, null, null, req);
    res.json({ success: true, message: 'Employee fetched successfully', data: { employee } });
  } catch (error) {
    next(error);
  }
});

// Create employee
router.post('/', authenticate, authorize('ADMIN', 'HR'), validate(employeeSchemas.create), async (req, res, next) => {
  try {
    const employee = await employeeService.createEmployee({ ...req.validatedData.body, createdById: req.user.id }, req);
    res.status(201).json({ success: true, message: 'Employee created successfully', data: { employee } });
  } catch (error) {
    next(error);
  }
});

// Update employee
router.put('/:id', authenticate, authorize('ADMIN', 'HR'), validate(employeeSchemas.update), async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await employeeService.updateEmployee(id, req.validatedData.body, req);
    res.json({ success: true, message: 'Employee updated successfully', data: { employee } });
  } catch (error) {
    next(error);
  }
});

// Delete employee (soft delete via employmentStatus)
router.delete('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await employeeService.deleteEmployee(id, req);
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;