const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware, employeeOwnRecordMiddleware } = require('../middleware/auth');

// Validation schema
const leaveBalanceSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  policyId: z.string().uuid('Invalid policy ID'),
  year: z.number().min(2000, 'Invalid year'),
});

// Middleware for validation
const validateLeaveBalance = (req, res, next) => {
  try {
    leaveBalanceSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List balances (paginated, filter by employeeId, year)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  employeeOwnRecordMiddleware('leaveBalance'),
  async (req, res) => {
    const { page = 1, limit = 10, employeeId, year } = req.query;
    const filters = {};
    if (employeeId) filters.employeeId = employeeId;
    if (year) filters.year = Number(year);

    try {
      const balances = [];
      const total = 0;
      res.json({ balances, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get balance details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  employeeOwnRecordMiddleware('leaveBalance'),
  async (req, res) => {
    const { id } = req.params;
    try {
      const balance = { id, employeeId: 'uuid', policyId: 'uuid', year: 2025 };
      if (!balance) return res.status(404).json({ error: 'Balance not found' });
      res.json(balance);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create balance
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateLeaveBalance,
  async (req, res) => {
    const { employeeId, policyId, year } = req.body;
    try {
      const newBalance = { id: 'uuid', employeeId, policyId, year };
      res.status(201).json(newBalance);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update balance
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateLeaveBalance,
  async (req, res) => {
    const { id } = req.params;
    const { employeeId, policyId, year } = req.body;
    try {
      const updatedBalance = { id, employeeId, policyId, year };
      res.json(updatedBalance);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete balance
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Leave balance deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;