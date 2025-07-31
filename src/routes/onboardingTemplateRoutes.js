const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const onboardingTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean().optional(),
});

// Middleware for validation
const validateOnboardingTemplate = (req, res, next) => {
  try {
    onboardingTemplateSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List templates (paginated, filter by isActive)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { page = 1, limit = 10, isActive } = req.query;
    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';

    try {
      const templates = [];
      const total = 0;
      res.json({ templates, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get template details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const template = { id, name: 'New Hire Template', isActive: true };
      if (!template) return res.status(404).json({ error: 'Template not found' });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create template
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateOnboardingTemplate,
  async (req, res) => {
    const { name } = req.body;
    try {
      const newTemplate = { id: 'uuid', name, isActive: true };
      res.status(201).json(newTemplate);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update template
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateOnboardingTemplate,
  async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const updatedTemplate = { id, name, isActive: true };
      res.json(updatedTemplate);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Soft delete template
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const template = { id, isActive: false };
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;