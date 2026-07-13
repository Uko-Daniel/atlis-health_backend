export interface Template {
    id: string;
    name: string;
    type: 'LAB' | 'IMAGING' | 'OTHER';
    dataSchema: object; // JSON schema for result fields
    createdAt: Date;
    updatedAt: Date;
}

export type FieldType =
  | 'numeric'
  | 'text'
  | 'select'
  | 'multiselect'
  | 'richtext'
  | 'calculated'
  | 'image'
  | 'boolean';

export type LayoutType = 'table' | 'sections' | 'freeform';

export interface ReferenceRange {
  male?:   { min: number; max: number };
  female?: { min: number; max: number };
  child?:  { min: number; max: number };
  general?: { min: number; max: number }; // fallback if sex not differentiated
}

export interface CriticalRange {
  low?:  number;
  high?: number;
}

export interface TemplateField {
  id:             string;
  key:            string;
  label:          string;
  type:           FieldType;
  unit?:          string;
  referenceRange?: ReferenceRange;
  criticalRange?:  CriticalRange;
  required:       boolean;
  precision?:     number;          // decimal places for numeric
  hint?:          string;
  flagLogic?:     'auto' | 'manual';
  options?:       string[];        // for select / multiselect fields
  formula?:       string;          // formula key for calculated fields e.g. 'ckd_epi'
  formulaInputs?: string[];        // field keys this formula depends on
}

export interface TemplateGroup {
  id:          string;
  label:       string;
  collapsible: boolean;
  fields:      TemplateField[];
}

export interface InterpretationConfig {
  enabled: boolean;
  prompt?: string;
}

export interface SignatureConfig {
  required: boolean;
  roles:    string[];
}

export interface DataSchema {
  version:        number;
  layout:         LayoutType;
  groups:         TemplateGroup[];
  interpretation: InterpretationConfig;
  signature:      SignatureConfig;
}