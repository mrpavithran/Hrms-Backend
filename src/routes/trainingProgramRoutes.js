const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const trainingProgramSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean().optional(),
});

// Middleware for validation
const validateTrainingProgram = (req, res, next) => {
  try {
    trainingProgramSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List programs (paginated, filter by isActive)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  async (req, res) => {
    const { page = 1, limit = 10, isActive } = req.query;
    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    try {
      const programs = [];
      const total = 0;
      res.json({ programs, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get program details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const program = { id, name: 'Leadership Training', isActive: true };
      if (!program) return res.status(404).json({ error: 'Program not found' });
      res.json(program);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create program
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateTrainingProgram,
  async (req, res) => {
    const { name } = req.body;
    try {
      const newProgram = { id: 'uuid', name, isActive: true };
      res.status(201).json(newProgram);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update program
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateTrainingProgram,
  async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const updatedProgram = { id, name, isActive: true };
      res.json(updatedProgram);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Soft delete program
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const program = { id, isActive: false };
      res.json(program);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;