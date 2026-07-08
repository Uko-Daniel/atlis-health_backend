import { type FastifyRequest, type FastifyReply } from 'fastify';
import { allergyService }    from '../services/allergyService';
import { encounterService }  from '../services/encounterService';
import { vitalService }      from '../services/vitalService';
import { diagnosisService }  from '../services/diagnosisService';
import { medicationService } from '../services/medicationService';

// ── ALLERGY ───────────────────────────────────────────────────

export const allergyController = {

  async createAllergy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const allergy = await allergyService.createAllergy({
        ...(request.body as any),
        recordedBy: request.user.sub,
      });
      return reply.status(201).send(allergy);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async getAllergiesByPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const allergies = await allergyService.getAllergiesByPatient(patientId);
      return reply.status(200).send(allergies);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getAllergyById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }   = request.params as { id: string };
      const allergy  = await allergyService.getAllergyById(id);
      if (!allergy) return reply.status(404).send({ error: 'Allergy not found' });
      return reply.status(200).send(allergy);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updateAllergy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const allergy = await allergyService.updateAllergy(id, request.body as any);
      return reply.status(200).send(allergy);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async deactivateAllergy(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }  = request.params as { id: string };
      const allergy = await allergyService.deactivateAllergy(id);
      return reply.status(200).send(allergy);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },
};

// ── ENCOUNTER ─────────────────────────────────────────────────

export const encounterController = {

  async createEncounter(request: FastifyRequest, reply: FastifyReply) {
    try {
      const encounter = await encounterService.createEncounter({
        ...(request.body as any),
        attendingStaff: request.user.sub,
      });
      return reply.status(201).send(encounter);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async getAllEncounters(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as {
        type?:  string
        limit?: number
        page?:  number
      }
      const encounters = await encounterService.getAllEncounters({
        type:  query.type  as any,
        limit: Number(query.limit) || 20,
        page:  Number(query.page)  || 1,
      })
      return reply.status(200).send(encounters)
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  },

  async getEncounterById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }      = request.params as { id: string };
      const encounter   = await encounterService.getEncounterById(id);
      if (!encounter) return reply.status(404).send({ error: 'Encounter not found' });
      return reply.status(200).send(encounter);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getEncountersByPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const query         = request.query as { limit?: number; type?: any };
      const encounters    = await encounterService.getEncountersByPatient(
        patientId, { ...(query.limit !== undefined && { limit: query.limit }), ...(query.type !== undefined && { type: query.type }) }
      );
      return reply.status(200).send(encounters);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getEncountersByRecord(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { recordId } = request.params as { recordId: string };
      const encounters   = await encounterService.getEncountersByRecord(recordId);
      return reply.status(200).send(encounters);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getLatestEncounter(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const encounter     = await encounterService.getLatestEncounter(patientId);
      if (!encounter) return reply.status(404).send({ error: 'No encounters found' });
      return reply.status(200).send(encounter);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updateEncounter(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }    = request.params as { id: string };
      const encounter = await encounterService.updateEncounter(id, request.body as any);
      return reply.status(200).send(encounter);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async closeEncounter(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }       = request.params as { id: string };
      const { stopTime } = request.body   as { stopTime?: string };
      const encounter    = await encounterService.closeEncounter(id, stopTime);
      return reply.status(200).send(encounter);
    } catch (err: any) {
      const status = err.message.includes('not found')  ? 404
                   : err.message.includes('already closed') ? 409 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },
};

// ── VITALS ────────────────────────────────────────────────────

export const vitalController = {

  async createVital(request: FastifyRequest, reply: FastifyReply) {
    try {
      const vital = await vitalService.createVital({
        ...(request.body as any),
        recordedBy: request.user.sub,
      });
      return reply.status(201).send(vital);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404
                   : err.message.includes('range')     ? 422 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async getVitalsByEncounter(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { encounterId } = request.params as { encounterId: string };
      const vitals = await vitalService.getVitalsByEncounter(encounterId);
      return reply.status(200).send(vitals);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getLatestVitals(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const vital = await vitalService.getLatestVitals(patientId);
      if (!vital) return reply.status(404).send({ error: 'No vitals recorded' });
      return reply.status(200).send(vital);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getVitalTrend(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : undefined;
      const vitals = await vitalService.getVitalTrend(patientId, limit);
      return reply.status(200).send(vitals);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getVitalById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const vital  = await vitalService.getVitalById(id);
      if (!vital) return reply.status(404).send({ error: 'Vital record not found' });
      return reply.status(200).send(vital);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },
};

// ── DIAGNOSIS ─────────────────────────────────────────────────

export const diagnosisController = {

  async createDiagnosis(request: FastifyRequest, reply: FastifyReply) {
    try {
      const diagnosis = await diagnosisService.createDiagnosis({
        ...(request.body as any),
        diagnosedBy: request.user.sub,
      });
      return reply.status(201).send(diagnosis);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async getDiagnosesByPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const diagnoses = await diagnosisService.getDiagnosesByPatient(patientId);
      return reply.status(200).send(diagnoses);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getActiveDiagnoses(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const diagnoses = await diagnosisService.getActiveDiagnosesByPatient(patientId);
      return reply.status(200).send(diagnoses);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getDiagnosesByEncounter(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { encounterId } = request.params as { encounterId: string };
      const diagnoses = await diagnosisService.getDiagnosesByEncounter(encounterId);
      return reply.status(200).send(diagnoses);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getDiagnosisById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }    = request.params as { id: string };
      const diagnosis = await diagnosisService.getDiagnosisById(id);
      if (!diagnosis) return reply.status(404).send({ error: 'Diagnosis not found' });
      return reply.status(200).send(diagnosis);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updateDiagnosis(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }    = request.params as { id: string };
      const diagnosis = await diagnosisService.updateDiagnosis(id, request.body as any);
      return reply.status(200).send(diagnosis);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async findByICDCode(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const { code }      = request.query  as { code: string };
      if (!code) return reply.status(400).send({ error: 'ICD code query param required' });
      const diagnoses = await diagnosisService.findDiagnosisByICDCode(patientId, code);
      return reply.status(200).send(diagnoses);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },
};

// ── MEDICATION ────────────────────────────────────────────────

export const medicationController = {

  async createMedication(request: FastifyRequest, reply: FastifyReply) {
    try {
      const medication = await medicationService.createMedication({
        ...(request.body as any),
        prescribedBy: request.user.sub,
      });
      return reply.status(201).send(medication);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async getMedicationsByRecord(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { recordId } = request.params as { recordId: string };
      const { status }   = request.query  as { status?: any };
      const medications  = await medicationService.getMedicationsByRecord(recordId, status);
      return reply.status(200).send(medications);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getActiveMedicationsByPatient(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { patientId } = request.params as { patientId: string };
      const medications   = await medicationService.getActiveMedicationsByPatient(patientId);
      return reply.status(200).send(medications);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async getMedicationById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }      = request.params as { id: string };
      const medication  = await medicationService.getMedicationById(id);
      if (!medication) return reply.status(404).send({ error: 'Medication not found' });
      return reply.status(200).send(medication);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },

  async updateMedicationStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }     = request.params as { id: string };
      const { status } = request.body   as { status: any };
      const medication = await medicationService.updateMedicationStatus(id, status);
      return reply.status(200).send(medication);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },

  async discontinueMedication(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id }     = request.params as { id: string };
      const { reason } = request.body   as { reason: string };
      const medication = await medicationService.discontinueMedication(id, reason);
      return reply.status(200).send(medication);
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 400;
      return reply.status(status).send({ error: err.message });
    }
  },
};
