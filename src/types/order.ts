import type { PaymentMethod } from "../../generated/prisma/enums";

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export interface CreateOrderDTO {
    patientId: string;
    serviceIds: string[];
    paymentMethod: PaymentMethod;
}

export interface Order {
    id: string;
    patientId: string;
    status: OrderStatus;
    paymentMethod: PaymentMethod;
    createdAt: Date;
    updatedAt: Date;
}