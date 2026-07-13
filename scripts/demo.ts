import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  Department, PrismaClient,
  StaffRole,
  AllergySeverity,
  ResultStatus,
} from "../generated/prisma/client";
import { staffService } from "../src/services/staffService";
import { patientService } from "../src/services/patientService";
import { encounterService } from "../src/services/encounterService";
import { vitalService } from "../src/services/vitalService";
import { diagnosisService } from "../src/services/diagnosisService";
import { medicationService } from "../src/services/medicationService";
import { allergyService } from "../src/services/allergyService";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ── Nigerian name pools ────────────────────────────────────
const FIRST_NAMES_MALE = [
  'Oluwaseun','Chidi','Emeka','Adebayo','Tunde','Ibrahim','Chukwudi','Obinna',
  'Femi','Nnamdi','Yusuf','Segun','Ifeanyi','Babatunde','Chinedu','Opeyemi',
  'Dayo','Musa','Kunle','Uche','Okafor','Taiwo','Kehinde','Bolaji','Gboyega',
  'Tobi','Dapo','Seyi','Wale','Niyi','Tayo','Bayo','Dele','Sola','Lekan',
  'Gbenga','Fola','Wole','Tola','Bisi','Tope','Ayo','Deji','Laolu','Jide',
]
const FIRST_NAMES_FEMALE = [
  'Folake','Chidinma','Ngozi','Adesua','Titilayo','Amina','Chiamaka','Obiageli',
  'Funke','Adaobi','Zainab','Bimpe','Ifeoma','Bose','Chioma','Temilade',
  'Yetunde','Fatima','Simisola','Nkechi','Omolara','Kemi','Aisha','Ronke','Buki',
  'Tolani','Lola','Moji','Efe','Onyinye','Nneka','Uju','Chika','Amara','Ada',
  'Ekaette','Itoro','Eno','Idara','Mfon','Abasi','Aniema','Emediong','Nsikak','Ima',
]
const LAST_NAMES = [
  'Okafor','Adebayo','Okonkwo','Musa','Oluwole','Eze','Balogun','Nwachukwu',
  'Adamu','Olawale','Ibrahim','Chukwu','Ogunleye','Mohammed','Obi','Akintola',
  'Bello','Onyeka','Salami','Okoro','Ezeobi','Alabi','Danjuma','Nwosu','Yakubu',
  'Ajayi','Oduwole','Fashola','Bankole','Lawal','Afolabi','Ojo','Oladipo',
  'Egbuna','Maduka','Udom','Ekong','Bassey','Asari','Tamuno','Okonkwo','Nwankwo',
]

function rand<T>(arr: T[]): T {
  if (arr.length === 0) throw new Error('Cannot pick from an empty array')
  return arr[Math.floor(Math.random() * arr.length)]!
}
function randAge(min: number, max: number) { return min + Math.floor(Math.random() * (max - min + 1)) }
function dobFromAge(age: number): Date {
  const now = new Date(); const y = now.getFullYear() - age;
  return new Date(y, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1)
}
function phone(): string {
  const p = ['0803','0805','0806','0807','0809','0810','0813','0814','0816','0903','0906','0703','0706']
  return rand(p) + String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
}
function daysAgo(d: number): Date { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt }

// ── Extended clinical scenario pool ────────────────────────
interface Scenario {
  chiefComplaint: string
  diagnoses: Array<{ name: string; icd: string; status: 'ACTIVE'|'CHRONIC'|'SUSPECTED'; primary: boolean }>
  vitals: Record<string, number|null>
  meds: Array<{ name: string; dosage: string; route: string; freq: string }>
  allergies: Array<{ sub: string; reaction: string; sev: AllergySeverity; cls: string|null }>
  services: string[]
}

const SCENARIOS: Scenario[] = [
  // 1 – Warfarin + NSAID (DDI-001)
  { chiefComplaint:'Knee pain and swelling, on blood thinners', diagnoses:[
    {name:'Atrial Fibrillation',icd:'I48.91',status:'CHRONIC',primary:false},
    {name:'Osteoarthritis of Knee',icd:'M17.9',status:'ACTIVE',primary:true}
  ], vitals:{systolicBP:142,diastolicBP:86,heartRate:82,temperature:36.4,spO2:96,respiratoryRate:17},
    meds:[{name:'Warfarin',dosage:'5mg',route:'Oral',freq:'Once daily'},{name:'Diclofenac',dosage:'50mg',route:'Oral',freq:'Twice daily'}],
    allergies:[], services:['CBC','UA'] },

  // 2 – ACEI+ARB (DDI-005)
  { chiefComplaint:'Routine BP check – poorly controlled', diagnoses:[
    {name:'Essential Hypertension',icd:'I10',status:'CHRONIC',primary:true},
    {name:'Type 2 Diabetes Mellitus',icd:'E11.9',status:'CHRONIC',primary:false}
  ], vitals:{systolicBP:168,diastolicBP:102,heartRate:78,temperature:36.5,spO2:97,respiratoryRate:16},
    meds:[{name:'Lisinopril',dosage:'20mg',route:'Oral',freq:'Once daily'},{name:'Losartan',dosage:'50mg',route:'Oral',freq:'Once daily'},{name:'Metformin',dosage:'500mg',route:'Oral',freq:'Twice daily'}],
    allergies:[], services:['CBC','UA','LFT'] },

  // 3 – Penicillin allergy + cephalosporin (ALLERGY-002)
  { chiefComplaint:'Severe sore throat, difficulty swallowing', diagnoses:[
    {name:'Acute Tonsillitis',icd:'J03.9',status:'ACTIVE',primary:true}
  ], vitals:{systolicBP:122,diastolicBP:78,heartRate:92,temperature:38.6,spO2:98,respiratoryRate:18},
    meds:[{name:'Ceftriaxone',dosage:'1g',route:'IV',freq:'Once daily'}],
    allergies:[{sub:'Penicillin',reaction:'Anaphylaxis',sev:'LIFE_THREATENING',cls:'Penicillin'}],
    services:['CBC'] },

  // 4 – Metformin + Gentamicin (DDI-003)
  { chiefComplaint:'Fever, burning urination', diagnoses:[
    {name:'Type 2 Diabetes Mellitus',icd:'E11.9',status:'CHRONIC',primary:false},
    {name:'Urinary Tract Infection',icd:'N39.0',status:'ACTIVE',primary:true}
  ], vitals:{systolicBP:134,diastolicBP:84,heartRate:94,temperature:39.2,spO2:96,respiratoryRate:20},
    meds:[{name:'Metformin',dosage:'1000mg',route:'Oral',freq:'Twice daily'},{name:'Gentamicin',dosage:'80mg',route:'IV',freq:'Every 8 hours'}],
    allergies:[], services:['UA','CBC','U&E'] },

  // 5 – Hypertensive crisis (VITALS-001)
  { chiefComplaint:'Severe headache, blurred vision, nosebleed', diagnoses:[
    {name:'Hypertensive Emergency',icd:'I16.1',status:'ACTIVE',primary:true},
    {name:'Chronic Kidney Disease Stage 3',icd:'N18.3',status:'CHRONIC',primary:false}
  ], vitals:{systolicBP:198,diastolicBP:118,heartRate:96,temperature:36.8,spO2:95,respiratoryRate:20},
    meds:[{name:'Amlodipine',dosage:'10mg',route:'Oral',freq:'Once daily'}],
    allergies:[], services:['U&E','CBC','UA'] },

  // 6 – Asthma + Propranolol (HIST-004)
  { chiefComplaint:'Tremors, palpitations, shortness of breath', diagnoses:[
    {name:'Essential Tremor',icd:'G25.0',status:'ACTIVE',primary:true},
    {name:'Asthma',icd:'J45.909',status:'CHRONIC',primary:false}
  ], vitals:{systolicBP:128,diastolicBP:84,heartRate:70,temperature:36.7,spO2:93,respiratoryRate:22},
    meds:[{name:'Propranolol',dosage:'40mg',route:'Oral',freq:'Twice daily'},{name:'Salbutamol',dosage:'100mcg',route:'Inhalation',freq:'PRN'}],
    allergies:[], services:['CBC','XRAY_CHEST'] },

  // 7 – NSAID + PUD history (HIST-001)
  { chiefComplaint:'Migraine headache, epigastric pain', diagnoses:[
    {name:'Migraine',icd:'G43.909',status:'ACTIVE',primary:true},
    {name:'Peptic Ulcer Disease',icd:'K27.9',status:'CHRONIC',primary:false}
  ], vitals:{systolicBP:124,diastolicBP:80,heartRate:76,temperature:36.5,spO2:98,respiratoryRate:16},
    meds:[{name:'Ibuprofen',dosage:'400mg',route:'Oral',freq:'PRN'},{name:'Omeprazole',dosage:'20mg',route:'Oral',freq:'Once daily'}],
    allergies:[], services:['CBC'] },

  // 8 – NSAID + Heart failure (HIST-002)
  { chiefComplaint:'Joint pain both knees, ankle swelling', diagnoses:[
    {name:'Osteoarthritis',icd:'M19.90',status:'ACTIVE',primary:true},
    {name:'Congestive Heart Failure',icd:'I50.9',status:'CHRONIC',primary:false}
  ], vitals:{systolicBP:138,diastolicBP:88,heartRate:82,temperature:36.5,spO2:94,respiratoryRate:19},
    meds:[{name:'Diclofenac',dosage:'50mg',route:'Oral',freq:'Twice daily'},{name:'Furosemide',dosage:'40mg',route:'Oral',freq:'Once daily'}],
    allergies:[], services:['CBC','UA','U&E'] },

  // 9 – Tramadol + Epilepsy (HIST-003)
  { chiefComplaint:'Severe lower back pain radiating to leg', diagnoses:[
    {name:'Lumbar Disc Herniation',icd:'M51.26',status:'ACTIVE',primary:true},
    {name:'Epilepsy',icd:'G40.909',status:'CHRONIC',primary:false}
  ], vitals:{systolicBP:126,diastolicBP:82,heartRate:74,temperature:36.6,spO2:98,respiratoryRate:16},
    meds:[{name:'Tramadol',dosage:'50mg',route:'Oral',freq:'Three times daily'},{name:'Carbamazepine',dosage:'200mg',route:'Oral',freq:'Twice daily'}],
    allergies:[], services:['XRAY_CHEST','CBC'] },

  // 10 – Furosemide + Gout (HIST-005)
  { chiefComplaint:'Swollen, red, painful big toe', diagnoses:[
    {name:'Heart Failure',icd:'I50.9',status:'CHRONIC',primary:true},
    {name:'Gout',icd:'M10.9',status:'ACTIVE',primary:false}
  ], vitals:{systolicBP:142,diastolicBP:90,heartRate:84,temperature:37.1,spO2:95,respiratoryRate:18},
    meds:[{name:'Furosemide',dosage:'40mg',route:'Oral',freq:'Once daily'},{name:'Allopurinol',dosage:'300mg',route:'Oral',freq:'Once daily'}],
    allergies:[], services:['CBC','U&E','UA'] },

  // 11 – Ciprofloxacin + Antacid (DDI-007)
  { chiefComplaint:'Watery diarrhoea, stomach cramps', diagnoses:[
    {name:'Bacterial Gastroenteritis',icd:'A09.9',status:'ACTIVE',primary:true},
    {name:'Gastritis',icd:'K29.7',status:'ACTIVE',primary:false}
  ], vitals:{systolicBP:120,diastolicBP:78,heartRate:92,temperature:37.6,spO2:97,respiratoryRate:18},
    meds:[{name:'Ciprofloxacin',dosage:'500mg',route:'Oral',freq:'Twice daily'},{name:'Calcium Carbonate',dosage:'500mg',route:'Oral',freq:'Three times daily'}],
    allergies:[], services:['CBC','UA'] },

  // 12 – Pneumonia + COPD (hypoxia VITALS-002)
  { chiefComplaint:'Difficulty breathing, productive cough, fever', diagnoses:[
    {name:'Pneumonia',icd:'J18.9',status:'ACTIVE',primary:true},
    {name:'COPD',icd:'J44.9',status:'CHRONIC',primary:false}
  ], vitals:{systolicBP:132,diastolicBP:84,heartRate:108,temperature:38.9,spO2:90,respiratoryRate:28},
    meds:[{name:'Amoxicillin',dosage:'500mg',route:'Oral',freq:'Three times daily'},{name:'Prednisolone',dosage:'30mg',route:'Oral',freq:'Once daily'}],
    allergies:[], services:['CBC','XRAY_CHEST','MP'] },

  // 13 – Tachycardia (VITALS-004)
  { chiefComplaint:'Palpitations, chest discomfort, feeling faint', diagnoses:[
    {name:'Supraventricular Tachycardia',icd:'I47.1',status:'ACTIVE',primary:true}
  ], vitals:{systolicBP:118,diastolicBP:78,heartRate:148,temperature:36.7,spO2:97,respiratoryRate:18},
    meds:[], allergies:[], services:['CBC','U&E'] },

  // 14 – Bradycardia (VITALS-004)
  { chiefComplaint:'Dizziness, fatigue, fainting episodes', diagnoses:[
    {name:'Sick Sinus Syndrome',icd:'I49.5',status:'ACTIVE',primary:true}
  ], vitals:{systolicBP:102,diastolicBP:68,heartRate:36,temperature:36.3,spO2:96,respiratoryRate:14},
    meds:[], allergies:[], services:['CBC'] },

  // 15 – Pregnancy + Iron Deficiency Anaemia
  { chiefComplaint:'28 weeks pregnant, extreme fatigue', diagnoses:[
    {name:'Pregnancy',icd:'Z34.9',status:'ACTIVE',primary:true},
    {name:'Iron Deficiency Anaemia',icd:'D50.9',status:'ACTIVE',primary:false}
  ], vitals:{systolicBP:110,diastolicBP:70,heartRate:88,temperature:36.6,spO2:98,respiratoryRate:16,weight:72},
    meds:[{name:'Ferrous Sulphate',dosage:'200mg',route:'Oral',freq:'Three times daily'},{name:'Folic Acid',dosage:'5mg',route:'Oral',freq:'Once daily'}],
    allergies:[], services:['CBC','UA','USS_ABD'] },

  // 16 – Paediatric Malaria
  { chiefComplaint:'Child with fever, vomiting, refusing food', diagnoses:[
    {name:'Malaria',icd:'B54',status:'ACTIVE',primary:true}
  ], vitals:{systolicBP:95,diastolicBP:60,heartRate:120,temperature:39.5,spO2:96,respiratoryRate:26},
    meds:[{name:'Artemether',dosage:'20mg',route:'Oral',freq:'Twice daily'},{name:'Lumefantrine',dosage:'120mg',route:'Oral',freq:'Twice daily'}],
    allergies:[], services:['MP','CBC'] },

  // 17 – Sulfonamide allergy (ALLERGY-003)
  { chiefComplaint:'Burning urination, frequent urination', diagnoses:[
    {name:'Urinary Tract Infection',icd:'N39.0',status:'ACTIVE',primary:true}
  ], vitals:{systolicBP:122,diastolicBP:80,heartRate:84,temperature:37.3,spO2:98,respiratoryRate:16},
    meds:[{name:'Cotrimoxazole',dosage:'960mg',route:'Oral',freq:'Twice daily'}],
    allergies:[{sub:'Sulfonamide',reaction:'Severe rash',sev:'SEVERE',cls:'Sulfonamide'}],
    services:['UA','CBC'] },

  // 18 – Diabetes + Hypertension + Obesity (complex metabolic)
  { chiefComplaint:'Routine follow-up, feeling tired, weight gain', diagnoses:[
    {name:'Type 2 Diabetes Mellitus',icd:'E11.9',status:'CHRONIC',primary:true},
    {name:'Essential Hypertension',icd:'I10',status:'CHRONIC',primary:false},
    {name:'Obesity',icd:'E66.9',status:'CHRONIC',primary:false}
  ], vitals:{systolicBP:155,diastolicBP:95,heartRate:80,temperature:36.8,spO2:97,respiratoryRate:18,weight:105},
    meds:[{name:'Metformin',dosage:'850mg',route:'Oral',freq:'Twice daily'},{name:'Lisinopril',dosage:'10mg',route:'Oral',freq:'Once daily'},{name:'Atorvastatin',dosage:'20mg',route:'Oral',freq:'Once daily'}],
    allergies:[], services:['CBC','LFT','LIPID','UA'] },

  // 19 – Multiple allergies (NSAID + Penicillin) + on both
  { chiefComplaint:'Fever, body aches, sore throat', diagnoses:[
    {name:'Acute Upper Respiratory Infection',icd:'J06.9',status:'ACTIVE',primary:true}
  ], vitals:{systolicBP:120,diastolicBP:78,heartRate:88,temperature:38.4,spO2:98,respiratoryRate:16},
    meds:[{name:'Amoxicillin',dosage:'500mg',route:'Oral',freq:'Three times daily'},{name:'Ibuprofen',dosage:'400mg',route:'Oral',freq:'Three times daily'}],
    allergies:[{sub:'Penicillin',reaction:'Urticaria',sev:'MODERATE',cls:'Penicillin'},{sub:'Aspirin',reaction:'Angioedema',sev:'SEVERE',cls:'NSAID'}],
    services:['CBC','MP'] },

  // 20 – Geriatric polypharmacy
  { chiefComplaint:'Confusion, falls, multiple medications', diagnoses:[
    {name:'Dementia',icd:'F03.90',status:'CHRONIC',primary:true},
    {name:'Hypertension',icd:'I10',status:'CHRONIC',primary:false},
    {name:'Osteoarthritis',icd:'M19.90',status:'CHRONIC',primary:false},
    {name:'Insomnia',icd:'G47.00',status:'ACTIVE',primary:false}
  ], vitals:{systolicBP:148,diastolicBP:88,heartRate:72,temperature:36.2,spO2:95,respiratoryRate:16},
    meds:[{name:'Amlodipine',dosage:'5mg',route:'Oral',freq:'Once daily'},{name:'Diazepam',dosage:'5mg',route:'Oral',freq:'At bedtime'},{name:'Paracetamol',dosage:'1g',route:'Oral',freq:'PRN'},{name:'Aspirin',dosage:'75mg',route:'Oral',freq:'Once daily'}],
    allergies:[], services:['CBC','U&E','LFT','XRAY_CHEST'] },
]

// ── Services definition ────────────────────────────────────
const SERVICES_DEF = [
  { name:'Complete Blood Count', code:'CBC', cat:'Hematology', price:5000, tplIdx:0 },
  { name:'Malaria Parasite Test', code:'MP', cat:'Parasitology', price:3000, tplIdx:1 },
  { name:'Urinalysis', code:'UA', cat:'Chemistry', price:4000, tplIdx:2 },
  { name:'Liver Function Test', code:'LFT', cat:'Chemistry', price:8000, tplIdx:3 },
  { name:'Urea & Electrolytes', code:'U&E', cat:'Chemistry', price:6000, tplIdx:4 },
  { name:'Lipid Profile', code:'LIPID', cat:'Chemistry', price:7000, tplIdx:5 },
  { name:'Blood Glucose', code:'BG', cat:'Chemistry', price:2000, tplIdx:6 },
  { name:'Widal Test', code:'WIDAL', cat:'Serology', price:3500, tplIdx:7 },
  { name:'H. pylori Test', code:'HPYL', cat:'Serology', price:4000, tplIdx:8 },
  { name:'CD4 Count', code:'CD4', cat:'Immunology', price:12000, tplIdx:9 },
  { name:'Chest X-Ray', code:'XRAY_CHEST', cat:'Imaging', price:10000, tplIdx:10 },
  { name:'Abdominal Ultrasound', code:'USS_ABD', cat:'Imaging', price:15000, tplIdx:11 },
  { name:'CT Scan Head', code:'CT_HEAD', cat:'Imaging', price:45000, tplIdx:12 },
  { name:'MRI Lumbar Spine', code:'MRI_LS', cat:'Imaging', price:85000, tplIdx:13 },
  { name:'ECG', code:'ECG', cat:'Cardiology', price:5000, tplIdx:14 },
]

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('🏥 Seeding stress-test demo database...\n')
  const seedPassword = 'password123'

  // =========================
  // TENANTS
  // =========================
  const tenants = await Promise.all([
    prisma.tenant.upsert({ where:{subdomain:'novacare'}, update:{}, create:{
      facilityName:'Nova Care Hospital', subdomain:'novacare', planTier:'TIER_2',
      subscriptionStatus:'ACTIVE', licenseExpiresAt:new Date('2027-12-31'),
      eveeEnabled:true, themePrimaryColor:'#0EA5E9', logoUrl:'/novacare-logo.svg'
    }}),
    prisma.tenant.upsert({ where:{subdomain:'eudora'}, update:{}, create:{
      facilityName:'Eudora Medical Centre', subdomain:'eudora', planTier:'TIER_3',
      subscriptionStatus:'ACTIVE', licenseExpiresAt:new Date('2027-12-31'),
      eveeEnabled:true, themePrimaryColor:'#8B5CF6', logoUrl:'/eudora-logo.svg'
    }}),
  ])
  console.log(`✅ Tenants: ${tenants.map(t=>t.facilityName).join(', ')}`)

  // =========================
  // STAFF PER TENANT
  // =========================
  const staffDefs = [
    { fn:'Admin', ln:'User', role:'ADMIN' as const, dept:'ADMINISTRATION' as const, h:true, v:true },
    { fn:'Manager', ln:'One', role:'MANAGER' as const, dept:'ADMINISTRATION' as const, h:true, v:false },
    { fn:'Doctor', ln:'One', role:'DOCTOR' as const, dept:'GENERAL' as const, h:false, v:false },
    { fn:'Nurse', ln:'One', role:'NURSES' as const, dept:'GENERAL' as const, h:false, v:false },
    { fn:'Lab', ln:'Scientist A', role:'LAB_SCIENTIST' as const, dept:'LABORATORY' as const, h:false, v:true },
    { fn:'Lab', ln:'Scientist B', role:'LAB_SCIENTIST' as const, dept:'LABORATORY' as const, h:false, v:true },
    { fn:'Imaging', ln:'Tech A', role:'IMAGING_TECH' as const, dept:'RADIOLOGY' as const, h:false, v:true },
    { fn:'Imaging', ln:'Tech B', role:'IMAGING_TECH' as const, dept:'RADIOLOGY' as const, h:false, v:true },
    { fn:'Pharmacist', ln:'One', role:'PHARMACIST' as const, dept:'PHARMACY' as const, h:false, v:false },
    { fn:'Receptionist', ln:'One', role:'RECEPTIONIST' as const, dept:'ADMINISTRATION' as const, h:false, v:false },
    { fn:'Billing', ln:'Officer', role:'BILLING_OFFICER' as const, dept:'ADMINISTRATION' as const, h:false, v:false },
    { fn:'HIM', ln:'Officer', role:'HIM_OFFICER' as const, dept:'ADMINISTRATION' as const, h:true, v:false },
    { fn:'Procurement', ln:'Officer', role:'PROCUREMENT_OFFICER' as const, dept:'ADMINISTRATION' as const, h:false, v:false },
    { fn:'IT', ln:'Support', role:'IT_SUPPORT' as const, dept:'ADMINISTRATION' as const, h:false, v:false },
  ]

  const allStaff: Record<string, Record<string, any>> = {}
  for (const tenant of tenants) {
    allStaff[tenant.subdomain] = {}
    const tenantStaff = allStaff[tenant.subdomain]!
    for (const s of staffDefs) {
      const email = `${s.fn.toLowerCase()}.${s.ln.toLowerCase().replace(/\s/g,'')}@${tenant.subdomain}.com`
      try {
        const st = await staffService.createStaff({
          firstName:s.fn, lastName:s.ln, email, password:seedPassword, role:s.role,
          tenantId:tenant.id, department:s.dept as Department,
          phoneNumber:phone(), isHOD:s.h, canVerify:s.v,
        })
        tenantStaff[s.role] = st
        if (!tenantStaff[s.role+'_2']) tenantStaff[s.role+'_2'] = st
        if (s.fn.includes('B')) tenantStaff[s.role+'_b'] = st
        if (s.fn.includes('A')) tenantStaff[s.role+'_a'] = st
      } catch(e:any){ if(!e.message.includes('already exists')) console.error(`  ❌ ${email}: ${e.message}`) }
    }
    console.log(`  👥 ${tenant.facilityName}: staff created`)
  }

  // =========================
  // TEMPLATES + SERVICES + PAYERS
  // =========================
  for (const tenant of tenants) {
    // Payers
    for (const p of [{name:'Self-Pay',type:'SELF_PAY' as const},{name:'NHIA',type:'NHIA' as const},{name:'AXA Mansard',type:'HMO' as const}]) {
      await prisma.payer.upsert({ where:{tenantId_name:{tenantId:tenant.id,name:p.name}}, update:{}, create:{tenantId:tenant.id,name:p.name,type:p.type} })
    }
    // Permissions
    const perms = [
      {k:'allowOrderTest',r:[StaffRole.DOCTOR,StaffRole.NURSES,StaffRole.ADMIN]},
      {k:'allowRecordVitalsWithoutActiveEncounter',r:[StaffRole.DOCTOR,StaffRole.NURSES,StaffRole.ADMIN]},
      {k:'allowViewDiagnoses',r:[StaffRole.DOCTOR,StaffRole.ADMIN]},
      {k:'requireDoctorCosignOnPrescription',r:[]},
      {k:'allowViewOrderStatus',r:[StaffRole.BILLING_OFFICER]},
      {k:'allowCreateRequests',r:[StaffRole.DOCTOR,StaffRole.NURSES,StaffRole.LAB_SCIENTIST,StaffRole.IMAGING_TECH,StaffRole.PHARMACIST,StaffRole.RECEPTIONIST,StaffRole.BILLING_OFFICER,StaffRole.HIM_OFFICER,StaffRole.PROCUREMENT_OFFICER,StaffRole.ADMIN,StaffRole.MANAGER]},
      {k:'allowApproveRequests',r:[StaffRole.ADMIN,StaffRole.MANAGER,StaffRole.BILLING_OFFICER]},
      {k:'allowManageInventory',r:[StaffRole.PROCUREMENT_OFFICER,StaffRole.ADMIN,StaffRole.MANAGER]},
      {k:'allowViewAuditLogs',r:[StaffRole.HIM_OFFICER,StaffRole.ADMIN,StaffRole.MANAGER]},
      {k:'allowExportRecords',r:[StaffRole.HIM_OFFICER,StaffRole.ADMIN,StaffRole.DOCTOR]},
    ]
    for (const p of perms) {
      await prisma.tenantPermission.upsert({ where:{tenantId_permissionKey:{tenantId:tenant.id,permissionKey:p.k}}, update:{}, create:{tenantId:tenant.id,permissionKey:p.k,allowedRoles:p.r,updatedBy:'seed'} })
    }

    // Templates (15)
    const tpls = [
      { name:'CBC Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Red Cells',collapsible:false,fields:[{id:'hb',key:'haemoglobin',label:'Haemoglobin',type:'numeric',unit:'g/dL',required:true,referenceRange:{general:{min:12,max:16}}},{id:'rbc',key:'rbc',label:'RBC Count',type:'numeric',unit:'×10¹²/L',required:true,referenceRange:{general:{min:4.5,max:5.9}}}]},{id:'g2',label:'White Cells',collapsible:false,fields:[{id:'wbc',key:'wbc',label:'WBC Count',type:'numeric',unit:'×10⁹/L',required:true,referenceRange:{general:{min:4,max:11}}}]},{id:'g3',label:'Platelets',collapsible:false,fields:[{id:'plt',key:'platelets',label:'Platelet Count',type:'numeric',unit:'×10⁹/L',required:true,referenceRange:{general:{min:150,max:450}}}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'Malaria Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Result',collapsible:false,fields:[{id:'mp_res',key:'mp_result',label:'Result',type:'select',required:true,options:['Negative','Positive - P. falciparum','Positive - P. vivax','Positive - P. malariae','Positive - P. ovale','Positive - Mixed','Inconclusive']},{id:'mp_den',key:'parasite_density',label:'Parasite Density',type:'select',options:['Not applicable','+','++','+++','++++']},{id:'mp_gam',key:'gametocytes',label:'Gametocytes Seen',type:'boolean'},{id:'mp_met',key:'method',label:'Method',type:'select',required:true,options:['Thick & Thin Film Microscopy','RDT','Both']}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'Urinalysis Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Physical',collapsible:false,fields:[{id:'ua_col',key:'color',label:'Color',type:'text',required:true},{id:'ua_app',key:'appearance',label:'Appearance',type:'text'},{id:'ua_ph',key:'ph',label:'pH',type:'numeric',referenceRange:{general:{min:4.5,max:8}}},{id:'ua_sg',key:'specific_gravity',label:'Specific Gravity',type:'numeric',referenceRange:{general:{min:1.005,max:1.030}}}]},{id:'g2',label:'Chemical',collapsible:false,fields:[{id:'ua_pro',key:'protein',label:'Protein',type:'text'},{id:'ua_glu',key:'glucose',label:'Glucose',type:'text'},{id:'ua_ket',key:'ketones',label:'Ketones',type:'text'},{id:'ua_bld',key:'blood',label:'Blood',type:'text'}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'LFT Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Liver Panel',collapsible:false,fields:[{id:'lft_alt',key:'alt',label:'ALT',type:'numeric',unit:'U/L',required:true,referenceRange:{male:{min:7,max:56},female:{min:7,max:45}}},{id:'lft_ast',key:'ast',label:'AST',type:'numeric',unit:'U/L',required:true,referenceRange:{male:{min:10,max:40},female:{min:10,max:35}}},{id:'lft_alb',key:'albumin',label:'Albumin',type:'numeric',unit:'g/dL',required:true,referenceRange:{general:{min:3.5,max:5.0}}},{id:'lft_tb',key:'total_bilirubin',label:'Total Bilirubin',type:'numeric',unit:'mg/dL',required:true,referenceRange:{general:{min:0.1,max:1.2}}}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'U&E Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Electrolytes',collapsible:false,fields:[{id:'ue_na',key:'sodium',label:'Sodium',type:'numeric',unit:'mmol/L',required:true,referenceRange:{general:{min:136,max:145}}},{id:'ue_k',key:'potassium',label:'Potassium',type:'numeric',unit:'mmol/L',required:true,referenceRange:{general:{min:3.5,max:5.0}}},{id:'ue_creat',key:'creatinine',label:'Creatinine',type:'numeric',unit:'μmol/L',required:true,referenceRange:{male:{min:62,max:115},female:{min:53,max:97}}},{id:'ue_urea',key:'urea',label:'Urea',type:'numeric',unit:'mmol/L',required:true,referenceRange:{general:{min:2.5,max:7.5}}}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'Lipid Profile Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Lipids',collapsible:false,fields:[{id:'lip_tc',key:'total_cholesterol',label:'Total Cholesterol',type:'numeric',unit:'mmol/L',required:true,referenceRange:{general:{min:0,max:5.2}}},{id:'lip_hdl',key:'hdl',label:'HDL',type:'numeric',unit:'mmol/L',required:true,referenceRange:{male:{min:1.0,max:99},female:{min:1.3,max:99}}},{id:'lip_tg',key:'triglycerides',label:'Triglycerides',type:'numeric',unit:'mmol/L',required:true,referenceRange:{general:{min:0,max:1.7}}}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'Blood Glucose Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Glucose',collapsible:false,fields:[{id:'bg_type',key:'glucose_type',label:'Sample Type',type:'select',required:true,options:['Fasting','Random','2-hour Post-prandial']},{id:'bg_val',key:'glucose',label:'Glucose',type:'numeric',unit:'mmol/L',required:true,referenceRange:{general:{min:3.9,max:7.8}}}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'Widal Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Widal',collapsible:false,fields:[{id:'wid_to',key:'to_titre',label:'TO Titre',type:'select',required:true,options:['Negative','1:20','1:40','1:80','1:160','1:320']},{id:'wid_th',key:'th_titre',label:'TH Titre',type:'select',required:true,options:['Negative','1:20','1:40','1:80','1:160','1:320']}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'H. pylori Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'Result',collapsible:false,fields:[{id:'hpy_res',key:'hpylori_result',label:'Result',type:'select',required:true,options:['Negative','Positive']},{id:'hpy_met',key:'method',label:'Method',type:'select',required:true,options:['Serology','Stool Antigen','Urea Breath Test']}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'CD4 Template', dept:'LABORATORY' as const, schema:{groups:[{id:'g1',label:'CD4',collapsible:false,fields:[{id:'cd4_cnt',key:'cd4_count',label:'CD4 Count',type:'numeric',unit:'cells/µL',required:true,referenceRange:{general:{min:500,max:1500}}},{id:'cd4_pct',key:'cd4_percent',label:'CD4%',type:'numeric',unit:'%',required:false}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'Chest X-Ray Template', dept:'RADIOLOGY' as const, schema:{groups:[{id:'g1',label:'Report',collapsible:false,fields:[{id:'cxr_view',key:'view',label:'View',type:'select',required:true,options:['PA','AP','Lateral','PA+Lateral']},{id:'cxr_find',key:'findings',label:'Findings',type:'richtext',required:true},{id:'cxr_imp',key:'impression',label:'Impression',type:'richtext',required:true},{id:'cxr_img',key:'chest_xray_image',label:'X-Ray Image',type:'image',required:false}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'Abdominal Ultrasound Template', dept:'RADIOLOGY' as const, schema:{groups:[{id:'g1',label:'Report',collapsible:false,fields:[{id:'uss_reg',key:'region',label:'Region',type:'select',required:true,options:['Abdomen','Pelvis','Abdomen+Pelvis','Renal','Obstetric']},{id:'uss_find',key:'findings',label:'Findings',type:'richtext',required:true},{id:'uss_imp',key:'impression',label:'Impression',type:'richtext',required:true},{id:'uss_img',key:'ultrasound_image',label:'Ultrasound Image',type:'image',required:false}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'CT Scan Template', dept:'RADIOLOGY' as const, schema:{groups:[{id:'g1',label:'Report',collapsible:false,fields:[{id:'ct_reg',key:'region',label:'Region',type:'text',required:true},{id:'ct_find',key:'findings',label:'Findings',type:'richtext',required:true},{id:'ct_imp',key:'impression',label:'Impression',type:'richtext',required:true},{id:'ct_img',key:'ct_image',label:'CT Image',type:'image',required:false}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'MRI Template', dept:'RADIOLOGY' as const, schema:{groups:[{id:'g1',label:'Report',collapsible:false,fields:[{id:'mri_reg',key:'region',label:'Region',type:'text',required:true},{id:'mri_find',key:'findings',label:'Findings',type:'richtext',required:true},{id:'mri_imp',key:'impression',label:'Impression',type:'richtext',required:true},{id:'mri_img',key:'mri_image',label:'MRI Image',type:'image',required:false}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
      { name:'ECG Template', dept:'CARDIOLOGY' as const, schema:{groups:[{id:'g1',label:'ECG',collapsible:false,fields:[{id:'ecg_rate',key:'heart_rate',label:'Heart Rate',type:'numeric',unit:'bpm',required:true},{id:'ecg_rhythm',key:'rhythm',label:'Rhythm',type:'select',required:true,options:['Sinus','Atrial Fibrillation','Atrial Flutter','SVT','Ventricular Tachycardia','Sinus Bradycardia','Sinus Tachycardia','Other']},{id:'ecg_find',key:'findings',label:'Findings',type:'richtext',required:true},{id:'ecg_imp',key:'impression',label:'Impression',type:'richtext',required:true}]}],interpretation:{enabled:true},signature:{required:true,roles:['HOD','DOCTOR']}} },
    ]
    const createdTpls: any[] = []
    for (const t of tpls) {
      const tpl = await prisma.template.upsert({
        where:{name:t.name},
        update:{},
        create:{name:t.name,type:t.dept==='RADIOLOGY'?'IMAGING':'LAB',department:t.dept as Department,dataSchema:t.schema,tenantId:tenant.id,createdBy:'seed'}
      })
      createdTpls.push(tpl)
    }
    // Services
    for (let i=0;i<SERVICES_DEF.length;i++) {
      const s = SERVICES_DEF[i]!
      const template = createdTpls[s.tplIdx]
      if (!template) throw new Error(`Missing template for ${s.code}`)
      await prisma.service.upsert({
        where:{labCode:s.code},
        update:{},
        create:{name:s.name,labCode:s.code,category:s.cat,price:s.price,tenantId:tenant.id,templateId:template.id}
      })
    }
    console.log(`  📋 ${tenant.facilityName}: 15 services + templates`)
  }

  // =========================
  // PATIENTS (50 per tenant)
  // =========================
  for (const tenant of tenants) {
    const tenantStaff = allStaff[tenant.subdomain]!
    const doctor = tenantStaff['DOCTOR']
    if (!doctor) throw new Error(`Missing doctor for ${tenant.subdomain}`)
    const payers = await prisma.payer.findMany({where:{tenantId:tenant.id}})
    const selfPay = payers.find(p=>p.name==='Self-Pay')!
    const nhia = payers.find(p=>p.name==='NHIA')!
    const axa = payers.find(p=>p.name==='AXA Mansard')!
    const services = await prisma.service.findMany({where:{tenantId:tenant.id}})

    for (let i=0;i<50;i++) {
      const scenario = SCENARIOS[i % SCENARIOS.length]!
      const isMale = Math.random() > 0.5
      const isPaediatric = scenario.chiefComplaint.includes('Child')
      const isPregnant = scenario.chiefComplaint.includes('pregnant')
      const isGeriatric = scenario.chiefComplaint.includes('Confusion') || scenario.vitals.heartRate! < 40
      const age = isPaediatric ? randAge(1,12) : isPregnant ? randAge(20,38) : isGeriatric ? randAge(65,85) : randAge(18,64)
      const fn = isMale ? rand(FIRST_NAMES_MALE) : rand(FIRST_NAMES_FEMALE)
      const ln = rand(LAST_NAMES)
      const payer = Math.random()<0.35 ? selfPay : Math.random()<0.7 ? nhia : axa

      try {
        // Create patient
        const patient = await patientService.createPatient({
          firstName:fn, lastName:ln, gender:isMale?'MALE':'FEMALE',
          dob:dobFromAge(age).toISOString(), phoneNumber:phone(),
          tenantId:tenant.id, payerId:payer.id,
        } as any)

        // Create encounter
        const enc = await encounterService.createEncounter({
          patientId:patient.id, attendingStaff:doctor.id, type:'OUTPATIENT',
          chiefComplaint:scenario.chiefComplaint,
          startTime:daysAgo(Math.floor(Math.random()*30)).toISOString(),
          tenantId:tenant.id,
        } as any)

        // Record vitals
        await vitalService.createVital({
          encounterId:enc.id, patientId:patient.id, recordedBy:doctor.id,
          systolicBP:scenario.vitals.systolicBP??undefined,
          diastolicBP:scenario.vitals.diastolicBP??undefined,
          heartRate:scenario.vitals.heartRate??undefined,
          temperature:scenario.vitals.temperature??undefined,
          spO2:scenario.vitals.spO2??undefined,
          respiratoryRate:scenario.vitals.respiratoryRate??undefined,
          weight:scenario.vitals.weight??undefined,
        } as any)

        // Add diagnoses
        for (const dx of scenario.diagnoses) {
          await diagnosisService.createDiagnosis({
            patientId:patient.id, encounterId:enc.id,
            name:dx.name, icdCode:dx.icd, status:dx.status, isPrimary:dx.primary,
            diagnosedBy:doctor.id,
            tenantId:tenant.id,
          })
        }

        // Prescribe medications
        const record = await prisma.record.findFirst({where:{patientId:patient.id}})
        if (record) {
          for (const med of scenario.meds) {
            await medicationService.createMedication({
              recordId:record.id, name:med.name, dosage:med.dosage,
              route:med.route, frequency:med.freq,
              startDate:daysAgo(Math.floor(Math.random()*14)).toISOString(),
              prescribedBy:doctor.id,
              tenantId:tenant.id,
            })
          }
        }

        // Record allergies
        for (const all of scenario.allergies) {
          await allergyService.createAllergy({
            patientId:patient.id, substance:all.sub, reaction:all.reaction,
            severity:all.sev, drugClass:all.cls ?? '', recordedBy:doctor.id, confirmed:true,
            tenantId:tenant.id,
          })
        }

        // Create orders with results
        const svcList = scenario.services
          .map((code)=>services.find(s=>s.labCode===code))
          .filter((service): service is NonNullable<typeof service> => Boolean(service))
        if (svcList.length>0) {
          const order = await prisma.order.create({
            data:{patientId:patient.id,status:'COMPLETED',
              services:{create:svcList.map(s=>({serviceId:s!.id}))}}
          })
          // Create results for each service
          for (const svc of svcList) {
            if (!svc?.templateId) continue
            const resultStatus = Math.random()>0.3 ? 'FINALIZED' : Math.random()>0.5 ? 'VERIFIED' : 'PENDING'
            const resultData:any = { groups: [] }
            // Generate some dummy result data
            const tpl = await prisma.template.findUnique({where:{id:svc.templateId}})
            if (tpl) {
              const schema = tpl.dataSchema as any
              if (schema?.groups) {
                for (const g of schema.groups) {
                  const fields = (g.fields||[]).map((f:any) => ({
                    fieldId:f.id, key:f.key, label:f.label,
                    value: f.type==='numeric' ? parseFloat((f.referenceRange?.general ? (f.referenceRange.general.min + Math.random()*(f.referenceRange.general.max-f.referenceRange.general.min)).toFixed(1) : (Math.random()*100).toFixed(1))) :
                           f.type==='boolean' ? Math.random()>0.5 : f.type==='select'&&f.options ? rand(f.options) : 'Normal',
                    flag: Math.random()>0.8 ? (Math.random()>0.5?'H':'L') : 'N',
                    unit:f.unit, referenceRange:f.referenceRange?.general ? `${f.referenceRange.general.min}-${f.referenceRange.general.max}` : undefined
                  }))
                  resultData.groups.push({groupId:g.id,label:g.label,fields})
                }
              }
            }
            await prisma.result.create({
              data:{
                patientId:patient.id, orderId:order.id, recordId:record!.id,
                templateId:svc.templateId, data:resultData,
                department:svc.category==='Imaging'?'RADIOLOGY':'LABORATORY',
                status:resultStatus as ResultStatus,
                verifiedBy: resultStatus!=='PENDING' ? tenantStaff['LAB_SCIENTIST']?.id ?? null : null,
                verifiedAt: resultStatus!=='PENDING' ? daysAgo(Math.floor(Math.random()*5)) : null,
                releasedAt: resultStatus==='FINALIZED' ? daysAgo(Math.floor(Math.random()*2)) : null,
              } as any
            })
          }
        }
      } catch(e:any) {
        console.error(`  ❌ Patient ${fn} ${ln}: ${e.message}`)
      }
    }
    console.log(`  🏥 ${tenant.facilityName}: 50 patients created with full clinical data`)
  }

  console.log('\n✅ Stress-test database seeded!')
  console.log('📋 Login accounts (password: password123):')
  console.log('   Nova Care: admin.user@novacare.com | doctor.one@novacare.com | lab.scientista@novacare.com')
  console.log('   Eudora:   admin.user@eudora.com   | doctor.one@eudora.com   | lab.scientista@eudora.com')
}

main().catch(e=>{console.error('❌',e);process.exit(1)}).finally(()=>prisma.$disconnect())
