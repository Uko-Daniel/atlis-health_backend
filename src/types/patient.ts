import type { MaritalStatus, Gender } from '../../generated/prisma/enums'

export interface NextOfKin {
  id:          string
  firstName:   string
  lastName:    string
  relation:    string
  phoneNumber: string
}

export interface Patient {
  id:            string
  firstName:     string
  lastName:      string
  dob:           Date
  gender:        Gender
  phoneNumber:   string | null
  email:         string | null
  maritalStatus: MaritalStatus | null
  occupation:    string | null
  religion:      string | null
  adress:        string | null
  nationality:   string | null
  NIN:           string | null
  payerId:       string | null
  payer?:        { id: string; name: string; type: string } | null
  nok:           NextOfKin | null
  tenantId:      string
  createdAt:     Date
  updatedAt:     Date
}