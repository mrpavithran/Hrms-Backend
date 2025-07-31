import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const departmentSchema = z.object({
  name: z.string().min(1),
  managerId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const getDepartments = async ({ userRole, page = 1, limit = 10, isActive, parentId }) => {
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.department.findMany({
    where: { isActive: isActive !== undefined ? isActive : undefined, parentId },
    skip,
    take: limit,
    include: { manager: true, parent: true },
  });
};

export const getDepartmentById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const department = await prisma.department.findUnique({
    where: { id },
    include: { employees: true, positions: true, manager: true, parent: true },
  });
  if (!department) throw new NotFoundError('Department not found');
  return department;
};

export const createDepartment = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = departmentSchema.parse(data);
  if (validatedData.managerId) {
    const manager = await prisma.employee.findUnique({ where: { id: validatedData.managerId } });
    if (!manager) throw new ValidationError('Invalid managerId');
  }
  if (validatedData.parentId) {
    const parent = await prisma.department.findUnique({ where: { id: validatedData.parentId } });
    if (!parent) throw new ValidationError('Invalid parentId');
  }
  return prisma.department.create({ data: { ...validatedData, isActive: true } });
};

export const updateDepartment = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = departmentSchema.partial().parse(data);
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw new NotFoundError('Department not found');
  return prisma.department.update({ where: { id }, data: validatedData });
};

export const deleteDepartment = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw new NotFoundError('Department not found');
  return prisma.department.update({ where: { id }, data: { isActive: false } });
};