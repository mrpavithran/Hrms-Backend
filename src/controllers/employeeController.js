
import { employeeService } from '../services/employeeService.js';

export const employeeController = {
  async createEmployee(req, res) {
    try {
      const employee = await employeeService.createEmployee({
        ...req.body,
        createdById: req.user?.id,
      });
      res.status(201).json({ message: 'Employee created successfully', employee });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create employee', details: error.message });
    }
  },

  async getEmployee(req, res) {
    try {
      const { id } = req.params;
      const employee = await employeeService.getEmployee(id);
      if (!employee) return res.status(404).json({ error: 'Employee not found' });
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch employee', details: error.message });
    }
  },

  async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const employee = await employeeService.updateEmployee(id, {
        ...req.body,
        updatedById: req.user?.id,
      });
      res.json({ message: 'Employee updated successfully', employee });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update employee', details: error.message });
    }
  },

  async deleteEmployee(req, res) {
    try {
      const { id } = req.params;
      await employeeService.deleteEmployee(id);
      res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete employee', details: error.message });
    }
  },
};
