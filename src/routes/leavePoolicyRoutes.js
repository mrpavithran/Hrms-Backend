const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const leavePolicySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  leaveType: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID']),
  daysAllowed: z.number().min(0, 'Days allowed must be non-negative'),
  isActive: z.boolean().optional(),
});

// Middleware for validation
const validateLeavePolicy = (req, res, next) => {
  try {
    leavePolicySchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List policies (paginated, filter by leaveType, isActive)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  async (req, res) => {
    const { page = 1, limit = 10, leaveType, isActive } = req.query;
    const filters = {};
    if (leaveType) filters.leaveType = leaveType;
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    try {
      const policies = [];
      const total = 0;
      res.json({ policies, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get policy details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const policy = { id, name: 'Annual Leave', leaveType: 'ANNUAL', daysAllowed: 20 };
      if (!policy) return res.status(404).json({ error: 'Policy not found' });
      res.json(policy);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create policy
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateLeavePolicy,
  async (req, res) => {
    const { name, leaveType, daysAllowed } = req.body;
    try {
      const newPolicy = { id: 'uuid', name, leaveType, daysAllowed, isActive: true };
      res.status(201).json(newPolicy);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update policy
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateLeavePolicy,
  async (req, res) => {
    const { id } = req.params;
    const { name, leaveType, daysAllowed } = req.body;
    try {
      const updatedPolicy = { id, name, leaveType, daysAllowed };
      res.json(updatedPolicy);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Soft delete policy
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const policy = { id, isActive: false };
      res.json(policy);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;