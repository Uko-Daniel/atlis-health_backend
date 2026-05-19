export type EncounterType = 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY' | 'FOLLOW_UP' | 'PROCEDURE' | 'TELEMEDICINE';

export interface CreateEncounterInput {
  patientId:      string;
  recordId:       string;
  attendingStaff: string;   // Staff ID
  type?:          EncounterType;
  chiefComplaint?: string;
  notes?:          string;
  encounteredAt?:  string;  // ISO datetime — defaults to now
}

export interface UpdateEncounterInput {
  chiefComplaint?: string;
  notes?:          string;
  type?:           EncounterType;
}