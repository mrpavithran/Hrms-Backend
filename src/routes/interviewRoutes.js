const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const interviewSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  scheduledAt: z.string().datetime('Invalid date format'),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']).optional(),
});

// Middleware for validation
const validateInterview = (req, res, next) => {
  try {
    interviewSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List interviews (paginated, filter by applicationId, status)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { page = 1, limit = 10, applicationId, status } = req.query;
    const filters = {};
    if (applicationId) filters.applicationId = applicationId;
    if (status) filters.status = status;

    try {
      const interviews = [];
      const total = 0;
      res.json({ interviews, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get interview details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const interview = { id, applicationId: 'uuid', scheduledAt: '2025-08-01T10:00:00Z' };
      if (!interview) return res.status(404).json({ error: 'Interview not found' });
      res.json(interview);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create interview
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateInterview,
  async (req, res) => {
    const { applicationId, scheduledAt } = req.body;
    try {
      const newInterview = { id: 'uuid', applicationId, scheduledAt, status: 'SCHEDULED' };
      res.status(201).json(newInterview);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update interview
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateInterview,
  async (req, res) => {
    const { id } = req.params;
    const { applicationId, scheduledAt, status } = req.body;
    try {
      const updatedInterview = { id, applicationId, scheduledAt, status };
      res.json(updatedInterview);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete interview
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Interview deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;