export interface FieldFlag {
  flag:     'H' | 'L' | 'C' | 'N' | null; // High, Low, Critical, Normal, Not applicable
  critical: boolean;
}

export interface EnteredField {
  fieldId:  string;
  key:      string;
  value:    number | string | boolean | null;
  flag?:    FieldFlag['flag'];
  critical?: boolean;
}

export interface DraftGroup {
  groupId: string;
  fields:  EnteredField[];
}

export interface DraftData {
  schemaVersion: number;
  groups:        DraftGroup[];
  interpretation?: string;
}

export interface FlaggedField extends EnteredField {
  flag:     FieldFlag['flag'];
  critical: boolean;
}

export interface EveeInlineAlert {
  ruleId:         string;
  severity:       'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  message:        string;
  recommendation: string;
  fieldKey:       string;
}

export interface SessionState {
  sessionId:   string;
  resultId:    string;
  staffId:     string;
  draftData:   DraftData | null;
  startedAt:   Date;
  lastSavedAt: Date | null;
  expiresAt:   Date;
}