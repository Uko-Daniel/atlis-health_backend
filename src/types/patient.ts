export interface Patient {
    id: string;
    firstName: string;
    lastName: string;
    dob: Date;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    phoneNumber: string | null;
    email: string | null;
    createdAt: Date;
    updatedAt: Date;
}
