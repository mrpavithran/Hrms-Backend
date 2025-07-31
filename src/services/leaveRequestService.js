const prisma = require('../prisma/client');
const { AppError, NotFoundError } = require('../utils/errors');

const leaveRequestService = {
  async getAllLeaveRequests({ page, limit, status, employeeId, user }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      AND: [
        status ? { status } : {},
        employeeId ? { employeeId } : {},
        user.role === 'MANAGER' ? { employee: { managerId: user.employeeId } } : {},
      ],
    };
    const [leaveRequests, total] = await Promise.all([
      prisma.leave_requests.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          employee: { select: { id: true, firstName: true, lastName: true } },
          policy: { select: { id: true, name: true, leaveType: true } },
          startDate: true,
          endDate: true,
          days: true,
          status: true,
          reason: true,
        },
        orderBy: { appliedAt: 'desc' },
      }),
      prisma.leave_requests.count({ where }),
    ]);
    return { leaveRequests, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } };
  },

  async getLeaveRequest(id, user) {
    const where = user.role === 'EMPLOYEE' ? { id, employeeId: user.employeeId } : { id };
    const leaveRequest = await prisma.leave_requests.findFirst({
      where,
      select: {
        id: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        policy: { select: { id: true, name: true, leaveType: true } },
        startDate: true,
        endDate: true,
        days: true,
        status: true,
        reason: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!leaveRequest) throw new NotFoundError('Leave request not found or unauthorized');
    return leaveRequest;
  },

  async createLeaveRequest({ employeeId, policyId, startDate, endDate, reason, attachments }, req) {
    const employee = await prisma.employees.findUnique({ where: { id: employeeId } });
    if (!employee) throw new AppError('Employee not found', 400);
    const policy = await prisma.leave_policies.findUnique({ where: { id: policyId } });
    if (!policy) throw new AppError('Leave policy not found', 400);
    const leaveBalance = await prisma.leave_balances.findFirst({
      where: { employeeId, policyId, year: new Date().getFullYear() },
    });
    if (!leaveBalance || leaveBalance.remaining < 1) throw new AppError('Insufficient leave balance', 400);
    const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
    const leaveRequest = await prisma.$transaction(async (tx) => {
      const newRequest = await tx.leave_requests.create({
        data: {
          employeeId,
          policyId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          days,
          reason,
          attachments: attachments || [],
          status: 'PENDING',
        },
        select: { id: true, employeeId: true, policyId: true, startDate: true, endDate: true, days: true, status: true },
      });
      await tx.leave_balances.update({
        where: { id: leaveBalance.id },
        data: { used: leaveBalance.used + days, remaining: leaveBalance.remaining - days },
      });
      return newRequest;
    });
    await prisma.audit_logs.create({
      data: { userId: req.user.id, action: 'CREATE', resource: 'leave_requests', resourceId: leaveRequest.id, newValues: leaveRequest, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
    return leaveRequest;
  },

  async updateLeaveRequest(id, { status, rejectionReason, cancellationReason, approvedById }, req) {
    const existing = await prisma.leave_requests.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Leave request not found');
    const data = { status, updatedAt: new Date() };
    if (status === 'APPROVED') {
      data.approvedAt = new Date();
      data.approvedById = approvedById;
    } else if (status === 'REJECTED') {
      data.rejectedAt = new Date();
      data.rejectionReason = rejectionReason;
    } else if (status === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancellationReason = cancellationReason;
    }
    const leaveRequest = await prisma.leave_requests.update({
      where: { id },
      data,
      select: { id: true, employeeId: true, policyId: true, startDate: true, endDate: true, days: true, status: true },
    });
    await prisma.audit_logs.create({
      data: { userId: req.user.id, action: 'UPDATE', resource: 'leave_requests', resourceId: id, oldValues: existing, newValues: leaveRequest, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
    return leaveRequest;
  },

  async deleteLeaveRequest(id, req) {
    const leaveRequest = await prisma.leave_requests.findUnique({ where: { id } });
    if (!leaveRequest) throw new NotFoundError('Leave request not found');
    await prisma.leave_requests.delete({ where: { id } });
    await prisma.audit_logs.create({
      data: { userId: req.user.id, action: 'DELETE', resource: 'leave_requests', resourceId: id, oldValues: leaveRequest, ipAddress: req.ip, userAgent: req.get('User-Agent') },
    });
  },
};

module.exports = { leaveRequestService };