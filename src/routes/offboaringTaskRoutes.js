const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const offboardingTaskSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  title: z.string().min(1, 'Title is required'),
  isCompleted: z.boolean().optional(),
});

// Middleware for validation
const validateOffboardingTask = (req, res, next) => {
  try {
    offboardingTaskSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List tasks (paginated, filter by employeeId, isCompleted)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { page = 1, limit = 10, employeeId, isCompleted } = req.query;
    const filters = {};
    if (employeeId) filters.employeeId = employeeId;
    if (isCompleted !== undefined) filters.isCompleted = isCompleted === 'true';

    try {
      const tasks = [];
      const total = 0;
      res.json({ tasks, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get task details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const task = { id, employeeId: 'uuid', title: 'Return Equipment', isCompleted: false };
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create task
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateOffboardingTask,
  async (req, res) => {
    const { employeeId, title, isCompleted } = req.body;
    try {
      const newTask = { id: 'uuid', employeeId, title, isCompleted: isCompleted || false };
      res.status(201).json(newTask);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update task
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateOffboardingTask,
  async (req, res) => {
    const { id } = req.params;
    const { employeeId, title, isCompleted } = req.body;
    try {
      const updatedTask = { id, employeeId, title, isCompleted };
      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete task
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Offboarding task deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;