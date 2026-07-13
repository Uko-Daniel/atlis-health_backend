import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Department,
  PrismaClient,
  TemplateType,
  PlanTier,
  SubscriptionStatus,
  StaffRole,
} from "../generated/prisma/client";
import { staffService } from "../src/services/staffService";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧪 Seeding beta test structure...\n');

  const seedPassword = 'password123';

  // =========================
  // TENANT 1: Nova Care Hospital
  // =========================

  const novaCare = await prisma.tenant.upsert({
    where: { subdomain: 'novacare' },
    update: {},
    create: {
      facilityName: 'Nova Care',
      subdomain: 'novacare',
      planTier: PlanTier.TIER_2,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      licenseExpiresAt: new Date('2027-12-31'),
      eveeEnabled: true,
      themePrimaryColor: '#242775ff',
      logoUrl: '/novacare-icon.svg',
    },
  });

  console.log(`🏥 ${novaCare.facilityName}`);

  // Default permissions
  const defaultPermissions: Array<{ permissionKey: string; allowedRoles: StaffRole[] }> = [
    { permissionKey: 'allowOrderTest', allowedRoles: [StaffRole.DOCTOR, StaffRole.NURSES, StaffRole.ADMIN] },
    { permissionKey: 'allowRecordVitalsWithoutActiveEncounter', allowedRoles: [StaffRole.DOCTOR, StaffRole.NURSES, StaffRole.ADMIN] },
    { permissionKey: 'allowViewDiagnoses', allowedRoles: [StaffRole.DOCTOR, StaffRole.ADMIN] },
    { permissionKey: 'requireDoctorCosignOnPrescription', allowedRoles: [] },
    { permissionKey: 'allowViewOrderStatus', allowedRoles: [StaffRole.BILLING_OFFICER] },
    { permissionKey: 'allowCreateRequests', allowedRoles: [StaffRole.DOCTOR, StaffRole.NURSES, StaffRole.LAB_SCIENTIST, StaffRole.IMAGING_TECH, StaffRole.PHARMACIST, StaffRole.RECEPTIONIST, StaffRole.BILLING_OFFICER, StaffRole.HIM_OFFICER, StaffRole.PROCUREMENT_OFFICER, StaffRole.ADMIN, StaffRole.MANAGER] },
    { permissionKey: 'allowApproveRequests', allowedRoles: [StaffRole.ADMIN, StaffRole.MANAGER, StaffRole.BILLING_OFFICER] },
    { permissionKey: 'allowManageInventory', allowedRoles: [StaffRole.PROCUREMENT_OFFICER, StaffRole.ADMIN, StaffRole.MANAGER] },
    { permissionKey: 'allowViewAuditLogs', allowedRoles: [StaffRole.HIM_OFFICER, StaffRole.ADMIN, StaffRole.MANAGER] },
    { permissionKey: 'allowExportRecords', allowedRoles: [StaffRole.HIM_OFFICER, StaffRole.ADMIN, StaffRole.DOCTOR] },
  ];

  for (const perm of defaultPermissions) {
    await prisma.tenantPermission.upsert({
      where: { tenantId_permissionKey: { tenantId: novaCare.id, permissionKey: perm.permissionKey } },
      update: {},
      create: { tenantId: novaCare.id, permissionKey: perm.permissionKey, allowedRoles: perm.allowedRoles, updatedBy: 'seed' },
    });
  }

  // HMOs
  for (const p of [
    { name: 'NHIA', type: 'NHIA' as const },
    { name: 'AXA Mansard', type: 'HMO' as const },
  ]) {
    await prisma.payer.upsert({
      where: { tenantId_name: { tenantId: novaCare.id, name: p.name } },
      update: {},
      create: { tenantId: novaCare.id, name: p.name, type: p.type },
    });
  }

  // Expense categories
  for (const name of ['Staff Salaries', 'Drugs & Supplies', 'Utilities', 'Maintenance', 'Miscellaneous']) {
    await prisma.expenseCategory.upsert({
      where: { id: `${novaCare.id}-${name}` } as any,
      update: {},
      create: { tenantId: novaCare.id, name },
    }).catch(() => {});
  }

  // Staff
  const novaStaff = [
    { firstName: 'Adebola', lastName: 'Ogunleye', email: 'admin@novacare.com', role: 'ADMIN' as const, department: Department.ADMINISTRATION, phone: '+2348051111111', isHOD: true, canVerify: true },
    { firstName: 'Folake', lastName: 'Adebayo', email: 'manager@novacare.com', role: 'MANAGER' as const, department: Department.ADMINISTRATION, phone: '+2348051111112', isHOD: true, canVerify: false },
  ];

  for (const s of novaStaff) {
    try {
      await staffService.createStaff({
        firstName: s.firstName, lastName: s.lastName, email: s.email,
        password: seedPassword, role: s.role, tenantId: novaCare.id,
        department: s.department, phoneNumber: s.phone, isHOD: s.isHOD, canVerify: s.canVerify,
      });
      console.log(`  ✅ ${s.firstName} ${s.lastName} (${s.role})`);
    } catch (err: any) {
      if (!err.message.includes('already exists')) console.error(`  ❌ ${s.email}: ${err.message}`);
    }
  }

  // =========================
  // TENANT 2: Eudora Medical Centre
  // =========================

  const eudora = await prisma.tenant.upsert({
    where: { subdomain: 'eudora' },
    update: {},
    create: {
      facilityName: 'Eudora Medical Centre',
      subdomain: 'eudora',
      planTier: PlanTier.TIER_3,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      licenseExpiresAt: new Date('2027-12-31'),
      eveeEnabled: true,
      themePrimaryColor: '#028fa3ff',
      logoUrl: '/eudora-icon.svg',
    },
  });

  console.log(`🏥 ${eudora.facilityName}`);

  for (const perm of defaultPermissions) {
    await prisma.tenantPermission.upsert({
      where: { tenantId_permissionKey: { tenantId: eudora.id, permissionKey: perm.permissionKey } },
      update: {},
      create: { tenantId: eudora.id, permissionKey: perm.permissionKey, allowedRoles: perm.allowedRoles, updatedBy: 'seed' },
    });
  }

  for (const p of [
    { name: 'NHIA', type: 'NHIA' as const },
    { name: 'AXA Mansard', type: 'HMO' as const },
  ]) {
    await prisma.payer.upsert({
      where: { tenantId_name: { tenantId: eudora.id, name: p.name } },
      update: {},
      create: { tenantId: eudora.id, name: p.name, type: p.type },
    });
  }

  for (const name of ['Staff Salaries', 'Drugs & Supplies', 'Utilities', 'Maintenance', 'Miscellaneous']) {
    await prisma.expenseCategory.upsert({
      where: { id: `${eudora.id}-${name}` } as any,
      update: {},
      create: { tenantId: eudora.id, name },
    }).catch(() => {});
  }

  const eudoraStaff = [
    { firstName: 'Babajide', lastName: 'Akintola', email: 'admin@eudora.com', role: 'ADMIN' as const, department: Department.ADMINISTRATION, phone: '+2348062222221', isHOD: true, canVerify: true },
    { firstName: 'Simisola', lastName: 'Alabi', email: 'manager@eudora.com', role: 'MANAGER' as const, department: Department.ADMINISTRATION, phone: '+2348062222222', isHOD: true, canVerify: false },
  ];

  for (const s of eudoraStaff) {
    try {
      await staffService.createStaff({
        firstName: s.firstName, lastName: s.lastName, email: s.email,
        password: seedPassword, role: s.role, tenantId: eudora.id,
        department: s.department, phoneNumber: s.phone, isHOD: s.isHOD, canVerify: s.canVerify,
      });
      console.log(`  ✅ ${s.firstName} ${s.lastName} (${s.role})`);
    } catch (err: any) {
      if (!err.message.includes('already exists')) console.error(`  ❌ ${s.email}: ${err.message}`);
    }
  }

  console.log('\n✅ Beta test structure seeded!');
  console.log('📋 Login accounts (password: password123):');
  console.log('   Nova Care: admin@novacare.com | manager@novacare.com');
  console.log('   Eudora:   admin@eudora.com   | manager@eudora.com');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
  .finally(() => prisma.$disconnect());