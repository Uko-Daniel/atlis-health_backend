import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Department, PrismaClient, TemplateType } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({ adapter });
async function main() {
  console.log('🌱 Seeding services and templates...');

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
