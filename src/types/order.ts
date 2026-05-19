export type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export interface CreateOrderDTO {
    patientId: string;
    serviceIds: string[];
}

export interface Order {
    id: string;
    patientId: string;
    status: OrderStatus;
    createdAt: Date;
    updatedAt: Date;
}