import { prisma } from '../lib/prisma';
import type { StaffRole } from '../../generated/prisma/enums';

const PERMISSION_DEFAULTS: Record<string, StaffRole[]> = {
  allowOrderTest: ['DOCTOR', 'NURSES', 'ADMIN'],
  allowRecordVitalsWithoutActiveEncounter: ['DOCTOR', 'NURSES', 'ADMIN'],
  allowViewDiagnoses: ['DOCTOR', 'ADMIN'],
  requireDoctorCosignOnPrescription: [],
  allowViewOrderStatus: ['BILLING_OFFICER'],
  allowCreateRequests: ['DOCTOR', 'NURSES', 'LAB_SCIENTIST', 'IMAGING_TECH', 'PHARMACIST', 'RECEPTIONIST', 'BILLING_OFFICER', 'HIM_OFFICER', 'PROCUREMENT_OFFICER', 'ADMIN', 'MANAGER'],
  allowApproveRequests: ['ADMIN', 'MANAGER', 'BILLING_OFFICER'],
  allowManageInventory: ['PROCUREMENT_OFFICER', 'ADMIN', 'MANAGER'],
  allowViewAuditLogs: ['HIM_OFFICER', 'ADMIN', 'MANAGER'],
  allowExportRecords: ['HIM_OFFICER', 'ADMIN', 'DOCTOR'],
};

const PERMISSION_LABELS: Record<string, string> = {
  allowOrderTest: 'Define who can order tests',
  allowRecordVitalsWithoutActiveEncounter: 'Define who can record vitals outside active encounter',
  allowViewDiagnoses: 'Define who can view diagnoses',
  requireDoctorCosignOnPrescription: 'Require doctor co-sign on prescriptions',
  allowViewOrderStatus: 'Define who can view order status',
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  allowOrderTest: 'Define which staff can place lab/imaging orders for patients',
  allowRecordVitalsWithoutActiveEncounter: 'Define which staff can record vitals without an open encounter',
  allowViewDiagnoses: 'Define which staff can see patient diagnoses on the worklist',
  requireDoctorCosignOnPrescription: 'Define which staff require doctor co-sign on prescriptions',
  allowViewOrderStatus: 'Define which staff can view order status (not results)',
};

const COMPLIANCE_LOCKED: string[] = []; // None are locked yet — add keys here if needed

export const permissionService = {

  /**
   * Get all permissions for a tenant with effective values.
   * Returns defaults for any permission not yet overridden.
   */
  async getAll(tenantId: string) {
    const overrides = await prisma.tenantPermission.findMany({
      where: { tenantId },
    });

    const overrideMap = new Map(overrides.map((o) => [o.permissionKey, o.allowedRoles]));

    return Object.keys(PERMISSION_DEFAULTS).map((key) => {
      const isOverridden = overrideMap.has(key);
      const effectiveRoles = isOverridden
        ? overrideMap.get(key)!
        : PERMISSION_DEFAULTS[key];

      return {
        key,
        label: PERMISSION_LABELS[key] ?? key,
        description: PERMISSION_DESCRIPTIONS[key] ?? '',
        complianceLocked: COMPLIANCE_LOCKED.includes(key),
        effectiveRoles,
        isOverridden,
        defaultRoles: PERMISSION_DEFAULTS[key],
      };
    });
  },

  /**
   * Update a permission override for a tenant.
   * Creates or updates the TenantPermission row.
   */
  async update(tenantId: string, permissionKey: string, allowedRoles: StaffRole[], updatedBy: string) {
    if (COMPLIANCE_LOCKED.includes(permissionKey)) {
      throw new Error('This permission is compliance-locked and cannot be overridden.');
    }

    return prisma.tenantPermission.upsert({
      where: {
        tenantId_permissionKey: { tenantId, permissionKey },
      },
      update: {
        allowedRoles,
        updatedBy,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        permissionKey,
        allowedRoles,
        updatedBy,
      },
    });
  },
};