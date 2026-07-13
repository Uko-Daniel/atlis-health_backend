import { type FastifyInstance } from 'fastify';
import { authenticate }     from '../middleware/authenticate';
import { authorize }        from '../middleware/authorize';
import {
  allergyController,
  encounterController,
  vitalController,
  diagnosisController,
  medicationController,
} from '../controllers/clinicalController';

// ── ALLERGY ROUTES ────────────────────────────────────────────
// POST   /api/allergies
// GET    /api/allergies/:id
// GET    /api/patients/:patientId/allergies
// PATCH  /api/allergies/:id
// PATCH  /api/allergies/:id/deactivate

async function allergyRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Record a new allergy — doctors and nurses
  fastify.post('/', {
    preHandler: [authorize(['DOCTOR', 'NURSES'])],
    handler:    allergyController.createAllergy,
  });

  // Get single allergy
  fastify.get('/:id', {
    handler: allergyController.getAllergyById,
  });

  // All allergies for a patient
  fastify.get('/patient/:patientId', {
    handler: allergyController.getAllergiesByPatient,
  });

  // Update allergy record
  fastify.patch('/:id', {
    preHandler: [authorize(['DOCTOR', 'NURSES'])],
    handler:    allergyController.updateAllergy,
  });

  // Soft deactivate — never hard delete
  fastify.patch('/:id/deactivate', {
    preHandler: [authorize(['DOCTOR'])],
    handler:    allergyController.deactivateAllergy,
  });
}

// ── ENCOUNTER ROUTES ──────────────────────────────────────────
// POST   /api/encounters
// GET    /api/encounters/:id
// GET    /api/encounters/patient/:patientId
// GET    /api/encounters/patient/:patientId/latest
// GET    /api/encounters/record/:recordId
// PATCH  /api/encounters/:id
// PATCH  /api/encounters/:id/close

async function encounterRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Open a new encounter
  fastify.post('/', {
    preHandler: [authorize(['DOCTOR', 'NURSES'])],
    handler:    encounterController.createEncounter,
  });

  // GET /api/encounters?type=&limit=&page=
  fastify.get('/', {
    handler: encounterController.getAllEncounters,
  })

  // Single encounter by ID
  fastify.get('/:id', {
    handler: encounterController.getEncounterById,
  });

  // All encounters for a patient
  fastify.get('/patient/:patientId', {
    handler: encounterController.getEncountersByPatient,
  });

  // Most recent encounter for a patient
  fastify.get('/patient/:patientId/latest', {
    handler: encounterController.getLatestEncounter,
  });

  // All encounters for a record
  fastify.get('/record/:recordId', {
    handler: encounterController.getEncountersByRecord,
  });

  // Update encounter notes / type / stopTime
  fastify.patch('/:id', {
    preHandler: [authorize(['DOCTOR', 'NURSES'])],
    handler:    encounterController.updateEncounter,
  });

  // Close an encounter — sets stopTime
  fastify.patch('/:id/close', {
    preHandler: [authorize(['DOCTOR', 'NURSES'])],
    handler:    encounterController.closeEncounter,
  });
}

// ── VITAL ROUTES ──────────────────────────────────────────────
// POST   /api/vitals
// GET    /api/vitals/:id
// GET    /api/vitals/encounter/:encounterId
// GET    /api/vitals/patient/:patientId/latest
// GET    /api/vitals/patient/:patientId/trend

async function vitalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Record vitals — nurses and doctors
  fastify.post('/', {
    preHandler: [authorize(['DOCTOR', 'NURSES'])],
    handler:    vitalController.createVital,
  });

  // Single vital record
  fastify.get('/:id', {
    handler: vitalController.getVitalById,
  });

  // All vitals for an encounter
  fastify.get('/encounter/:encounterId', {
    handler: vitalController.getVitalsByEncounter,
  });

  // Most recent vitals for a patient
  fastify.get('/patient/:patientId/latest', {
    handler: vitalController.getLatestVitals,
  });

  // Vital trend — last N readings for deterioration monitoring
  fastify.get('/patient/:patientId/trend', {
    handler: vitalController.getVitalTrend,
  });
}

// ── DIAGNOSIS ROUTES ──────────────────────────────────────────
// POST   /api/diagnoses
// GET    /api/diagnoses/:id
// GET    /api/diagnoses/patient/:patientId
// GET    /api/diagnoses/patient/:patientId/active
// GET    /api/diagnoses/encounter/:encounterId
// GET    /api/diagnoses/patient/:patientId/icd
// PATCH  /api/diagnoses/:id

async function diagnosisRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Record a diagnosis — doctors only
  fastify.post('/', {
    preHandler: [authorize(['DOCTOR'])],
    handler:    diagnosisController.createDiagnosis,
  });

  // Single diagnosis
  fastify.get('/:id', {
    handler: diagnosisController.getDiagnosisById,
  });

  // Full diagnosis history for a patient
  fastify.get('/patient/:patientId', {
    handler: diagnosisController.getDiagnosesByPatient,
  });

  // Active + chronic diagnoses only — problem list
  fastify.get('/patient/:patientId/active', {
    handler: diagnosisController.getActiveDiagnoses,
  });

  // Diagnoses for a specific encounter
  fastify.get('/encounter/:encounterId', {
    handler: diagnosisController.getDiagnosesByEncounter,
  });

  // Search patient history by ICD-10 code
  // GET /api/diagnoses/patient/:patientId/icd?code=E11
  fastify.get('/patient/:patientId/icd', {
    handler: diagnosisController.findByICDCode,
  });

  // Update diagnosis status / notes
  fastify.patch('/:id', {
    preHandler: [authorize(['DOCTOR'])],
    handler:    diagnosisController.updateDiagnosis,
  });
}

// ── MEDICATION ROUTES ─────────────────────────────────────────
// POST   /api/medications
// GET    /api/medications/:id
// GET    /api/medications/record/:recordId
// GET    /api/medications/patient/:patientId/active
// PATCH  /api/medications/:id/status
// PATCH  /api/medications/:id/discontinue

async function medicationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate);

  // Prescribe a medication
  fastify.post('/', {
    preHandler: [authorize(['DOCTOR'])],
    handler:    medicationController.createMedication,
  });

  // Single medication
  fastify.get('/:id', {
    handler: medicationController.getMedicationById,
  });

  // All medications for a record
  // GET /api/medications/record/:recordId?status=ACTIVE
  fastify.get('/record/:recordId', {
    handler: medicationController.getMedicationsByRecord,
  });

  // All active medications for a patient across all records
  // Used by EVEE for drug interaction checks
  fastify.get('/patient/:patientId/active', {
    handler: medicationController.getActiveMedicationsByPatient,
  });

  // Update medication status
  fastify.patch('/:id/status', {
    preHandler: [authorize(['DOCTOR', 'NURSES', 'PHARMACIST'])],
    handler:    medicationController.updateMedicationStatus,
  });

  // Discontinue with mandatory reason
  fastify.patch('/:id/discontinue', {
    preHandler: [authorize(['DOCTOR', 'NURSES', 'PHARMACIST'])],
    handler:    medicationController.discontinueMedication,
  });
}

// ── REGISTER ALL CLINICAL ROUTES ──────────────────────────────

export async function clinicalRoutes(fastify: FastifyInstance) {
  fastify.register(allergyRoutes,    { prefix: '/allergies'    });
  fastify.register(encounterRoutes,  { prefix: '/encounters'   });
  fastify.register(vitalRoutes,      { prefix: '/vitals'       });
  fastify.register(diagnosisRoutes,  { prefix: '/diagnoses'    });
  fastify.register(medicationRoutes, { prefix: '/medications'  });
}
