export type DiagnosisStatus = 'ACTIVE' | 'RESOLVED' | 'CHRONIC' | 'SUSPECTED';

export interface CreateDiagnosisInput {
  patientId:       string;
  encounterId:     string;
  name:            string;
  icdCode?:        string;
  icdDescription?: string;
  status?:         DiagnosisStatus;
  isPrimary?:      boolean;
  notes?:          string;
  diagnosedBy:     string;  // Staff ID
  diagnosedAt?:    string;  // ISO datetime — defaults to now
}

export interface UpdateDiagnosisInput {
  name?:           string;
  icdCode?:        string;
  icdDescription?: string;
  status?:         DiagnosisStatus;
  isPrimary?:      boolean;
  notes?:          string;
}
