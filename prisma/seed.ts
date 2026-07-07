import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Department, PrismaClient, TemplateType } from "../generated/prisma/client";
import { staffService } from "../src/services/staffService";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding templates, services, and staff accounts...');

  // =========================
  // TEMPLATES
  // =========================

  const templates = await Promise.all([

    // CBC TEMPLATE
    prisma.template.upsert({
      where: { name: 'CBC Template' },
      update: {},
      create: {
        name: 'CBC Template',
        type: TemplateType.LAB,
        department: Department.LABORATORY,
        dataSchema: {
          fields: [
            { name: 'hemoglobin', unit: 'g/dL', range: '12-16' },
            { name: 'wbc', unit: 'x10^9/L', range: '4-11' },
            { name: 'platelets', unit: 'x10^9/L', range: '150-450' }
          ]
        }
      }
    }),

    // MALARIA TEMPLATE
    prisma.template.upsert({
      where: { name: 'Malaria Template' },
      update: {},
      create: {
        name: 'Malaria Template',
        type: TemplateType.LAB,
        department: Department.LABORATORY,
        dataSchema: {
          fields: [
            { name: 'parasiteDetected', type: 'boolean' },
            { name: 'parasiteDensity', unit: 'parasites/µL' }
          ]
        }
      }
    }),

    // URINALYSIS TEMPLATE
    prisma.template.upsert({
      where: { name: 'Urinalysis Template' },
      update: {},
      create: {
        name: 'Urinalysis Template',
        type: TemplateType.LAB,
        department: Department.LABORATORY,
        dataSchema: {
          fields: [
            { name: 'color', type: 'string' },
            { name: 'ph', type: 'number', range: '4.5-8' },
            { name: 'protein', type: 'string' },
            { name: 'glucose', type: 'string' }
          ]
        }
      }
    }),

    // X-RAY TEMPLATE
    prisma.template.upsert({
      where: { name: 'X-Ray Template' },
      update: {},
      create: {
        name: 'X-Ray Template',
        type: TemplateType.IMAGING,
        department: Department.RADIOLOGY,
        dataSchema: {
          fields: [
            { name: 'finding', type: 'text' },
            { name: 'impression', type: 'text' }
          ]
        }
      }
    }),

    // ULTRASOUND TEMPLATE
    prisma.template.upsert({
      where: { name: 'Ultrasound Template' },
      update: {},
      create: {
        name: 'Ultrasound Template',
        type: TemplateType.IMAGING,
        department: Department.RADIOLOGY,
        dataSchema: {
          fields: [
            { name: 'organ', type: 'string' },
            { name: 'finding', type: 'text' },
            { name: 'impression', type: 'text' }
          ]
        }
      }
    }),

  ]);

  // =========================
  // SERVICES
  // =========================

  await Promise.all([

    prisma.service.upsert({
      where: { labCode: 'CBC' },
      update: {},
      create: {
        name: 'Complete Blood Count',
        labCode: 'CBC',
        category: 'Hematology',
        price: 5000,
        templateId: templates[0].id,
      }
    }),

    prisma.service.upsert({
      where: { labCode: 'MP' },
      update: {},
      create: {
        name: 'Malaria Parasite Test',
        labCode: 'MP',
        category: 'Parasitology',
        price: 3000,
        templateId: templates[1].id,
      }
    }),

    prisma.service.upsert({
      where: { labCode: 'UA' },
      update: {},
      create: {
        name: 'Urinalysis',
        labCode: 'UA',
        category: 'Chemistry',
        price: 4000,
        templateId: templates[2].id,
      }
    }),

    prisma.service.upsert({
      where: { labCode: 'XRAY_CHEST' },
      update: {},
      create: {
        name: 'Chest X-Ray',
        labCode: 'XRAY_CHEST',
        category: 'Imaging',
        price: 10000,
        templateId: templates[3].id,
      }
    }),

    prisma.service.upsert({
      where: { labCode: 'USS_ABD' },
      update: {},
      create: {
        name: 'Abdominal Ultrasound',
        labCode: 'USS_ABD',
        category: 'Imaging',
        price: 15000,
        templateId: templates[4].id,
      }
    }),

  ]);

  // =========================
  // STAFF ACCOUNTS
  // =========================

  const seedPassword = 'password123'; // Change in production

  const staffAccounts = [
    {
      firstName: 'Daniel',
      lastName:  'Uko',
      email:     'admin@atlis.com',
      role:      'ADMIN' as const,
      department: Department.ADMINISTRATION,
      phoneNumber: '+2349062345678',
      isHOD:     true,
      canVerify: true,
    },
    {
      firstName: 'Damilola',
      lastName:  'Olaosebiomo',
      email:     'doctor@atlis.com',
      role:      'DOCTOR' as const,
      department: Department.GENERAL,
      phoneNumber: '+2349052345678',
      isHOD:     false,
      canVerify: false,
    },
    {
      firstName: 'Rotimi',
      lastName:  'Brownson',
      email:     'nurse@atlis.com',
      role:      'NURSES' as const,
      department: Department.GENERAL,
      phoneNumber: '+2349042345678',
      isHOD:     false,
      canVerify: false,
    },
    {
      firstName: 'Lab',
      lastName:  'Technician',
      email:     'labtech@atlis.com',
      role:      'LAB_TECH' as const,
      department: Department.LABORATORY,
      phoneNumber: '+2349032345678',
      isHOD:     false,
      canVerify: true,
    },
    {
      firstName: 'Radiologist',
      lastName:  'One',
      email:     'radiologist@atlis.com',
      role:      'RADIOLOGIST' as const,
      department: Department.RADIOLOGY,
      phoneNumber: '+2349022345678',
      isHOD:     false,
      canVerify: true,
    },
    {
      firstName: 'Pharmacist',
      lastName:  'One',
      email:     'pharmacist@atlis.com',
      role:      'PHARMACIST' as const,
      department: Department.PHARMACY,
      phoneNumber: '+2348112345678',
      isHOD:     false,
      canVerify: false,
    },
    {
      firstName: 'Receptionist',
      lastName:  'One',
      email:     'receptionist@atlis.com',
      role:      'RECEPTIONIST' as const,
      department: Department.ADMINISTRATION,
      phoneNumber: '+2347112345678',
      isHOD:     false,
      canVerify: false,
    },
    {
      firstName: 'Billing',
      lastName:  'Officer',
      email:     'billing@atlis.com',
      role:      'BILLING_OFFICER' as const,
      department: Department.ADMINISTRATION,
      phoneNumber: '+2349112345678',
      isHOD:     false,
      canVerify: false,
    },
    {
      firstName: 'HIM',
      lastName:  'Officer',
      email:     'him@atlis.com',
      role:      'HIM_OFFICER' as const,
      department: Department.ADMINISTRATION,
      phoneNumber: '+2347012345678',
      isHOD:     true,
      canVerify: false,
    },
    {
      firstName: 'Manager',
      lastName:  'One',
      email:     'manager@atlis.com',
      role:      'MANAGER' as const,
      department: Department.ADMINISTRATION,
      phoneNumber: '+2349012345678',
      isHOD:     true,
      canVerify: true,
    },
    {
      firstName: 'IT',
      lastName:  'Support',
      email:     'it@atlis.com',
      role:      'IT_SUPPORT' as const,
      department: Department.ADMINISTRATION,
      phoneNumber: '+2348012345678',
      isHOD:     false,
      canVerify: false,
    },
  ];

  console.log('👥 Creating staff accounts...');

  for (const staff of staffAccounts) {
    try {
      await staffService.createStaff({
        firstName:   staff.firstName,
        lastName:    staff.lastName,
        email:       staff.email,
        password:    seedPassword,
        role:        staff.role,
        department:  staff.department,
        phoneNumber: staff.phoneNumber,
        isHOD:       staff.isHOD,
        canVerify:   staff.canVerify,
      });
      console.log(`  ✅ ${staff.firstName} ${staff.lastName} (${staff.role})`);
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log(`  ⏭️  ${staff.email} already exists — skipped`);
      } else {
        console.error(`  ❌ Failed to create ${staff.email}:`, err.message);
      }
    }
  }

  console.log('✅ Seeding complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });