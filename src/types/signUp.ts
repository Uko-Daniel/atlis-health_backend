import { Department, SignupRequestStatus, StaffRole } from '../../generated/prisma/client';

export interface CreateSignupRequestInput {
  firstName:     string
  lastName:      string
  email:         string
  phone:         string
  profession:    string
  role:          StaffRole
  department:    Department
  tenantId:      string
  facility?:     string | undefined
  licenseNumber?: string | undefined
  message?:      string | undefined
}

export interface SignupRequestListParams {
  status?: SignupRequestStatus | undefined
  tenantId?: string
  page?:   number
  limit?:  number
}