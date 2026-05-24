import { prisma } from '../lib/prisma';
import argon2 from 'argon2';
import {
  type StaffRole,
  type Department,
} from '../../generated/prisma/enums';

// ── TYPES ─────────────────────────────────────────────────────

export interface CreateStaffInput {
  firstName:   string;
  lastName:    string;
  email:       string;
  password:    string;
  role:        StaffRole;
  department?: Department;
  phoneNumber?: string;
  isHOD?:      boolean;
  canVerify?:  boolean;
}

export interface UpdateStaffInput {
  firstName?:   string;
  lastName?:    string;
  phoneNumber?: string;
  department?:  Department;
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
  'ADMIN','DOCTOR','NURSES','LAB_TECH','RADIOLOGIST',
  'PHARMACIST','RECEPTIONIST','BILLING_OFFICER',
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

  // Email format
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }

  return { valid: errors.length === 0, errors };
}

// ── DEPT-SCOPED ROLES ─────────────────────────────────────────
// These roles must have a department assigned

const DEPT_REQUIRED_ROLES: StaffRole[] = [
  'LAB_TECH','RADIOLOGIST','DOCTOR','NURSES','PHARMACIST',
];

// ── SERVICE ───────────────────────────────────────────────────

export const staffService = {

  async createStaff(data: CreateStaffInput) {
    const { valid, errors } = validateCreateStaff(data);
    if (!valid) throw new Error(errors.join(', '));

    // Department required for clinical roles
    if (DEPT_REQUIRED_ROLES.includes(data.role) && !data.department) {
      throw new Error(`Role ${data.role} requires a department`);
    }

    const existing = await prisma.staff.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });
    if (existing) throw new Error('A staff member with this email already exists');

    const hashed = await argon2.hash(data.password);

    return prisma.staff.create({
      data: {
        firstName:   data.firstName.trim(),
        lastName:    data.lastName.trim(),
        email:       data.email.toLowerCase().trim(),
        password:    hashed,
        role:        data.role,
        department:  data.department  ?? null,
        phoneNumber: data.phoneNumber ?? null,
        isHOD:       data.isHOD      ?? false,
        canVerify:   data.canVerify   ?? false,
      },
      // Never return password
      select: {
        id: true, firstName: true, lastName: true,
        email: true, role: true, department: true,
        isHOD: true, canVerify: true, phoneNumber: true,
        createdAt: true,
      },
    });
  },

  async login(data: LoginInput) {
    const staff = await prisma.staff.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (!staff) {
      await argon2.hash('dummy');
      throw new Error('Invalid credentials');
    }

    const valid = await argon2.verify(staff.password, data.password);
    if (!valid) throw new Error('Invalid credentials');

    const { password, ...safeStaff } = staff;

    return safeStaff;
  },

  async getStaffById(id: string) {
    return prisma.staff.findUnique({
      where: { id },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, role: true, department: true,
        isHOD: true, canVerify: true, phoneNumber: true,
        createdAt: true, updatedAt: true,
      },
    });
  },

async getAllStaff(department?: Department) {
  return prisma.staff.findMany({
    ...(department ? { where: { department } } : {}),
    orderBy: [{ department: 'asc' as const }, { lastName: 'asc' as const }],
    select: {
      id: true, firstName: true, lastName: true,
      email: true, role: true, department: true,
      isHOD: true, canVerify: true, phoneNumber: true,
      createdAt: true,
    },
   });
  },

  async updateStaff(id: string, data: UpdateStaffInput) {
    const existing = await prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new Error('Staff member not found');

    return prisma.staff.update({
      where: { id },
      data: {
        ...(data.firstName   && { firstName:   data.firstName.trim()   }),
        ...(data.lastName    && { lastName:    data.lastName.trim()    }),
        ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
        ...(data.department  !== undefined && { department:  data.department  }),
      },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, role: true, department: true,
        isHOD: true, canVerify: true, phoneNumber: true,
        updatedAt: true,
      },
    });
  },

  // Only ADMIN can update permissions
  async updatePermissions(id: string, data: UpdatePermissionsInput) {
    const existing = await prisma.staff.findUnique({ where: { id } });
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

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    const staff = await prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new Error('Staff member not found');

    const valid = await argon2.verify(staff.password, currentPassword);
    if (!valid) throw new Error('Current password is incorrect');

    const hashed = await argon2.hash(newPassword);

    await prisma.staff.update({
      where: { id },
      data:  { password: hashed },
    });
  },

  // Soft approach — in a real hospital you rarely hard-delete staff
  // because audit logs reference their ID. Mark inactive via role
  // change or handle via HR process. Hard delete only for test accounts.
  async deleteStaff(id: string) {
    const existing = await prisma.staff.findUnique({ where: { id } });
    if (!existing) throw new Error('Staff member not found');

    const hasAuditLogs = await prisma.auditLog.findFirst({
      where: { userId: id },
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