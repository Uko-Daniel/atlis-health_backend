export interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    dob: Date;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    phoneNumber: string | null;
    email: string | null;
    tenantId: string;
    createdAt: Date;
    updatedAt: Date;
}
