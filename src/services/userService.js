const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../prisma/client');
const { AppError, NotFoundError } = require('../utils/errors');

const userService = {
  async getAllUsers({ page, limit, search, role, isActive }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      AND: [
        search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { employee: { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] } }] } : {},
        role ? { role } : {},
        isActive !== undefined ? { isActive: isActive === 'true' } : {},
      ],
    };
    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true, department: { select: { id: true, name: true } }, position: { select: { id: true, title: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.users.count({ where }),
    ]);
    return { users, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } };
  },

  async getUser(id) {
    const user = await prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        employee: { include: { department: true, position: true, manager: { select: { id: true, firstName: true, lastName: true } } } },
        auditLogs: { take: 10, orderBy: { timestamp: 'desc' }, select: { id: true, action: true, resource: true, timestamp: true, ipAddress: true } },
      },
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
  },

  async createUser({ email, password, role, employeeId, createdById }, req) {
    const existingUser = await prisma.users.findUnique({ where: { email } });
    if (existingUser) throw new AppError('User already exists with this email', 409);
    if (employeeId) {
      const employee = await prisma.employees.findUnique({ where: { id: employeeId }, include: { user: true } });
      if (!employee) throw new AppError('Employee not found', 400);
      if (employee.user) throw new AppError('Employee already has a user account', 400);
    }
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.users.create({
        data: { email, password: hashedPassword, role },
        select: { id: true, email: true, role: true, isActive: true, createdAt: true },
      });
      if (employeeId) await tx.employees.update({ where: { id: employeeId }, data: { userId: newUser.id } });
      return newUser;
    });
    await prisma.audit_logs.create({
      data: { userId: createdById, action: 'CREATE', resource: 'users', resourceId: user.id, newValues: user, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
    return user;
  },

  async updateUser(id, data, req) {
    const existingUser = await prisma.users.findUnique({ where: { id } });
    if (!existingUser) throw new NotFoundError('User not found');
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.users.findUnique({ where: { email: data.email } });
      if (emailExists) throw new AppError('Email already exists', 409);
    }
    if (data.employeeId) {
      const employee = await prisma.employees.findUnique({ where: { id: data.employeeId }, include: { user: true } });
      if (!employee) throw new AppError('Employee not found', 400);
      if (employee.user && employee.user.id !== id) throw new AppError('Employee already linked to another user', 400);
      data.employee = { connect: { id: data.employeeId } };
    }
    const user = await prisma.users.update({
      where: { id },
      data,
      select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true },
    });
    if (data.isActive === false) await prisma.refresh_tokens.deleteMany({ where: { userId: id } });
    await prisma.audit_logs.create({
      data: { userId: req.user.id, action: 'UPDATE', resource: 'users', resourceId: id, oldValues: existingUser, newValues: user, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
    return user;
  },

  async changePassword(userId, { currentPassword, newPassword }, req) {
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) throw new AppError('Current password is incorrect', 400);
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await prisma.$transaction([
      prisma.users.update({ where: { id: userId }, data: { password: hashedPassword } }),
      prisma.refresh_tokens.deleteMany({ where: { userId } }),
    ]);
    await prisma.audit_logs.create({
      data: { userId, action: 'PASSWORD_CHANGE', resource: 'users', resourceId: userId, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
  },

  async requestPasswordReset(email) {
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) throw new NotFoundError('User not found');
    const resetToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.users.update({ where: { id: user.id }, data: { passwordResetToken: resetToken, passwordResetExpires: expires } });
    // Implement email sending logic here
  },

  async resetPassword({ token, newPassword }, req) {
    const user = await prisma.users.findFirst({ where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } } });
    if (!user) throw new AppError('Invalid or expired reset token', 400);
    const hashedPassword = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    await prisma.$transaction([
      prisma.users.update({ where: { id: user.id }, data: { password: hashedPassword, passwordResetToken: null, passwordResetExpires: null } }),
      prisma.refresh_tokens.deleteMany({ where: { userId: user.id } }),
    ]);
    await prisma.audit_logs.create({
      data: { userId: null, action: 'PASSWORD_RESET', resource: 'users', resourceId: user.id, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
  },

  async deleteUser(id, req) {
    const user = await prisma.users.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    await prisma.$transaction([
      prisma.users.update({ where: { id }, data: { isActive: false } }),
      prisma.refresh_tokens.deleteMany({ where: { userId: id } }),
    ]);
    await prisma.audit_logs.create({
      data: { userId: req.user.id, action: 'DELETE', resource: 'users', resourceId: id, oldValues: user, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
  },

  async getUserActivity(id, { page, limit }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const user = await prisma.users.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    const [activities, total] = await Promise.all([
      prisma.audit_logs.findMany({ where: { userId: id }, skip, take: parseInt(limit), orderBy: { timestamp: 'desc' } }),
      prisma.audit_logs.count({ where: { userId: id } }),
    ]);
    return { activities, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } };
  },
};

module.exports = { userService };