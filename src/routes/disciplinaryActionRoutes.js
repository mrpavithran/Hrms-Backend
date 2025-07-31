const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const disciplinaryActionSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  type: z.string().min(1, 'Type is required'),
  reason: z.string().min(1, 'Reason is required'),
});

// Middleware for validation
const validateDisciplinaryAction = (req, res, next) => {
  try {
    disciplinaryActionSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List actions (paginated, filter by employeeId, type)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { page = 1, limit = 10, employeeId, type } = req.query;
    const filters = {};
    if (employeeId) filters.employeeId = employeeId;
    if (type) filters.type = type;

    try {
      const actions = [];
      const total = 0;
      res.json({ actions, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get action details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const action = { id, employeeId: 'uuid', type: 'Warning', reason: 'Late arrival' };
      if (!action) return res.status(404).json({ error: 'Action not found' });
      res.json(action);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create action
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateDisciplinaryAction,
  async (req, res) => {
    const { employeeId, type, reason } = req.body;
    try {
      const newAction = { id: 'uuid', employeeId, type, reason };
      res.status(201).json(newAction);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update action
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateDisciplinaryAction,
  async (req, res) => {
    const { id } = req.params;
    const { employeeId, type, reason } = req.body;
    try {
      const updatedAction = { id, employeeId, type, reason };
      res.json(updatedAction);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete action
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Disciplinary action deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;