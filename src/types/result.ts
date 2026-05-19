export type ResultStatus = 'PENDING' | 'VERIFIED' | 'FINALIZED';

export interface Result {
  id: string;
  patientId: string;
  orderId: string;
  templateId: string;
  data: Record<string, any>; // JSON object of the results
  status: ResultStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
