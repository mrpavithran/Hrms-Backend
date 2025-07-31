import express from 'express';
import { z } from 'zod';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Validation schema
const departmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  managerId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

// Middleware for validation
const validateDepartment = (req, res, next) => {
  try {
    departmentSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List departments (paginated, filter by isActive, parentId)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER']),
  async (req, res) => {
    const { page = 1, limit = 10, isActive, parentId } = req.query;
    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (parentId) filters.parentId = parentId;

    try {
      // Simulate database query (replace with actual DB logic)
      const departments = []; // Fetch from DB with pagination and filters
      const total = 0; // Count total with filters
      res.json({ departments, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get department details (include employees, positions)
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER']),
  async (req, res) => {
    const { id } = req.params;
    try {
      // Simulate fetching department with employees and positions
      const department = { id, name: 'Example Dept', employees: [], positions: [] };
      if (!department) return res.status(404).json({ error: 'Department not found' });
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create department
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateDepartment,
  async (req, res) => {
    const { name, managerId, parentId } = req.body;
    try {
      // Simulate creating department
      const newDepartment = { id: 'uuid', name, managerId, parentId, isActive: true };
      res.status(201).json(newDepartment);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update department
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateDepartment,
  async (req, res) => {
    const { id } = req.params;
    const { name, managerId, parentId } = req.body;
    try {
      // Simulate updating department
      const updatedDepartment = { id, name, managerId, parentId, isActive: true };
      res.json(updatedDepartment);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Soft delete department
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      // Simulate soft delete
      const department = { id, isActive: false };
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;