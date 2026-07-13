export interface Service {
  id: string;
  name: string;
  labCode: string;
  category?: string;
  description?: string;
  price: number;
  templateId?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}