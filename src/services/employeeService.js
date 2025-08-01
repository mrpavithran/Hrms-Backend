const { PrismaClient } = require('@prisma/client');
const { AppError, NotFoundError } = require('../utils/errors');
const { createAuditLog } = require('../middleware/auditMiddleware');

const prisma = new PrismaClient();

const employeeService = {
  async getAllEmployees({ page, limit, search, departmentId, employmentStatus, user }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      AND: [
        search ? { 
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } }, 
            { lastName: { contains: search, mode: 'insensitive' } }, 
            { email: { contains: search, mode: 'insensitive' } },
            { employeeId: { contains: search, mode: 'insensitive' } }
          ] 
        } : {},
        departmentId ? { departmentId } : {},
        employmentStatus ? { employmentStatus } : {},
        user.role === 'MANAGER' ? { 
          OR: [
            { managerId: user.employee?.id }, 
            { id: user.employee?.id }
          ] 
        } : {},
      ],
    };

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          department: { select: { id: true, name: true } },
          position: { select: { id: true, title: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
          employmentStatus: true,
          employmentType: true,
          hireDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.employee.count({ where }),
    ]);

    return { 
      employees, 
      pagination: { 
        page: parseInt(page), 
        limit: parseInt(limit), 
        total, 
        pages: Math.ceil(total / parseInt(limit)) 
      } 
    };
  },

  async getEmployee(id, user) {
    const where = { id };
    
    // If user is a manager, only allow access to their subordinates or themselves
    if (user.role === 'MANAGER') {
      const managerCheck = await prisma.employee.findFirst({
        where: {
          id,
          OR: [
            { managerId: user.employee?.id }, 
            { id: user.employee?.id }
          ]
        }
      });
      if (!managerCheck) {
        throw new NotFoundError('Employee not found or unauthorized');
      }
    }

    const employee = await prisma.employee.findUnique({
      where,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        middleName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        maritalStatus: true,
        nationality: true,
        address: true,
        city: true,
        state: true,
        country: true,
        zipCode: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        department: { 
          select: { 
            id: true, 
            name: true,
            manager: { select: { id: true, firstName: true, lastName: true } }
          } 
        },
        position: { 
          select: { 
            id: true, 
            title: true, 
            description: true,
            minSalary: true,
            maxSalary: true
          } 
        },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        subordinates: { 
          select: { id: true, firstName: true, lastName: true, employeeId: true },
          where: { employmentStatus: 'ACTIVE' }
        },
        employmentType: true,
        employmentStatus: true,
        hireDate: true,
        probationEndDate: true,
        terminationDate: true,
        terminationReason: true,
        baseSalary: true,
        currency: true,
        profilePicture: true,
        bio: true,
        skills: true,
        qualifications: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found or unauthorized');
    }

    return employee;
  },

  async createEmployee(data, req) {
    const { employeeId, email, departmentId, positionId, managerId } = data;

    // Check for existing employee ID or email
    const existing = await prisma.employee.findFirst({ 
      where: { 
        OR: [
          { employeeId }, 
          { email }
        ] 
      } 
    });
    if (existing) {
      throw new AppError('Employee ID or email already exists', 409);
    }

    // Validate department exists
    if (departmentId) {
      const dept = await prisma.department.findUnique({ 
        where: { id: departmentId, isActive: true } 
      });
      if (!dept) {
        throw new AppError('Department not found or inactive', 400);
      }
    }

    // Validate position exists
    if (positionId) {
      const pos = await prisma.position.findUnique({ 
        where: { id: positionId, isActive: true } 
      });
      if (!pos) {
        throw new AppError('Position not found or inactive', 400);
      }
    }

    // Validate manager exists
    if (managerId) {
      const mgr = await prisma.employee.findUnique({ 
        where: { id: managerId, employmentStatus: 'ACTIVE' } 
      });
      if (!mgr) {
        throw new AppError('Manager not found or inactive', 400);
      }
    }

    const employee = await prisma.employee.create({
      data: {
        ...data,
        createdById: req.user.id,
        updatedById: req.user.id,
        hireDate: new Date(data.hireDate),
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : undefined,
      },
      select: { 
        id: true, 
        employeeId: true, 
        firstName: true, 
        lastName: true, 
        email: true, 
        hireDate: true,
        employmentStatus: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } }
      },
    });

    await createAuditLog(req.user.id, 'CREATE', 'employees', employee.id, null, employee, req);
    
    return employee;
  },

  async updateEmployee(id, data, req) {
    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Employee not found');
    }

    // Check email uniqueness if email is being updated
    if (data.email && data.email !== existing.email) {
      const emailExists = await prisma.employee.findUnique({ where: { email: data.email } });
      if (emailExists) {
        throw new AppError('Email already exists', 409);
      }
    }

    // Validate department if being updated
    if (data.departmentId) {
      const dept = await prisma.department.findUnique({ 
        where: { id: data.departmentId, isActive: true } 
      });
      if (!dept) {
        throw new AppError('Department not found or inactive', 400);
      }
    }

    // Validate position if being updated
    if (data.positionId) {
      const pos = await prisma.position.findUnique({ 
        where: { id: data.positionId, isActive: true } 
      });
      if (!pos) {
        throw new AppError('Position not found or inactive', 400);
      }
    }

    // Validate manager if being updated
    if (data.managerId) {
      const mgr = await prisma.employee.findUnique({ 
        where: { id: data.managerId, employmentStatus: 'ACTIVE' } 
      });
      if (!mgr) {
        throw new AppError('Manager not found or inactive', 400);
      }
      
      // Prevent self-management
      if (data.managerId === id) {
        throw new AppError('Employee cannot be their own manager', 400);
      }
    }

    // Convert date strings to Date objects
    const updateData = { ...data, updatedById: req.user.id };
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.hireDate) updateData.hireDate = new Date(data.hireDate);
    if (data.probationEndDate) updateData.probationEndDate = new Date(data.probationEndDate);
    if (data.terminationDate) updateData.terminationDate = new Date(data.terminationDate);

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData,
      select: { 
        id: true, 
        employeeId: true, 
        firstName: true, 
        lastName: true, 
        email: true, 
        employmentStatus: true,
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
        updatedAt: true
      },
    });

    await createAuditLog(req.user.id, 'UPDATE', 'employees', id, existing, employee, req);
    
    return employee;
  },

  async deleteEmployee(id, req) {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    // Soft delete by updating employment status
    const updatedEmployee = await prisma.employee.update({ 
      where: { id }, 
      data: { 
        employmentStatus: 'TERMINATED',
        terminationDate: new Date(),
        updatedById: req.user.id 
      } 
    });

    await createAuditLog(req.user.id, 'DELETE', 'employees', id, employee, updatedEmployee, req);
  },
};

module.exports = { employeeService };