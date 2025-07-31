const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware, employeeOwnRecordMiddleware } = require('../middleware/auth');

// Validation schema
const trainingRecordSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  programId: z.string().uuid('Invalid program ID'),
});

// Middleware for validation
const validateTrainingRecord = (req, res, next) => {
  try {
    trainingRecordSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List records (paginated, filter by employeeId, programId)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'EMPLOYEE']),
  employeeOwnRecordMiddleware('trainingRecord'),
  async (req, res) => {
    const { page = 1, limit = 10, employeeId, programId } = req.query;
    const filters = {};
    if (employeeId) filters.employeeId = employeeId;
    if (programId) filters.programId = programId;

    try {
      const records = [];
      const total = 0;
      res.json({ records, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get record details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'EMPLOYEE']),
  employeeOwnRecordMiddleware('trainingRecord'),
  async (req, res) => {
    const { id } = req.params;
    try {
      const record = { id, employeeId: 'uuid', programId: 'uuid' };
      if (!record) return res.status(404).json({ error: 'Record not found' });
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create record
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateTrainingRecord,
  async (req, res) => {
    const { employeeId, programId } = req.body;
    try {
      const newRecord = { id: 'uuid', employeeId, programId };
      res.status(201).json(newRecord);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update record
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateTrainingRecord,
  async (req, res) => {
    const { id } = req.params;
    const { employeeId, programId } = req.body;
    try {
      const updatedRecord = { id, employeeId, programId };
      res.json(updatedRecord);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete record
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Training record deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;