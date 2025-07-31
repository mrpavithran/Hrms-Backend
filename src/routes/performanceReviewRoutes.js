const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware, employeeOwnRecordMiddleware } = require('../middleware/auth');

// Validation schema
const performanceReviewSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  reviewerId: z.string().uuid('Invalid reviewer ID'),
  overallRating: z.enum(['OUTSTANDING', 'SATISFACTORY', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY']).optional(),
});

// Middleware for validation
const validatePerformanceReview = (req, res, next) => {
  try {
    performanceReviewSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List reviews (paginated, filter by employeeId, status)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  employeeOwnRecordMiddleware('performanceReview'),
  async (req, res) => {
    const { page = 1, limit = 10, employeeId, status } = req.query;
    const filters = {};
    if (employeeId) filters.employeeId = employeeId;
    if (status) filters.status = status;

    try {
      const reviews = [];
      const total = 0;
      res.json({ reviews, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get review details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  employeeOwnRecordMiddleware('performanceReview'),
  async (req, res) => {
    const { id } = req.params;
    try {
      const review = { id, employeeId: 'uuid', reviewerId: 'uuid', overallRating: 'SATISFACTORY' };
      if (!review) return res.status(404).json({ error: 'Review not found' });
      res.json(review);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create review
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER']),
  validatePerformanceReview,
  async (req, res) => {
    const { employeeId, reviewerId, overallRating } = req.body;
    try {
      const newReview = { id: 'uuid', employeeId, reviewerId, overallRating };
      res.status(201).json(newReview);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update review
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'MANAGER']),
  validatePerformanceReview,
  async (req, res) => {
    const { id } = req.params;
    const { employeeId, reviewerId, overallRating } = req.body;
    try {
      const updatedReview = { id, employeeId, reviewerId, overallRating };
      res.json(updatedReview);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete review
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Performance review deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;