import { Department, SignupRequestStatus, } from '../../generated/prisma/client';

export interface CreateSignupRequestInput {
  firstName:     string
  lastName:      string
  email:         string
  phone:         string
  profession:    string
  department:    Department
  facility?:     string | undefined
  licenseNumber?: string | undefined
  message?:      string | undefined
}

export interface SignupRequestListParams {
  status?: SignupRequestStatus | undefined
  page?:   number
  limit?:  number
}
