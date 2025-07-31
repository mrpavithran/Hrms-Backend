const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const positionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  departmentId: z.string().uuid('Invalid department ID'),
  requirements: z.array(z.string()).optional(),
  minSalary: z.number().optional(),
  isActive: z.boolean().optional(),
});

// Middleware for validation
const validatePosition = (req, res, next) => {
  try {
    positionSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List positions (paginated, filter by departmentId, isActive)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER']),
  async (req, res) => {
    const { page = 1, limit = 10, departmentId, isActive } = req.query;
    const filters = {};
    if (departmentId) filters.departmentId = departmentId;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    try {
      // Simulate database query
      const positions = [];
      const total = 0;
      res.json({ positions, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get position details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const position = { id, title: 'Example Position' };
      if (!position) return res.status(404).json({ error: 'Position not found' });
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create position
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validatePosition,
  async (req, res) => {
    const { title, departmentId, requirements, minSalary } = req.body;
    try {
      const newPosition = { id: 'uuid', title, departmentId, requirements, minSalary, isActive: true };
      res.status(201).json(newPosition);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update position
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validatePosition,
  async (req, res) => {
    const { id } = req.params;
    const { title, departmentId, requirements, minSalary } = req.body;
    try {
      const updatedPosition = { id, title, departmentId, requirements, minSalary };
      res.json(updatedPosition);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Soft delete position
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const position = { id, isActive: false };
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;