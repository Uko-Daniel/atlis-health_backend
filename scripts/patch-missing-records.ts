import { prisma } from '../src/lib/prisma';


async function main() {
  console.log('🔍 Finding patients without records...')

  const patientsWithoutRecords = await prisma.patient.findMany({
    where: { records: { none: {} } },
    select: { id: true, firstName: true, lastName: true },
  })

  console.log(`Found ${patientsWithoutRecords.length} patients without records.`)

  if (patientsWithoutRecords.length === 0) {
    console.log('✅ All patients have records. Nothing to do.')
    return
  }

  console.log('📝 Creating records...')
  let created = 0

  for (const patient of patientsWithoutRecords) {
    await prisma.record.create({
      data: { patientId: patient.id },
    })
    created++
    console.log(`  ✓ ${patient.firstName} ${patient.lastName} (${patient.id})`)
  }

  console.log(`\n✅ Done. Created ${created} records.`)
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())