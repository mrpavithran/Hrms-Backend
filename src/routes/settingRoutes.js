const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Validation schema
const settingSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
});

// Middleware for validation
const validateSetting = (req, res, next) => {
  try {
    settingSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List settings (paginated, filter by category, isPublic)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  async (req, res) => {
    const { page = 1, limit = 10, category, isPublic } = req.query;
    const filters = {};
    if (category) filters.category = category;
    if (isPublic !== undefined) filters.isPublic = isPublic === 'true';

    try {
      const settings = [];
      const total = 0;
      res.json({ settings, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get setting details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  async (req, res) => {
    const { id } = req.params;
    try {
      const setting = { id, key: 'max_leave_days', value: '30' };
      if (!setting) return res.status(404).json({ error: 'Setting not found' });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create setting
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  validateSetting,
  async (req, res) => {
    const { key, value } = req.body;
    try {
      const newSetting = { id: 'uuid', key, value };
      res.status(201).json(newSetting);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update setting
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  validateSetting,
  async (req, res) => {
    const { id } = req.params;
    const { key, value } = req.body;
    try {
      const updatedSetting = { id, key, value };
      res.json(updatedSetting);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete setting
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Setting deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;