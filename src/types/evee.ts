export type EveeDomain = 'ALLERGY' | 'DRUG_INTERACTION' | 'DOSAGE' | 'VITALS' | 'LAB' | 'HISTORY' | 'COMORBIDITY'
 | 'PREVENTIVE' | 'PREGNANCY' | 'PAEDIATRIC';


export interface EveeAlert {
  ruleId:         string;
  domain:         string;
  severity:       string;
  message:        string;
  recommendation: string;
}

export interface EveeEvaluationResult {
  evaluationId:   string;
  patientId:      string;
  triggeredBy:    string;
  alerts:         EveeAlert[];
  alertCount:     number;
  criticalCount:  number;
  mlScore?:       number;
  mlLabel?:       string;
  ruleSetVersion: number;
  evaluatedAt:    Date;
}

export interface OverrideAlertInput {
  alertId:       string;
  overriddenBy:  string;  // Staff ID
  overrideReason: string;
}