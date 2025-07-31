const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const jobPostingSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  departmentId: z.string().uuid('Invalid department ID'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']).optional(),
  status: z.enum(['OPEN', 'CLOSED', 'DRAFT']).optional(),
});

// Middleware for validation
const validateJobPosting = (req, res, next) => {
  try {
    jobPostingSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List job postings (paginated, filter by status, departmentId)
router.get(
  '/',
  async (req, res) => {
    const { page = 1, limit = 10, status, departmentId } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (departmentId) filters.departmentId = departmentId;

    try {
      const postings = [];
      const total = 0;
      res.json({ postings, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get job posting details
router.get(
  '/:id',
  async (req, res) => {
    const { id } = req.params;
    try {
      const posting = { id, title: 'Software Engineer', departmentId: 'uuid' };
      if (!posting) return res.status(404).json({ error: 'Job posting not found' });
      res.json(posting);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create job posting
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateJobPosting,
  async (req, res) => {
    const { title, departmentId, employmentType } = req.body;
    try {
      const newPosting = { id: 'uuid', title, departmentId, employmentType, status: 'OPEN' };
      res.status(201).json(newPosting);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update job posting
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateJobPosting,
  async (req, res) => {
    const { id } = req.params;
    const { title, departmentId, employmentType, status } = req.body;
    try {
      const updatedPosting = { id, title, departmentId, employmentType, status };
      res.json(updatedPosting);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete job posting
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Job posting deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;