import { performanceReviewService } from '../services/performanceReviewService.js';

export const performanceReviewController = {
  async createPerformanceReview(req, res) {
    try {
      const performanceReview = await performanceReviewService.createPerformanceReview(req.body);
      res.status(201).json({ message: 'Performance review created successfully', performanceReview });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create performance review', details: error.message });
    }
  },

  async getPerformanceReview(req, res) {
    try {
      const { id } = req.params;
      const performanceReview = await performanceReviewService.getPerformanceReview(id);
      if (!performanceReview) return res.status(404).json({ error: 'Performance review not found' });
      res.json(performanceReview);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch performance review', details: error.message });
    }
  },

  async updatePerformanceReview(req, res) {
    try {
      const { id } = req.params;
      const performanceReview = await performanceReviewService.updatePerformanceReview(id, req.body);
      res.json({ message: 'Performance review updated successfully', performanceReview });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update performance review', details: error.message });
    }
  },

  async deletePerformanceReview(req, res) {
    try {
      const { id } = req.params;
      await performanceReviewService.deletePerformanceReview(id);
      res.json({ message: 'Performance review deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete performance review', details: error.message });
    }
  },
};
