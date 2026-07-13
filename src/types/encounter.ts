export type EncounterType = 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY' | 'FOLLOW_UP' | 'PROCEDURE' | 'TELEMEDICINE';

export interface CreateEncounterInput {
  patientId:      string;
  recordId?:       string;
  attendingStaff: string;   // Staff ID
  type?:          EncounterType;
  chiefComplaint?: string;
  notes?:          string;
  encounteredAt?:  string;  // ISO datetime — defaults to now
  startTime?:     string;  // ISO datetime — defaults to now
  stopTime?:      string;
  meetLink?:      string;  // ISO datetime — optional, can be set later for ongoing encounters
}

export interface UpdateEncounterInput {
  chiefComplaint?: string;
  notes?:          string;
  type?:           EncounterType;
  startTime?:     string;  // ISO datetime — defaults to now
  stopTime?:      string;
  meetLink?:      string; // ISO datetime — optional, can be set later for ongoing encounters
}
