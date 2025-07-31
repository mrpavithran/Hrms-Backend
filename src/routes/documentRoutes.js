const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authMiddleware, roleMiddleware, employeeOwnRecordMiddleware } = require('../middleware/auth');

// Validation schema
const documentSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID').optional(),
  fileName: z.string().min(1, 'File name is required'),
  documentType: z.enum(['RESUME', 'CONTRACT', 'ID_PROOF', 'CERTIFICATE']),
});

// Middleware for validation
const validateDocument = (req, res, next) => {
  try {
    documentSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: error.errors });
  }
};

// GET /: List documents (paginated, filter by employeeId, documentType)
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'EMPLOYEE']),
  employeeOwnRecordMiddleware('document'),
  async (req, res) => {
    const { page = 1, limit = 10, employeeId, documentType } = req.query;
    const filters = {};
    if (employeeId) filters.employeeId = employeeId;
    if (documentType) filters.documentType = documentType;

    try {
      const documents = [];
      const total = 0;
      res.json({ documents, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get document details
router.get(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'EMPLOYEE']),
  employeeOwnRecordMiddleware('document'),
  async (req, res) => {
    const { id } = req.params;
    try {
      const document = { id, fileName: 'resume.pdf', documentType: 'RESUME' };
      if (!document) return res.status(404).json({ error: 'Document not found' });
      res.json(document);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create document
router.post(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR', 'EMPLOYEE']),
  validateDocument,
  async (req, res) => {
    const { employeeId, fileName, documentType } = req.body;
    try {
      const newDocument = { id: 'uuid', employeeId, fileName, documentType };
      res.status(201).json(newDocument);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update document
router.put(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  validateDocument,
  async (req, res) => {
    const { id } = req.params;
    const { employeeId, fileName, documentType } = req.body;
    try {
      const updatedDocument = { id, employeeId, fileName, documentType };
      res.json(updatedDocument);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Delete document
router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware(['ADMIN', 'HR']),
  async (req, res) => {
    const { id } = req.params;
    try {
      res.json({ message: 'Document deleted' });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;