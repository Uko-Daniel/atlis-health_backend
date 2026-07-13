import { prisma } from '../src/lib/prisma'
import { patientService } from '../src/services/patientService'
import { encounterService } from '../src/services/encounterService'
import { vitalService } from '../src/services/vitalService'
import { diagnosisService } from '../src/services/diagnosisService'
import { medicationService } from '../src/services/medicationService'
import { allergyService } from '../src/services/allergyService'
import { staffService } from '../src/services/staffService'

// ── Nigerian name pools ──────────────────────────────────────

const FIRST_NAMES_MALE = [
  'Oluwaseun', 'Chidi', 'Emeka', 'Adebayo', 'Tunde', 'Ibrahim',
  'Chukwudi', 'Obinna', 'Femi', 'Nnamdi', 'Yusuf', 'Segun',
  'Ifeanyi', 'Babatunde', 'Chinedu', 'Opeyemi', 'Dayo', 'Musa',
  'Kunle', 'Uche', 'Okafor', 'Taiwo', 'Kehinde', 'Bolaji', 'Gboyega',
  'Tobi', 'Dapo', 'Seyi', 'Wale', 'Niyi',
]

const FIRST_NAMES_FEMALE = [
  'Folake', 'Chidinma', 'Ngozi', 'Adesua', 'Titilayo', 'Amina',
  'Chiamaka', 'Obiageli', 'Funke', 'Adaobi', 'Zainab', 'Bimpe',
  'Ifeoma', 'Bose', 'Chioma', 'Temilade', 'Yetunde', 'Fatima',
  'Simisola', 'Nkechi', 'Omolara', 'Kemi', 'Aisha', 'Ronke', 'Buki',
  'Tolani', 'Lola', 'Moji', 'Efe', 'Onyinye',
]

const LAST_NAMES = [
  'Okafor', 'Adebayo', 'Okonkwo', 'Musa', 'Oluwole', 'Eze',
  'Balogun', 'Nwachukwu', 'Adamu', 'Olawale', 'Ibrahim', 'Chukwu',
  'Ogunleye', 'Mohammed', 'Obi', 'Akintola', 'Bello', 'Onyeka',
  'Salami', 'Okoro', 'Ezeobi', 'Alabi', 'Danjuma', 'Nwosu', 'Yakubu',
  'Ajayi', 'Oduwole', 'Fashola', 'Bankole', 'Lawal',
]

function randomFrom<T>(arr: T[]): T {
  const value = arr[Math.floor(Math.random() * arr.length)]
  if (value === undefined) {
    throw new Error('Cannot choose a random item from an empty array')
  }
  return value
}

function dobFromAge(age: number): Date {
  const now = new Date()
  const year = now.getFullYear() - age
  const month = Math.floor(Math.random() * 12)
  const day = Math.floor(Math.random() * 28) + 1
  return new Date(year, month, day)
}

function nigerianPhone(): string {
  const prefixes = ['0803', '0805', '0806', '0807', '0809', '0810', '0813', '0814', '0816', '0903', '0906', '0703', '0706']
  return randomFrom(prefixes) + String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

// ── Clinical scenario templates ──────────────────────────────

interface ScenarioTemplate {
  chiefComplaint: string
  diagnoses: Array<{ name: string; icdCode: string; status: 'ACTIVE' | 'CHRONIC' | 'SUSPECTED'; isPrimary: boolean }>
  vitals: Record<string, number | null>
  medications: Array<{ name: string; dosage: string; route: string; frequency: string }>
  allergies: Array<{ substance: string; reaction: string; severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING'; drugClass: string | null }>
  services: string[]  // lab codes to order
}

const SCENARIOS: ScenarioTemplate[] = [
  // ── Malaria + NSAID allergy ─────────────────────────────
  {
    chiefComplaint: 'High fever, chills, and body aches for 3 days',
    diagnoses: [
      { name: 'Malaria', icdCode: 'B54', status: 'ACTIVE', isPrimary: true },
    ],
    vitals: { systolicBP: 118, diastolicBP: 76, heartRate: 105, temperature: 39.8, spO2: 96, respiratoryRate: 22 },
    medications: [
      { name: 'Artemether', dosage: '80mg', route: 'Oral', frequency: 'Twice daily' },
      { name: 'Lumefantrine', dosage: '480mg', route: 'Oral', frequency: 'Twice daily' },
      { name: 'Ibuprofen', dosage: '400mg', route: 'Oral', frequency: 'Three times daily' },
    ],
    allergies: [
      { substance: 'Aspirin', reaction: 'Rash and swelling', severity: 'MODERATE', drugClass: 'NSAID' },
    ],
    services: ['MP', 'CBC'],
  },
  // ── Hypertension + Diabetes + DDI (ACEI + ARB) ──────────
  {
    chiefComplaint: 'Routine check-up — blood pressure poorly controlled',
    diagnoses: [
      { name: 'Essential Hypertension', icdCode: 'I10', status: 'CHRONIC', isPrimary: true },
      { name: 'Type 2 Diabetes Mellitus', icdCode: 'E11.9', status: 'CHRONIC', isPrimary: false },
    ],
    vitals: { systolicBP: 168, diastolicBP: 102, heartRate: 78, temperature: 36.5, spO2: 97, respiratoryRate: 16 },
    medications: [
      { name: 'Lisinopril', dosage: '20mg', route: 'Oral', frequency: 'Once daily' },
      { name: 'Losartan', dosage: '50mg', route: 'Oral', frequency: 'Once daily' },
      { name: 'Metformin', dosage: '500mg', route: 'Oral', frequency: 'Twice daily' },
    ],
    allergies: [],
    services: ['CBC', 'UA'],
  },
  // ── Penicillin allergy + cephalosporin ───────────────────
  {
    chiefComplaint: 'Severe sore throat, difficulty swallowing for 5 days',
    diagnoses: [
      { name: 'Acute Tonsillitis', icdCode: 'J03.9', status: 'ACTIVE', isPrimary: true },
    ],
    vitals: { systolicBP: 122, diastolicBP: 78, heartRate: 92, temperature: 38.6, spO2: 98, respiratoryRate: 18 },
    medications: [
      { name: 'Ceftriaxone', dosage: '1g', route: 'Intravenous', frequency: 'Once daily' },
    ],
    allergies: [
      { substance: 'Penicillin', reaction: 'Anaphylaxis', severity: 'LIFE_THREATENING', drugClass: 'Penicillin' },
    ],
    services: ['CBC'],
  },
  // ── Warfarin + NSAID (DDI-001) ──────────────────────────
  {
    chiefComplaint: 'Knee pain and swelling, on blood thinners',
    diagnoses: [
      { name: 'Atrial Fibrillation', icdCode: 'I48.91', status: 'CHRONIC', isPrimary: false },
      { name: 'Osteoarthritis of Knee', icdCode: 'M17.9', status: 'ACTIVE', isPrimary: true },
    ],
    vitals: { systolicBP: 142, diastolicBP: 86, heartRate: 82, temperature: 36.4, spO2: 96, respiratoryRate: 17 },
    medications: [
      { name: 'Warfarin', dosage: '5mg', route: 'Oral', frequency: 'Once daily' },
      { name: 'Diclofenac', dosage: '50mg', route: 'Oral', frequency: 'Twice daily' },
    ],
    allergies: [],
    services: ['CBC'],
  },
  // ── Hypertensive Crisis ─────────────────────────────────
  {
    chiefComplaint: 'Severe headache, blurred vision, nosebleed',
    diagnoses: [
      { name: 'Hypertensive Emergency', icdCode: 'I16.1', status: 'ACTIVE', isPrimary: true },
      { name: 'Chronic Kidney Disease Stage 3', icdCode: 'N18.3', status: 'CHRONIC', isPrimary: false },
    ],
    vitals: { systolicBP: 198, diastolicBP: 118, heartRate: 96, temperature: 36.8, spO2: 95, respiratoryRate: 20 },
    medications: [
      { name: 'Amlodipine', dosage: '10mg', route: 'Oral', frequency: 'Once daily' },
    ],
    allergies: [],
    services: ['UA', 'CBC'],
  },
  // ── Asthma + Propranolol (HIST-004) ─────────────────────
  {
    chiefComplaint: 'Tremors, palpitations, and shortness of breath',
    diagnoses: [
      { name: 'Essential Tremor', icdCode: 'G25.0', status: 'ACTIVE', isPrimary: true },
      { name: 'Asthma', icdCode: 'J45.909', status: 'CHRONIC', isPrimary: false },
    ],
    vitals: { systolicBP: 128, diastolicBP: 84, heartRate: 70, temperature: 36.7, spO2: 93, respiratoryRate: 22 },
    medications: [
      { name: 'Propranolol', dosage: '40mg', route: 'Oral', frequency: 'Twice daily' },
      { name: 'Salbutamol', dosage: '100mcg', route: 'Inhalation', frequency: 'As needed (PRN)' },
    ],
    allergies: [],
    services: ['CBC'],
  },
  // ── Metformin + Gentamicin (DDI-003) ────────────────────
  {
    chiefComplaint: 'Fever, burning urination, cloudy urine',
    diagnoses: [
      { name: 'Type 2 Diabetes Mellitus', icdCode: 'E11.9', status: 'CHRONIC', isPrimary: false },
      { name: 'Urinary Tract Infection', icdCode: 'N39.0', status: 'ACTIVE', isPrimary: true },
    ],
    vitals: { systolicBP: 134, diastolicBP: 84, heartRate: 94, temperature: 39.2, spO2: 96, respiratoryRate: 20 },
    medications: [
      { name: 'Metformin', dosage: '1000mg', route: 'Oral', frequency: 'Twice daily' },
      { name: 'Gentamicin', dosage: '80mg', route: 'Intravenous', frequency: 'Every 8 hours' },
    ],
    allergies: [],
    services: ['UA', 'CBC'],
  },
  // ── Tramadol + Epilepsy (HIST-003) ──────────────────────
  {
    chiefComplaint: 'Severe lower back pain radiating to leg',
    diagnoses: [
      { name: 'Lumbar Disc Herniation', icdCode: 'M51.26', status: 'ACTIVE', isPrimary: true },
      { name: 'Epilepsy', icdCode: 'G40.909', status: 'CHRONIC', isPrimary: false },
    ],
    vitals: { systolicBP: 126, diastolicBP: 82, heartRate: 74, temperature: 36.6, spO2: 98, respiratoryRate: 16 },
    medications: [
      { name: 'Tramadol', dosage: '50mg', route: 'Oral', frequency: 'Three times daily' },
      { name: 'Carbamazepine', dosage: '200mg', route: 'Oral', frequency: 'Twice daily' },
    ],
    allergies: [],
    services: ['XRAY_CHEST'],
  },
  // ── NSAID + PUD History (HIST-001) ──────────────────────
  {
    chiefComplaint: 'Migraine headache for 3 days, epigastric pain',
    diagnoses: [
      { name: 'Migraine', icdCode: 'G43.909', status: 'ACTIVE', isPrimary: true },
      { name: 'Peptic Ulcer Disease', icdCode: 'K27.9', status: 'CHRONIC', isPrimary: false },
    ],
    vitals: { systolicBP: 124, diastolicBP: 80, heartRate: 76, temperature: 36.5, spO2: 98, respiratoryRate: 16 },
    medications: [
      { name: 'Ibuprofen', dosage: '400mg', route: 'Oral', frequency: 'As needed (PRN)' },
      { name: 'Omeprazole', dosage: '20mg', route: 'Oral', frequency: 'Once daily' },
    ],
    allergies: [],
    services: ['CBC'],
  },
  // ── Heart Failure + NSAID (HIST-002) ────────────────────
  {
    chiefComplaint: 'Joint pain both knees, mild ankle swelling',
    diagnoses: [
      { name: 'Osteoarthritis', icdCode: 'M19.90', status: 'ACTIVE', isPrimary: true },
      { name: 'Congestive Heart Failure', icdCode: 'I50.9', status: 'CHRONIC', isPrimary: false },
    ],
    vitals: { systolicBP: 138, diastolicBP: 88, heartRate: 82, temperature: 36.5, spO2: 94, respiratoryRate: 19 },
    medications: [
      { name: 'Diclofenac', dosage: '50mg', route: 'Oral', frequency: 'Twice daily' },
      { name: 'Furosemide', dosage: '40mg', route: 'Oral', frequency: 'Once daily' },
    ],
    allergies: [],
    services: ['CBC', 'UA'],
  },
  // ── Furosemide + Gout (HIST-005) ────────────────────────
  {
    chiefComplaint: 'Swollen, red, painful big toe',
    diagnoses: [
      { name: 'Heart Failure', icdCode: 'I50.9', status: 'CHRONIC', isPrimary: true },
      { name: 'Gout', icdCode: 'M10.9', status: 'ACTIVE', isPrimary: false },
    ],
    vitals: { systolicBP: 142, diastolicBP: 90, heartRate: 84, temperature: 37.1, spO2: 95, respiratoryRate: 18 },
    medications: [
      { name: 'Furosemide', dosage: '40mg', route: 'Oral', frequency: 'Once daily' },
      { name: 'Allopurinol', dosage: '300mg', route: 'Oral', frequency: 'Once daily' },
    ],
    allergies: [],
    services: ['CBC', 'UA'],
  },
  // ── Ciprofloxacin + Antacid (DDI-007) ───────────────────
  {
    chiefComplaint: 'Watery diarrhoea and stomach cramps for 2 days',
    diagnoses: [
      { name: 'Bacterial Gastroenteritis', icdCode: 'A09.9', status: 'ACTIVE', isPrimary: true },
      { name: 'Gastritis', icdCode: 'K29.7', status: 'ACTIVE', isPrimary: false },
    ],
    vitals: { systolicBP: 120, diastolicBP: 78, heartRate: 92, temperature: 37.6, spO2: 97, respiratoryRate: 18 },
    medications: [
      { name: 'Ciprofloxacin', dosage: '500mg', route: 'Oral', frequency: 'Twice daily' },
      { name: 'Calcium Carbonate', dosage: '500mg', route: 'Oral', frequency: 'Three times daily' },
    ],
    allergies: [],
    services: ['CBC', 'UA'],
  },
  // ── Hypoxia / Pneumonia ─────────────────────────────────
  {
    chiefComplaint: 'Difficulty breathing, productive cough, fever for 5 days',
    diagnoses: [
      { name: 'Pneumonia', icdCode: 'J18.9', status: 'ACTIVE', isPrimary: true },
      { name: 'COPD', icdCode: 'J44.9', status: 'CHRONIC', isPrimary: false },
    ],
    vitals: { systolicBP: 132, diastolicBP: 84, heartRate: 108, temperature: 38.9, spO2: 90, respiratoryRate: 28 },
    medications: [
      { name: 'Amoxicillin', dosage: '500mg', route: 'Oral', frequency: 'Three times daily' },
      { name: 'Prednisolone', dosage: '30mg', route: 'Oral', frequency: 'Once daily' },
    ],
    allergies: [],
    services: ['CBC', 'XRAY_CHEST'],
  },
  // ── Tachycardia ─────────────────────────────────────────
  {
    chiefComplaint: 'Palpitations, chest discomfort, feeling faint',
    diagnoses: [
      { name: 'Supraventricular Tachycardia', icdCode: 'I47.1', status: 'ACTIVE', isPrimary: true },
    ],
    vitals: { systolicBP: 118, diastolicBP: 78, heartRate: 148, temperature: 36.7, spO2: 97, respiratoryRate: 18 },
    medications: [],
    allergies: [],
    services: ['CBC'],
  },
  // ── Bradycardia ─────────────────────────────────────────
  {
    chiefComplaint: 'Dizziness, fatigue, fainting episodes',
    diagnoses: [
      { name: 'Sick Sinus Syndrome', icdCode: 'I49.5', status: 'ACTIVE', isPrimary: true },
    ],
    vitals: { systolicBP: 102, diastolicBP: 68, heartRate: 36, temperature: 36.3, spO2: 96, respiratoryRate: 14 },
    medications: [],
    allergies: [],
    services: ['CBC'],
  },
  // ── Pregnancy + Anaemia ─────────────────────────────────
  {
    chiefComplaint: 'Routine antenatal visit — 28 weeks, feeling very tired',
    diagnoses: [
      { name: 'Pregnancy', icdCode: 'Z34.9', status: 'ACTIVE', isPrimary: true },
      { name: 'Iron Deficiency Anaemia', icdCode: 'D50.9', status: 'ACTIVE', isPrimary: false },
    ],
    vitals: { systolicBP: 110, diastolicBP: 70, heartRate: 88, temperature: 36.6, spO2: 98, respiratoryRate: 16, weight: 72 },
    medications: [
      { name: 'Ferrous Sulphate', dosage: '200mg', route: 'Oral', frequency: 'Three times daily' },
      { name: 'Folic Acid', dosage: '5mg', route: 'Oral', frequency: 'Once daily' },
    ],
    allergies: [],
    services: ['CBC', 'UA', 'USS_ABD'],
  },
  // ── Paediatric Malaria ──────────────────────────────────
  {
    chiefComplaint: 'Child with fever, vomiting, refusing food for 2 days',
    diagnoses: [
      { name: 'Malaria', icdCode: 'B54', status: 'ACTIVE', isPrimary: true },
    ],
    vitals: { systolicBP: 95, diastolicBP: 60, heartRate: 120, temperature: 39.5, spO2: 96, respiratoryRate: 26 },
    medications: [
      { name: 'Artemether', dosage: '20mg', route: 'Oral', frequency: 'Twice daily' },
      { name: 'Lumefantrine', dosage: '120mg', route: 'Oral', frequency: 'Twice daily' },
    ],
    allergies: [],
    services: ['MP', 'CBC'],
  },
  // ── Sulfonamide allergy ─────────────────────────────────
  {
    chiefComplaint: 'Burning urination, frequent urination',
    diagnoses: [
      { name: 'Urinary Tract Infection', icdCode: 'N39.0', status: 'ACTIVE', isPrimary: true },
    ],
    vitals: { systolicBP: 122, diastolicBP: 80, heartRate: 84, temperature: 37.3, spO2: 98, respiratoryRate: 16 },
    medications: [
      { name: 'Cotrimoxazole', dosage: '960mg', route: 'Oral', frequency: 'Twice daily' },
    ],
    allergies: [
      { substance: 'Sulfonamide', reaction: 'Severe rash', severity: 'SEVERE', drugClass: 'Sulfonamide' },
    ],
    services: ['UA', 'CBC'],
  },
]

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🏥 Seeding full demo database...\n')

  // ── Create tenants ──────────────────────────────────────
  const novaCare = await prisma.tenant.upsert({
    where: { subdomain: 'novacare' },
    update: {},
    create: {
      facilityName: 'Nova Care Hospital',
      subdomain: 'novacare',
      planTier: 'TIER_2',
      subscriptionStatus: 'ACTIVE',
      licenseExpiresAt: new Date('2027-12-31'),
      eveeEnabled: true,
      themePrimaryColor: '#0EA5E9',
      prioritySupport: false,
    },
  })

  const eudora = await prisma.tenant.upsert({
    where: { subdomain: 'eudora' },
    update: {},
    create: {
      facilityName: 'Eudora Medical Centre',
      subdomain: 'eudora',
      planTier: 'TIER_3',
      subscriptionStatus: 'ACTIVE',
      licenseExpiresAt: new Date('2027-12-31'),
      eveeEnabled: true,
      themePrimaryColor: '#8B5CF6',
      prioritySupport: true,
    },
  })

  console.log(`✅ Tenants: ${novaCare.facilityName}, ${eudora.facilityName}`)

  // ── Create payers per tenant ────────────────────────────
  for (const tenant of [novaCare, eudora]) {
    const payers = [
      { name: 'Self-Pay', type: 'SELF_PAY' as const },
      { name: 'NHIA', type: 'NHIA' as const },
      { name: 'AXA Mansard', type: 'HMO' as const },
    ]

    for (const p of payers) {
      await prisma.payer.upsert({
        where: { tenantId_name: { tenantId: tenant.id, name: p.name } },
        update: {},
        create: { tenantId: tenant.id, name: p.name, type: p.type },
      })
    }
  }

  console.log('💳 Payers created for both tenants')

  // ── Create staff per tenant ─────────────────────────────
  const seedPassword = 'password123'

  const tenantStaffConfigs = [
    {
      tenant: novaCare,
      staff: [
        { firstName: 'Adebola', lastName: 'Ogunleye', email: 'doctor@novacare.com', role: 'DOCTOR' as const, department: 'GENERAL' as const, phone: '+2348051111111', isHOD: false, canVerify: false },
        { firstName: 'Ngozi', lastName: 'Eze', email: 'nurse@novacare.com', role: 'NURSES' as const, department: 'GENERAL' as const, phone: '+2348051111112', isHOD: false, canVerify: false },
        { firstName: 'Ibrahim', lastName: 'Musa', email: 'labtech@novacare.com', role: 'LAB_SCIENTIST' as const, department: 'LABORATORY' as const, phone: '+2348051111113', isHOD: false, canVerify: true },
        { firstName: 'Fatima', lastName: 'Bello', email: 'receptionist@novacare.com', role: 'RECEPTIONIST' as const, department: 'ADMINISTRATION' as const, phone: '+2348051111114', isHOD: false, canVerify: false },
        { firstName: 'Chukwudi', lastName: 'Okonkwo', email: 'admin@novacare.com', role: 'IT_SUPPORT' as const, department: 'ADMINISTRATION' as const, phone: '+2348051111115', isHOD: true, canVerify: true },
        { firstName: 'Folake', lastName: 'Adebayo', email: 'manager@novacare.com', role: 'MANAGER' as const, department: 'ADMINISTRATION' as const, phone: '+2348051111116', isHOD: true, canVerify: false },
      ],
    },
    {
      tenant: eudora,
      staff: [
        { firstName: 'Olumide', lastName: 'Balogun', email: 'doctor@eudora.com', role: 'DOCTOR' as const, department: 'GENERAL' as const, phone: '+2348062222221', isHOD: false, canVerify: false },
        { firstName: 'Chiamaka', lastName: 'Nwachukwu', email: 'nurse@eudora.com', role: 'NURSES' as const, department: 'GENERAL' as const, phone: '+2348062222222', isHOD: false, canVerify: false },
        { firstName: 'Yusuf', lastName: 'Danjuma', email: 'labtech@eudora.com', role: 'LAB_SCIENTIST' as const, department: 'LABORATORY' as const, phone: '+2348062222223', isHOD: false, canVerify: true },
        { firstName: 'Titilayo', lastName: 'Olawale', email: 'radiologist@eudora.com', role: 'IMAGING_TECH' as const, department: 'RADIOLOGY' as const, phone: '+2348062222224', isHOD: false, canVerify: true },
        { firstName: 'Emeka', lastName: 'Obi', email: 'receptionist@eudora.com', role: 'RECEPTIONIST' as const, department: 'ADMINISTRATION' as const, phone: '+2348062222225', isHOD: false, canVerify: false },
        { firstName: 'Aisha', lastName: 'Yakubu', email: 'pharmacist@eudora.com', role: 'PHARMACIST' as const, department: 'PHARMACY' as const, phone: '+2348062222226', isHOD: false, canVerify: false },
        { firstName: 'Babajide', lastName: 'Akintola', email: 'admin@eudora.com', role: 'IT_SUPPORT' as const, department: 'ADMINISTRATION' as const, phone: '+2348062222227', isHOD: true, canVerify: true },
        { firstName: 'Kemi', lastName: 'Oduwole', email: 'manager@eudora.com', role: 'MANAGER' as const, department: 'ADMINISTRATION' as const, phone: '+2348062222228', isHOD: true, canVerify: false },
      ],
    },
  ]

  const allStaff: Record<string, Record<string, any>> = {}

  for (const config of tenantStaffConfigs) {
    const staffByRole: Record<string, any> = {}
    allStaff[config.tenant.subdomain] = staffByRole
    for (const s of config.staff) {
      try {
        const staff = await staffService.createStaff({
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          password: seedPassword,
          role: s.role,
          tenantId: config.tenant.id,
          department: s.department,
          phoneNumber: s.phone,
          isHOD: s.isHOD,
          canVerify: s.canVerify,
        })
        staffByRole[s.role] = staff
      } catch (err: any) {
        if (!err.message.includes('already exists')) {
          console.error(`  ❌ ${s.email}: ${err.message}`)
        }
      }
    }
    console.log(`👥 ${config.tenant.facilityName}: ${config.staff.length} staff created`)
  }

  // ── Create patients with encounters ─────────────────────
  const patientsPerTenant = 25

  for (const config of tenantStaffConfigs) {
    const tenant = config.tenant
    const doctor = allStaff[tenant.subdomain]?.['DOCTOR']
    if (!doctor) continue

    const scenarios = [...SCENARIOS]
    // Duplicate scenarios if needed to reach 25
    while (scenarios.length < patientsPerTenant) {
      scenarios.push(randomFrom(SCENARIOS))
    }

    const payerIds = await prisma.payer.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
    })
    const selfPay = payerIds.find((p) => p.name === 'Self-Pay')
    const nhia = payerIds.find((p) => p.name === 'NHIA')
    const axa = payerIds.find((p) => p.name === 'AXA Mansard')

    for (let i = 0; i < patientsPerTenant; i++) {
      const scenario = scenarios[i] ?? randomFrom(SCENARIOS)
      const isMale = Math.random() > 0.5
      const age = scenario.chiefComplaint.includes('Child') ? 3 + Math.floor(Math.random() * 12)
        : scenario.chiefComplaint.includes('antenatal') ? 22 + Math.floor(Math.random() * 15)
        : scenario.vitals.heartRate! < 40 || scenario.vitals.heartRate! > 130 ? 55 + Math.floor(Math.random() * 30)
        : 20 + Math.floor(Math.random() * 55)

      const firstName = isMale ? randomFrom(FIRST_NAMES_MALE) : randomFrom(FIRST_NAMES_FEMALE)
      const lastName = randomFrom(LAST_NAMES)
      const dob = dobFromAge(age)

      // Assign payer — mix of self-pay, NHIA, AXA
      const payerRoll = Math.random()
      const payerId = payerRoll < 0.4 ? selfPay?.id
        : payerRoll < 0.75 ? nhia?.id
        : axa?.id

      try {
        const patient = await patientService.createPatient({
          firstName,
          lastName,
          gender: isMale ? 'MALE' : 'FEMALE',
          dob: dob.toISOString(),
          phoneNumber: nigerianPhone(),
          tenantId: tenant.id,
          ...(payerId && { payerId }),
        } as any)

        // Create encounter
        const encounter = await encounterService.createEncounter({
          patientId: patient.id,
          attendingStaff: doctor.id,
          type: 'OUTPATIENT',
          chiefComplaint: scenario.chiefComplaint,
          startTime: daysAgo(Math.floor(Math.random() * 30)).toISOString(),
          tenantId: tenant.id,
        } as any)

        // Record vitals
        await vitalService.createVital({
          encounterId: encounter.id,
          patientId: patient.id,
          recordedBy: doctor.id,
          systolicBP: scenario.vitals.systolicBP ?? undefined,
          diastolicBP: scenario.vitals.diastolicBP ?? undefined,
          heartRate: scenario.vitals.heartRate ?? undefined,
          temperature: scenario.vitals.temperature ?? undefined,
          spO2: scenario.vitals.spO2 ?? undefined,
          respiratoryRate: scenario.vitals.respiratoryRate ?? undefined,
          weight: scenario.vitals.weight ?? undefined,
        } as any)

        // Add diagnoses
        for (const dx of scenario.diagnoses) {
          await diagnosisService.createDiagnosis({
            patientId: patient.id,
            encounterId: encounter.id,
            name: dx.name,
            icdCode: dx.icdCode,
            status: dx.status,
            isPrimary: dx.isPrimary,
            diagnosedBy: doctor.id,
            tenantId: tenant.id,
          })
        }

        // Prescribe medications
        const record = await prisma.record.findFirst({
          where: { patientId: patient.id },
        })
        if (record) {
          for (const med of scenario.medications) {
            await medicationService.createMedication({
              recordId: record.id,
              name: med.name,
              dosage: med.dosage,
              route: med.route,
              frequency: med.frequency,
              startDate: daysAgo(Math.floor(Math.random() * 14)).toISOString(),
              prescribedBy: doctor.id,
              tenantId: tenant.id,
            })
          }
        }

        // Record allergies
        for (const allergy of scenario.allergies) {
          await allergyService.createAllergy({
            patientId: patient.id,
            substance: allergy.substance,
            reaction: allergy.reaction,
            severity: allergy.severity,
            recordedBy: doctor.id,
            confirmed: true,
            tenantId: tenant.id,
            ...(allergy.drugClass && { drugClass: allergy.drugClass }),
          })
        }

        // Create orders for services
        const services = await prisma.service.findMany({
          where: {
            tenantId: tenant.id,
            labCode: { in: scenario.services },
          },
        })

        if (services.length > 0) {
          const order = await prisma.order.create({
            data: {
              patientId: patient.id,
              status: 'PENDING',
              services: {
                create: services.map((s) => ({ serviceId: s.id })),
              },
            },
          })

          // Create results for some orders (simulate completed flow)
          if (record && Math.random() > 0.4) {
            for (const svc of services) {
              if (svc.templateId) {
                try {
                  await prisma.result.create({
                    data: {
                      patientId: patient.id,
                      orderId: order.id,
                      recordId: record.id,
                      templateId: svc.templateId,
                      department: svc.category === 'Imaging' ? 'RADIOLOGY' : 'LABORATORY',
                      data: {},
                      status: Math.random() > 0.5 ? 'PENDING' : 'FINALIZED',
                      tenantId: tenant.id,
                    } as any,
                  })
                } catch { /* skip if template validation fails */ }
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`  ❌ Patient ${firstName} ${lastName}: ${err.message}`)
      }
    }

    console.log(`🏥 ${tenant.facilityName}: ${patientsPerTenant} patients created`)
  }

  console.log('\n✅ Full demo database seeded!')
  console.log('📋 Login accounts:')
  console.log('   Nova Care: doctor@novacare.com / password123')
  console.log('   Eudora:   doctor@eudora.com / password123')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
