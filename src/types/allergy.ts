export type AllergySeverity = 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';

export type AllergyStatus = 'ACTIVE' | 'INACTIVE' | 'UNCONFIRMED';

export interface CreateAllergyInput {
  patientId:  string;
  substance:  string;
  reaction:   string;
  severity:   AllergySeverity;
  drugClass?: string;     // e.g. "Penicillin" — used by EVEE for cross-reactivity
  onsetDate?: string;     // ISO date string
  confirmed?: boolean;
  notes?:     string;
  recordedBy: string;     // Staff ID
}

export interface UpdateAllergyInput {
  substance?: string;
  reaction?:  string;
  severity?:  AllergySeverity;
  status?:    AllergyStatus;
  drugClass?: string;
  confirmed?: boolean;
  notes?:     string;
}