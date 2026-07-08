import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

import { patientService } from '../src/services/patientService'
import { encounterService } from '../src/services/encounterService'
import { vitalService } from '../src/services/vitalService'
import { diagnosisService } from '../src/services/diagnosisService'
import { medicationService } from '../src/services/medicationService'
import { allergyService } from '../src/services/allergyService'

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({ adapter });



// ── Nigerian name pools ──────────────────────────────────────

const FIRST_NAMES_MALE = [
  'Oluwaseun', 'Chidi', 'Emeka', 'Adebayo', 'Tunde', 'Ibrahim',
  'Chukwudi', 'Obinna', 'Femi', 'Nnamdi', 'Yusuf', 'Segun',
  'Ifeanyi', 'Babatunde', 'Chinedu', 'Opeyemi', 'Dayo', 'Musa',
  'Kunle', 'Uche', 'Okafor', 'Taiwo', 'Kehinde', 'Bolaji', 'Gboyega',
]

const FIRST_NAMES_FEMALE = [
  'Folake', 'Chidinma', 'Ngozi', 'Adesua', 'Titilayo', 'Amina',
  'Chiamaka', 'Obiageli', 'Funke', 'Adaobi', 'Zainab', 'Bimpe',
  'Ifeoma', 'Bose', 'Chioma', 'Temilade', 'Yetunde', 'Fatima',
  'Simisola', 'Nkechi', 'Omolara', 'Kemi', 'Aisha', 'Ronke', 'Buki',
]

const LAST_NAMES = [
  'Okafor', 'Adebayo', 'Okonkwo', 'Musa', 'Oluwole', 'Eze',
  'Balogun', 'Nwachukwu', 'Adamu', 'Olawale', 'Ibrahim', 'Chukwu',
  'Ogunleye', 'Mohammed', 'Obi', 'Akintola', 'Bello', 'Onyeka',
  'Salami', 'Okoro', 'Ezeobi', 'Alabi', 'Danjuma', 'Nwosu', 'Yakubu',
]

// ── Clinical scenario generators ─────────────────────────────

const DOCTOR_ID = 'seed-doctor' // Will resolve to first doctor in DB
const NURSE_ID = 'seed-nurse'

const DRUG_CLASSES: Record<string, string> = {
  'Penicillin': 'Penicillin',
  'Cephalosporin': 'Cephalosporin',
  'Sulfonamide': 'Sulfonamide',
  'NSAID': 'NSAID',
  'Fluoroquinolone': 'Fluoroquinolone',
  'MAOI': 'MAOI',
  'SSRI': 'SSRI',
  'ACEI': 'ACEI',
  'ARB': 'ARB',
  'Statin': 'Statin',
  'LoopDiuretic': 'LoopDiuretic',
  'NonSelectiveBB': 'NonSelectiveBB',
}

interface PatientScenario {
  firstName: string
  lastName: string
  gender: 'MALE' | 'FEMALE'
  age: number
  chiefComplaint: string
  diagnoses: Array<{
    name: string
    icdCode: string
    status: 'ACTIVE' | 'CHRONIC'
    isPrimary: boolean
  }>
  vitals: Record<string, number | null>
  medications: Array<{
    name: string
    dosage: string
    route: string
    frequency: string
  }>
  allergies: Array<{
    substance: string
    reaction: string
    severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING'
    drugClass: string | null
  }>
}

function randomFrom<T>(arr: T[]): T {
  const value = arr[Math.floor(Math.random() * arr.length)]
  if (value === undefined) throw new Error('Cannot choose from an empty array')
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
  const prefix = randomFrom(prefixes)
  const suffix = String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
  return prefix + suffix
}

// ── Scenario definitions ─────────────────────────────────────

function generateScenarios(): PatientScenario[] {
  const scenarios: PatientScenario[] = []

  // ── ALLERGY-001: Direct allergen match ────────────────────
  for (let i = 0; i < 6; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 25 + Math.floor(Math.random() * 40),
      chiefComplaint: 'Fever and cough for 3 days',
      diagnoses: [
        { name: 'Acute Upper Respiratory Infection', icdCode: 'J06.9', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: { systolicBP: 120, diastolicBP: 80, heartRate: 88, temperature: 38.2, spO2: 97, respiratoryRate: 18 },
      medications: [
        { name: 'Amoxicillin', dosage: '500mg', route: 'Oral', frequency: 'Three times daily' },
      ],
      allergies: [
        { substance: 'Penicillin', reaction: 'Anaphylaxis', severity: 'LIFE_THREATENING', drugClass: 'Penicillin' },
      ],
    })
  }

  // ── ALLERGY-002: Penicillin + cephalosporin ───────────────
  for (let i = 0; i < 6; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 20 + Math.floor(Math.random() * 50),
      chiefComplaint: 'Severe sore throat and difficulty swallowing',
      diagnoses: [
        { name: 'Acute Tonsillitis', icdCode: 'J03.9', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: { systolicBP: 118, diastolicBP: 76, heartRate: 92, temperature: 38.8, spO2: 98, respiratoryRate: 16 },
      medications: [
        { name: 'Ceftriaxone', dosage: '1g', route: 'Intravenous', frequency: 'Once daily' },
      ],
      allergies: [
        { substance: 'Penicillin', reaction: 'Urticaria', severity: 'MODERATE', drugClass: 'Penicillin' },
      ],
    })
  }

  // ── ALLERGY-004: NSAID allergy + NSAID prescribed ─────────
  for (let i = 0; i < 6; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 30 + Math.floor(Math.random() * 40),
      chiefComplaint: 'Severe lower back pain after lifting',
      diagnoses: [
        { name: 'Acute Lumbar Strain', icdCode: 'S33.5', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: { systolicBP: 130, diastolicBP: 85, heartRate: 78, temperature: 36.8, spO2: 98, respiratoryRate: 16 },
      medications: [
        { name: 'Diclofenac', dosage: '50mg', route: 'Oral', frequency: 'Twice daily' },
      ],
      allergies: [
        { substance: 'Ibuprofen', reaction: 'Angioedema', severity: 'SEVERE', drugClass: 'NSAID' },
      ],
    })
  }

  // ── DDI-001: Warfarin + NSAID ─────────────────────────────
  for (let i = 0; i < 7; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 55 + Math.floor(Math.random() * 25),
      chiefComplaint: 'Knee pain and swelling for 2 weeks',
      diagnoses: [
        { name: 'Atrial Fibrillation', icdCode: 'I48.91', status: 'CHRONIC', isPrimary: false },
        { name: 'Osteoarthritis of Knee', icdCode: 'M17.9', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: { systolicBP: 140, diastolicBP: 88, heartRate: 82, temperature: 36.5, spO2: 96, respiratoryRate: 17 },
      medications: [
        { name: 'Warfarin', dosage: '5mg', route: 'Oral', frequency: 'Once daily' },
        { name: 'Ibuprofen', dosage: '400mg', route: 'Oral', frequency: 'Twice daily' },
      ],
      allergies: [],
    })
  }

  // ── DDI-003: Metformin + Gentamicin ───────────────────────
  for (let i = 0; i < 6; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 45 + Math.floor(Math.random() * 30),
      chiefComplaint: 'Fever, chills, and burning urination',
      diagnoses: [
        { name: 'Type 2 Diabetes Mellitus', icdCode: 'E11.9', status: 'CHRONIC', isPrimary: false },
        { name: 'Urinary Tract Infection', icdCode: 'N39.0', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: { systolicBP: 135, diastolicBP: 85, heartRate: 95, temperature: 39.1, spO2: 96, respiratoryRate: 20 },
      medications: [
        { name: 'Metformin', dosage: '1000mg', route: 'Oral', frequency: 'Twice daily' },
        { name: 'Gentamicin', dosage: '80mg', route: 'Intravenous', frequency: 'Every 8 hours' },
      ],
      allergies: [],
    })
  }

  // ── DDI-005: ACEI + ARB ───────────────────────────────────
  for (let i = 0; i < 6; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 50 + Math.floor(Math.random() * 30),
      chiefComplaint: 'Routine follow-up for blood pressure',
      diagnoses: [
        { name: 'Essential Hypertension', icdCode: 'I10', status: 'CHRONIC', isPrimary: true },
        { name: 'Chronic Kidney Disease Stage 3', icdCode: 'N18.3', status: 'CHRONIC', isPrimary: false },
      ],
      vitals: { systolicBP: 160, diastolicBP: 100, heartRate: 76, temperature: 36.6, spO2: 97, respiratoryRate: 16 },
      medications: [
        { name: 'Lisinopril', dosage: '20mg', route: 'Oral', frequency: 'Once daily' },
        { name: 'Losartan', dosage: '50mg', route: 'Oral', frequency: 'Once daily' },
      ],
      allergies: [],
    })
  }

  // ── DDI-007: Ciprofloxacin + Antacid ──────────────────────
  for (let i = 0; i < 6; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 30 + Math.floor(Math.random() * 35),
      chiefComplaint: 'Burning stomach pain and diarrhoea',
      diagnoses: [
        { name: 'Peptic Ulcer Disease', icdCode: 'K27.9', status: 'ACTIVE', isPrimary: false },
        { name: 'Bacterial Gastroenteritis', icdCode: 'A09.9', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: { systolicBP: 125, diastolicBP: 82, heartRate: 90, temperature: 37.5, spO2: 97, respiratoryRate: 18 },
      medications: [
        { name: 'Ciprofloxacin', dosage: '500mg', route: 'Oral', frequency: 'Twice daily' },
        { name: 'Calcium Carbonate', dosage: '500mg', route: 'Oral', frequency: 'Three times daily' },
      ],
      allergies: [],
    })
  }

  // ── VITALS-001: Hypertensive Crisis ───────────────────────
  for (let i = 0; i < 6; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 40 + Math.floor(Math.random() * 35),
      chiefComplaint: 'Severe headache and blurred vision',
      diagnoses: [
        { name: 'Hypertensive Emergency', icdCode: 'I16.1', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: { systolicBP: 195, diastolicBP: 115, heartRate: 98, temperature: 36.9, spO2: 96, respiratoryRate: 20 },
      medications: [],
      allergies: [],
    })
  }

  // ── VITALS-002: Hypoxia ───────────────────────────────────
  for (let i = 0; i < 5; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 50 + Math.floor(Math.random() * 35),
      chiefComplaint: 'Difficulty breathing for 2 days',
      diagnoses: [
        { name: 'Pneumonia', icdCode: 'J18.9', status: 'ACTIVE', isPrimary: true },
        { name: 'COPD', icdCode: 'J44.9', status: 'CHRONIC', isPrimary: false },
      ],
      vitals: { systolicBP: 130, diastolicBP: 85, heartRate: 105, temperature: 38.5, spO2: 91, respiratoryRate: 26 },
      medications: [],
      allergies: [],
    })
  }

  // ── VITALS-003: Fever / Hypothermia ───────────────────────
  for (let i = 0; i < 5; i++) {
    const isMale = Math.random() > 0.5
    const isHypothermia = i < 2
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: isHypothermia ? 70 + Math.floor(Math.random() * 20) : 5 + Math.floor(Math.random() * 30),
      chiefComplaint: isHypothermia ? 'Confusion and cold extremities' : 'High fever and chills for 3 days',
      diagnoses: [
        { name: isHypothermia ? 'Hypothermia' : 'Malaria', icdCode: isHypothermia ? 'T68' : 'B54', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: isHypothermia
        ? { systolicBP: 100, diastolicBP: 65, heartRate: 52, temperature: 34.2, spO2: 94, respiratoryRate: 12 }
        : { systolicBP: 115, diastolicBP: 75, heartRate: 110, temperature: 40.1, spO2: 95, respiratoryRate: 22 },
      medications: [],
      allergies: [],
    })
  }

  // ── VITALS-004: Tachycardia / Bradycardia ─────────────────
  for (let i = 0; i < 5; i++) {
    const isMale = Math.random() > 0.5
    const isBrady = i < 2
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: isBrady ? 60 + Math.floor(Math.random() * 25) : 20 + Math.floor(Math.random() * 30),
      chiefComplaint: isBrady ? 'Dizziness and fainting' : 'Palpitations and chest discomfort',
      diagnoses: [
        { name: isBrady ? 'Sick Sinus Syndrome' : 'Supraventricular Tachycardia', icdCode: isBrady ? 'I49.5' : 'I47.1', status: 'ACTIVE', isPrimary: true },
      ],
      vitals: isBrady
        ? { systolicBP: 105, diastolicBP: 70, heartRate: 35, temperature: 36.4, spO2: 96, respiratoryRate: 14 }
        : { systolicBP: 120, diastolicBP: 80, heartRate: 145, temperature: 36.8, spO2: 97, respiratoryRate: 18 },
      medications: [],
      allergies: [],
    })
  }

  // ── HIST-001: NSAID + PUD history ─────────────────────────
  for (let i = 0; i < 6; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 35 + Math.floor(Math.random() * 30),
      chiefComplaint: 'Migraine headache for 2 days',
      diagnoses: [
        { name: 'Migraine', icdCode: 'G43.909', status: 'ACTIVE', isPrimary: true },
        { name: 'Peptic Ulcer Disease', icdCode: 'K27.9', status: 'CHRONIC', isPrimary: false },
      ],
      vitals: { systolicBP: 125, diastolicBP: 82, heartRate: 75, temperature: 36.7, spO2: 98, respiratoryRate: 16 },
      medications: [
        { name: 'Ibuprofen', dosage: '400mg', route: 'Oral', frequency: 'As needed (PRN)' },
      ],
      allergies: [],
    })
  }

  // ── HIST-002: NSAID + Heart Failure ───────────────────────
  for (let i = 0; i < 5; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 55 + Math.floor(Math.random() * 30),
      chiefComplaint: 'Joint pain in both knees',
      diagnoses: [
        { name: 'Osteoarthritis', icdCode: 'M19.90', status: 'ACTIVE', isPrimary: true },
        { name: 'Congestive Heart Failure', icdCode: 'I50.9', status: 'CHRONIC', isPrimary: false },
      ],
      vitals: { systolicBP: 135, diastolicBP: 85, heartRate: 80, temperature: 36.5, spO2: 95, respiratoryRate: 18 },
      medications: [
        { name: 'Diclofenac', dosage: '50mg', route: 'Oral', frequency: 'Twice daily' },
      ],
      allergies: [],
    })
  }

  // ── HIST-003: Tramadol + Epilepsy ─────────────────────────
  for (let i = 0; i < 5; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 25 + Math.floor(Math.random() * 35),
      chiefComplaint: 'Severe lower back pain after accident',
      diagnoses: [
        { name: 'Lumbar Disc Herniation', icdCode: 'M51.26', status: 'ACTIVE', isPrimary: true },
        { name: 'Epilepsy', icdCode: 'G40.909', status: 'CHRONIC', isPrimary: false },
      ],
      vitals: { systolicBP: 122, diastolicBP: 80, heartRate: 76, temperature: 36.6, spO2: 98, respiratoryRate: 16 },
      medications: [
        { name: 'Tramadol', dosage: '50mg', route: 'Oral', frequency: 'Three times daily' },
      ],
      allergies: [],
    })
  }

  // ── HIST-004: Propranolol + Asthma ────────────────────────
  for (let i = 0; i < 5; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 30 + Math.floor(Math.random() * 25),
      chiefComplaint: 'Tremors and palpitations',
      diagnoses: [
        { name: 'Essential Tremor', icdCode: 'G25.0', status: 'ACTIVE', isPrimary: true },
        { name: 'Asthma', icdCode: 'J45.909', status: 'CHRONIC', isPrimary: false },
      ],
      vitals: { systolicBP: 128, diastolicBP: 84, heartRate: 72, temperature: 36.7, spO2: 97, respiratoryRate: 16 },
      medications: [
        { name: 'Propranolol', dosage: '40mg', route: 'Oral', frequency: 'Twice daily' },
      ],
      allergies: [],
    })
  }

  // ── HIST-005: Furosemide + Gout ───────────────────────────
  for (let i = 0; i < 5; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 50 + Math.floor(Math.random() * 30),
      chiefComplaint: 'Swollen ankles and feet',
      diagnoses: [
        { name: 'Heart Failure', icdCode: 'I50.9', status: 'CHRONIC', isPrimary: true },
        { name: 'Gout', icdCode: 'M10.9', status: 'CHRONIC', isPrimary: false },
      ],
      vitals: { systolicBP: 140, diastolicBP: 90, heartRate: 82, temperature: 36.5, spO2: 95, respiratoryRate: 19 },
      medications: [
        { name: 'Furosemide', dosage: '40mg', route: 'Oral', frequency: 'Once daily' },
      ],
      allergies: [],
    })
  }

  // ── Mixed / Complex ───────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const isMale = Math.random() > 0.5
    scenarios.push({
      firstName: randomFrom(isMale ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE),
      lastName: randomFrom(LAST_NAMES),
      gender: isMale ? 'MALE' : 'FEMALE',
      age: 35 + Math.floor(Math.random() * 45),
      chiefComplaint: 'General check-up and medication review',
      diagnoses: [
        { name: 'Type 2 Diabetes Mellitus', icdCode: 'E11.9', status: 'CHRONIC', isPrimary: true },
        { name: 'Essential Hypertension', icdCode: 'I10', status: 'CHRONIC', isPrimary: false },
      ],
      vitals: { systolicBP: 150, diastolicBP: 95, heartRate: 78, temperature: 36.5, spO2: 96, respiratoryRate: 17 },
      medications: [
        { name: 'Metformin', dosage: '500mg', route: 'Oral', frequency: 'Twice daily' },
        { name: 'Lisinopril', dosage: '10mg', route: 'Oral', frequency: 'Once daily' },
        { name: 'Ibuprofen', dosage: '200mg', route: 'Oral', frequency: 'As needed (PRN)' },
      ],
      allergies: [
        { substance: 'Aspirin', reaction: 'Rash', severity: 'MILD', drugClass: 'NSAID' },
      ],
    })
  }

  return scenarios
}

// ── Main seed function ───────────────────────────────────────

async function main() {
  console.log('🌱 Seeding 100 demo patients with EVEE-triggering scenarios...\n')

  // Resolve a real doctor ID for encounters
  const doctor = await prisma.staff.findFirst({
    where: { role: 'DOCTOR' },
    select: { id: true, firstName: true, lastName: true },
  })

  if (!doctor) {
    console.error('❌ No doctor found in database. Seed staff accounts first.')
    process.exit(1)
  }

  console.log(`👨‍⚕️ Using doctor: ${doctor.firstName} ${doctor.lastName} (${doctor.id})\n`)

  const scenarios = generateScenarios()
  let created = 0

  for (const scenario of scenarios) {
    try {
      const dob = dobFromAge(scenario.age)

      // 1. Create patient
      const patient = await patientService.createPatient({
        firstName:   scenario.firstName,
        lastName:    scenario.lastName,
        gender:      scenario.gender,
        dob,
        phoneNumber: nigerianPhone(),
      })

      // 2. Create encounter
      const encounter = await encounterService.createEncounter({
        patientId:      patient.id,
        attendingStaff: doctor.id,
        type:           'OUTPATIENT',
        chiefComplaint: scenario.chiefComplaint,
        startTime:      new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      })

      // 3. Record vitals
      await vitalService.createVital({
        encounterId:     encounter.id,
        patientId:       patient.id,
        recordedBy:      doctor.id,
        systolicBP:      scenario.vitals.systolicBP ?? undefined,
        diastolicBP:     scenario.vitals.diastolicBP ?? undefined,
        heartRate:       scenario.vitals.heartRate ?? undefined,
        temperature:     scenario.vitals.temperature ?? undefined,
        spO2:            scenario.vitals.spO2 ?? undefined,
        respiratoryRate: scenario.vitals.respiratoryRate ?? undefined,
      } as any)

      // 4. Add diagnoses
      for (const dx of scenario.diagnoses) {
        await diagnosisService.createDiagnosis({
          patientId:   patient.id,
          encounterId: encounter.id,
          name:        dx.name,
          icdCode:     dx.icdCode,
          status:      dx.status,
          isPrimary:   dx.isPrimary,
          diagnosedBy: doctor.id,
        })
      }

      // 5. Prescribe medications
      const record = await prisma.record.findFirst({
        where: { patientId: patient.id },
      })

      if (record) {
        for (const med of scenario.medications) {
          await medicationService.createMedication({
            recordId:     record.id,
            name:         med.name,
            dosage:       med.dosage,
            route:        med.route,
            frequency:    med.frequency,
            startDate:    new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString(),
            prescribedBy: doctor.id,
          })
        }
      }

      // 6. Record allergies
      for (const allergy of scenario.allergies) {
        await allergyService.createAllergy({
          patientId:  patient.id,
          substance:  allergy.substance,
          reaction:   allergy.reaction,
          severity:   allergy.severity,
          ...(allergy.drugClass ? { drugClass: allergy.drugClass } : {}),
          recordedBy: doctor.id,
          confirmed:  true,
        })
      }

      created++
      if (created % 10 === 0) {
        console.log(`  ✅ ${created}/100 patients created...`)
      }
    } catch (err: any) {
      console.error(`  ❌ Failed: ${scenario.firstName} ${scenario.lastName} — ${err.message}`)
    }
  }

  console.log(`\n✅ Done. Created ${created} patients with full clinical data.`)
  console.log('📋 EVEE rules triggered across scenarios:')
  console.log('   ALLERGY-001: Direct allergen match (6 patients)')
  console.log('   ALLERGY-002: Penicillin + cephalosporin (6 patients)')
  console.log('   ALLERGY-004: NSAID allergy + NSAID (6 patients)')
  console.log('   DDI-001: Warfarin + NSAID (7 patients)')
  console.log('   DDI-003: Metformin + nephrotoxic (6 patients)')
  console.log('   DDI-005: ACEI + ARB (6 patients)')
  console.log('   DDI-007: Fluoroquinolone + antacid (6 patients)')
  console.log('   VITALS-001: Hypertensive crisis (6 patients)')
  console.log('   VITALS-002: Hypoxia (5 patients)')
  console.log('   VITALS-003: Fever/hypothermia (5 patients)')
  console.log('   VITALS-004: Tachy/bradycardia (5 patients)')
  console.log('   HIST-001: NSAID + PUD (6 patients)')
  console.log('   HIST-002: NSAID + heart failure (5 patients)')
  console.log('   HIST-003: Tramadol + epilepsy (5 patients)')
  console.log('   HIST-004: Propranolol + asthma (5 patients)')
  console.log('   HIST-005: Furosemide + gout (5 patients)')
  console.log('   Mixed complex cases (10 patients)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
