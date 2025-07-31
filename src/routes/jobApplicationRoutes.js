const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const jobApplicationSchema = z.object({
  jobPostingId: z.string().uuid('Invalid job posting ID'),
  firstName: z.string().min(1, 'First name is required'),
  email: z.string().email('Invalid email'),
  status: z.enum(['APPLIED', 'UNDER_REVIEW', 'INTERVIEW', 'REJECTED', 'HIRED']).optional(),
});

// Middleware for validation
const validateJobApplication = (req, res, next) => {
  try {
    jobApplicationSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List applications (paginated, filter by jobPostingId, status)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { page = 1, limit = 10, jobPostingId, status } = req.query;
    const filters = {};
    if (jobPostingId) filters.jobPostingId = jobPostingId;
    if (status) filters.status = status;

    try {
      const applications = [];
      const total = 0;
      res.json({ applications, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get application details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const application = { id, jobPostingId: 'uuid', firstName: 'John', email: 'john@example.com' };
      if (!application) return res.status(404).json({ error: 'Application not found' });
      res.json(application);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create application (public)
router.post(
  '/',
  validateJobApplication,
  async (req, res) => {
    const { jobPostingId, firstName, email } = req.body;
    try {
      const newApplication = { id: 'uuid', jobPostingId, firstName, email, status: 'APPLIED' };
      res.status(201).json(newApplication);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update application
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateJobApplication,
  async (req, res) => {
    const { id } = req.params;
    const { jobPostingId, firstName, email, status } = req.body;
    try {
      const updatedApplication = { id, jobPostingId, firstName, email, status };
      res.json(updatedApplication);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete application
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Application deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;