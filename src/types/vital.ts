export interface CreateVitalInput {
  encounterId:     string;
  patientId:       string;
  recordedBy:      string;  // Staff ID

  // Haemodynamics
  systolicBP?:     number;
  diastolicBP?:    number;
  heartRate?:      number;
  meanABP?:        number;

  // Respiratory
  respiratoryRate?: number;
  spO2?:            number;

  // Temperature
  temperature?: number;

  // Anthropometrics
  weight?: number;
  height?: number;

  // Neurological
  gcs?: number;

  // Additional
  urineOutput?: number;
  painScore?:   number;

  recordedAt?: string;  // ISO datetime — defaults to now
}
