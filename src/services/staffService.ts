import { prisma } from '../lib/prisma';
import argon2 from 'argon2';
import {
  type StaffRole,
  type Department,
} from '../../generated/prisma/enums';

// ── TYPES ─────────────────────────────────────────────────────

export interface CreateStaffInput {
  firstName:      string;
  lastName:       string;
  email:          string;
  password:       string;
  role:           StaffRole;
  tenantId:       string; 
  department?:    Department;
  phoneNumber?:   string;
  isHOD?:         boolean;
  canVerify?:     boolean;
  // Bio
  maritalStatus?: string;
  religion?:      string;
  leaveStatus?:   string;
  nok?: {
    firstName:   string;
    lastName:    string;
    relation:    string;
    phoneNumber: string;
  };
}

export interface UpdateStaffInput {
  firstName?:     string;
  lastName?:      string;
  phoneNumber?:   string;
  department?:    Department;
  maritalStatus?: string;
  religion?:      string;
  leaveStatus?:   string;
}

export interface UpdatePermissionsInput {
  isHOD?:     boolean;
  canVerify?: boolean;
  role?:      StaffRole;
}

export interface LoginInput {
  email:    string;
  password: string;
}

// ── VALIDATION ────────────────────────────────────────────────

const VALID_ROLES: StaffRole[] = [
  'ADMIN','DOCTOR','NURSES','LAB_SCIENTIST','IMAGING_TECH',
  'PHARMACIST', 'PROCUREMENT_OFFICER','RECEPTIONIST','BILLING_OFFICER',
  'HIM_OFFICER','MANAGER','IT_SUPPORT',
];

function validateCreateStaff(data: CreateStaffInput) {
  const errors: string[] = [];

  if (!data.firstName?.trim())  errors.push('firstName is required');
  if (!data.lastName?.trim())   errors.push('lastName is required');
  if (!data.email?.trim())      errors.push('email is required');
  if (!data.password?.trim())   errors.push('password is required');
  if (data.password?.length < 8) errors.push('password must be at least 8 characters');
  if (!data.role)               errors.push('role is required');
  if (!VALID_ROLES.includes(data.role)) errors.push(`Invalid role: ${data.role}`);

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }

  return { valid: errors.length === 0, errors };
}

// ── DEPT-SCOPED ROLES ─────────────────────────────────────────
const DEPT_REQUIRED_ROLES: StaffRole[] = [
  'LAB_SCIENTIST','IMAGING_TECH','DOCTOR','NURSES','PHARMACIST',
];

// ── SERVICE ───────────────────────────────────────────────────

export const staffService = {

  async createStaff(data: CreateStaffInput) {
    const { valid, errors } = validateCreateStaff(data);
    if (!valid) throw new Error(errors.join(', '));

    if (DEPT_REQUIRED_ROLES.includes(data.role) && !data.department) {
      throw new Error(`Role ${data.role} requires a department`);
    }

    const existing = await prisma.staff.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });
    if (existing) throw new Error('A staff member with this email already exists');

    const hashed = await argon2.hash(data.password);

    const staff = await prisma.staff.create({
      data: {
        firstName:     data.firstName.trim(),
        lastName:      data.lastName.trim(),
        email:         data.email.toLowerCase().trim(),
        password:      hashed,
        role:          data.role,
        maritalStatus: (data.maritalStatus as any) ?? null,
        religion:      data.religion      ?? null,
        leaveStatus:   (data.leaveStatus as any)   ?? 'ACTIVE',
        department:    data.department    ?? null,
        phoneNumber:   data.phoneNumber   ?? null,
        isHOD:         data.isHOD        ?? false,
        canVerify:     data.canVerify     ?? false,
        tenant:        { connect: { id: data.tenantId } },
      },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, role: true, department: true,
        isHOD: true, canVerify: true, phoneNumber: true,
        maritalStatus: true, religion: true, leaveStatus: true,
        createdAt: true,
      },
    });

    // Create Next of Kin if provided
    if (data.nok?.firstName) {
      await prisma.staffNextOfKin.create({
        data: {
          staffId:     staff.id,
          firstName:   data.nok.firstName,
          lastName:    data.nok.lastName,
          relation:    data.nok.relation,
          phoneNumber: data.nok.phoneNumber,
        },
      });
    }

    return staff;
  },

  async login(data: LoginInput, tenantId?: string) {
    const staff = await prisma.staff.findFirst({
      where: {
        email: data.email.toLowerCase().trim(),
        ...(tenantId && { tenantId }),
      },
    });

    if (!staff) {
      await argon2.hash('dummy');
      throw new Error('Invalid credentials');
    }

    const valid = await argon2.verify(staff.password, data.password);
    if (!valid) throw new Error('Invalid credentials');

    const { password: _password, ...safeStaff } = staff;
    return safeStaff;
  },

  async getStaffById(id: string, tenantId?: string) {
    return prisma.staff.findFirst({
      where: { id, ...(tenantId && { tenantId }) },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, role: true, department: true,
        isHOD: true, canVerify: true, phoneNumber: true,
        maritalStatus: true, religion: true, leaveStatus: true,
        createdAt: true, updatedAt: true,
        nok: true,
      },
    });
  },

  async getAllStaff(tenantId: string, department?: Department) {
    return prisma.staff.findMany({
      where: { tenantId, ...(department && { department }) },
      orderBy: [{ department: 'asc' as const }, { lastName: 'asc' as const }],
      select: {
        id: true, firstName: true, lastName: true,
        email: true, role: true, department: true,
        isHOD: true, canVerify: true, phoneNumber: true,
        maritalStatus: true, religion: true, leaveStatus: true,
        createdAt: true,
        nok: true,
      },
    });
  },

  async getStaffActivity(staffId: string, tenantId: string) {
    return prisma.auditLog.findMany({
      where: { userId: staffId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
      },
    });
  },

  async updateStaff(id: string, tenantId: string, data: UpdateStaffInput) {
    const existing = await prisma.staff.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Staff member not found');

    return prisma.staff.update({
      where: { id },
      data: {
        ...(data.firstName   && { firstName:   data.firstName.trim()   }),
        ...(data.lastName    && { lastName:    data.lastName.trim()    }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
        ...(data.department  !== undefined && { department:  data.department  }),
        ...(data.maritalStatus !== undefined && { maritalStatus: data.maritalStatus as any }),
        ...(data.religion      !== undefined && { religion:      data.religion      }),
        ...(data.leaveStatus   !== undefined && { leaveStatus:   data.leaveStatus as any }),
      },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, role: true, department: true,
        isHOD: true, canVerify: true, phoneNumber: true,
        maritalStatus: true, religion: true, leaveStatus: true,
        updatedAt: true,
      },
    });
  },

  async updatePermissions(id: string, tenantId: string, data: UpdatePermissionsInput) {
    const existing = await prisma.staff.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Staff member not found');

    if (data.role && !VALID_ROLES.includes(data.role)) {
      throw new Error(`Invalid role: ${data.role}`);
    }

    return prisma.staff.update({
      where: { id },
      data: {
        ...(data.isHOD     !== undefined && { isHOD:     data.isHOD     }),
        ...(data.canVerify !== undefined && { canVerify: data.canVerify }),
        ...(data.role      !== undefined && { role:      data.role      }),
      },
      select: {
        id: true, firstName: true, lastName: true,
        role: true, isHOD: true, canVerify: true,
        department: true,
      },
    });
  },

  async changePassword(id: string, currentPassword: string, newPassword: string, tenantId?: string) {
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    const staff = await prisma.staff.findFirst({ where: { id, ...(tenantId && { tenantId }) } });
    if (!staff) throw new Error('Staff member not found');

    const valid = await argon2.verify(staff.password, currentPassword);
    if (!valid) throw new Error('Current password is incorrect');

    const hashed = await argon2.hash(newPassword);

    await prisma.staff.update({
      where: { id },
      data:  { password: hashed },
    });
  },

  async deleteStaff(id: string, tenantId: string) {
    const existing = await prisma.staff.findFirst({ where: { id, tenantId } });
    if (!existing) throw new Error('Staff member not found');

    const hasAuditLogs = await prisma.auditLog.findFirst({
      where: { userId: id, tenantId },
    });

    if (hasAuditLogs) {
      throw new Error(
        'Cannot delete staff with audit history. ' +
        'Contact your system administrator for account deactivation.'
      );
    }

    return prisma.staff.delete({ where: { id } });
  },
};