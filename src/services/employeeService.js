const prisma = require('../prisma/client');
const { AppError, NotFoundError } = require('../utils/errors');

const employeeService = {
  async getAllEmployees({ page, limit, search, departmentId, employmentStatus, user }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      AND: [
        search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {},
        departmentId ? { departmentId } : {},
        employmentStatus ? { employmentStatus } : {},
        user.role === 'MANAGER' ? { OR: [{ managerId: user.employeeId }, { id: user.employeeId }] } : {},
      ],
    };
    const [employees, total] = await Promise.all([
      prisma.employees.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, title: true } },
          employmentStatus: true,
          hireDate: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employees.count({ where }),
    ]);
    return { employees, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } };
  },

  async getEmployee(id, user) {
    const where = user.role === 'MANAGER' ? { id, OR: [{ managerId: user.employeeId }, { id: user.employeeId }] } : { id };
    const employee = await prisma.employees.findFirst({
      where,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        department: true,
        position: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        employmentType: true,
        employmentStatus: true,
        hireDate: true,
        baseSalary: true,
      },
    });
    if (!employee) throw new NotFoundError('Employee not found or unauthorized');
    return employee;
  },

  async createEmployee(data, req) {
    const { employeeId, email, departmentId, positionId, managerId } = data;
    const existing = await prisma.employees.findFirst({ where: { OR: [{ employeeId }, { email }] } });
    if (existing) throw new AppError('Employee ID or email already exists', 409);
    if (departmentId) {
      const dept = await prisma.departments.findUnique({ where: { id: departmentId } });
      if (!dept) throw new AppError('Department not found', 400);
    }
    if (positionId) {
      const pos = await prisma.positions.findUnique({ where: { id: positionId } });
      if (!pos) throw new AppError('Position not found', 400);
    }
    if (managerId) {
      const mgr = await prisma.employees.findUnique({ where: { id: managerId } });
      if (!mgr) throw new AppError('Manager not found', 400);
    }
    const employee = await prisma.employees.create({
      data: {
        ...data,
        createdById: req.user.id,
        updatedById: req.user.id,
        hireDate: new Date(data.hireDate),
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
      select: { id: true, employeeId: true, firstName: true, lastName: true, email: true, hireDate: true },
    });
    await prisma.audit_logs.create({
      data: { userId: req.user.id, action: 'CREATE', resource: 'employees', resourceId: employee.id, newValues: employee, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
    return employee;
  },

  async updateEmployee(id, data, req) {
    const existing = await prisma.employees.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Employee not found');
    if (data.email && data.email !== existing.email) {
      const emailExists = await prisma.employees.findUnique({ where: { email: data.email } });
      if (emailExists) throw new AppError('Email already exists', 409);
    }
    const employee = await prisma.employees.update({
      where: { id },
      data: { ...data, updatedById: req.user.id },
      select: { id: true, employeeId: true, firstName: true, lastName: true, email: true, employmentStatus: true },
    });
    await prisma.audit_logs.create({
      data: { userId: req.user.id, action: 'UPDATE', resource: 'employees', resourceId: id, oldValues: existing, newValues: employee, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
    return employee;
  },

  async deleteEmployee(id, req) {
    const employee = await prisma.employees.findUnique({ where: { id } });
    if (!employee) throw new NotFoundError('Employee not found');
    await prisma.employees.update({ where: { id }, data: { employmentStatus: 'TERMINATED', updatedById: req.user.id } });
    await prisma.audit_logs.create({
      data: { userId: req.user.id, action: 'DELETE', resource: 'employees', resourceId: id, oldValues: employee, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
  },
};

module.exports = { employeeService };