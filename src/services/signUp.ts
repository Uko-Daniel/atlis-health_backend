import { prisma } from '../lib/prisma'
import { staffService } from './staffService'
import type { CreateSignupRequestInput, SignupRequestListParams } from '../types/signUp'

export const signupService = {

  async create(input: CreateSignupRequestInput) {
    const existing = await prisma.signupRequest.findFirst({
      where: {
        email:  input.email.toLowerCase().trim(),
        status: 'PENDING',
      },
    })

    if (existing) {
      throw new Error('A pending request already exists for this email address.')
    }

    const existingStaff = await prisma.staff.findUnique({
      where: { email: input.email.toLowerCase().trim() },
    })

    if (existingStaff) {
      throw new Error('This email is already associated with an active staff account.')
    }

    return prisma.signupRequest.create({
      data: {
        firstName:     input.firstName.trim(),
        lastName:      input.lastName.trim(),
        email:         input.email.toLowerCase().trim(),
        phone:         input.phone.trim(),
        profession:    input.profession.trim(),
        role:          input.role,
        department:    input.department,
        tenantId:      input.tenantId,
        facility:      input.facility ?? null,
        licenseNumber: input.licenseNumber ?? null,
        message:       input.message ?? null,
        status:        'PENDING',
      },
      select: {
        id:        true,
        firstName: true,
        lastName:  true,
        email:     true,
        status:    true,
        createdAt: true,
      },
    })
  },

  async list(params: SignupRequestListParams = {}) {
    const { status, tenantId, page = 1, limit = 20 } = params
    const skip = (page - 1) * limit

    const where: any = {}
    if (tenantId) where.tenantId = tenantId
    if (status) where.status = status

    const [data, total] = await Promise.all([
      prisma.signupRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id:            true,
          firstName:     true,
          lastName:      true,
          email:         true,
          phone:         true,
          profession:    true,
          role:          true,
          department:    true,
          facility:      true,
          licenseNumber: true,
          message:       true,
          status:        true,
          reviewedBy:    true,
          reviewedAt:    true,
          reviewNotes:   true,
          createdAt:     true,
        },
      }),
      prisma.signupRequest.count({ where }),
    ])

    return { data, total, page, limit }
  },

  async getById(id: string) {
    return prisma.signupRequest.findUnique({
      where: { id },
      select: {
        id:            true,
        firstName:     true,
        lastName:      true,
        email:         true,
        phone:         true,
        profession:    true,
        role:          true,
        department:    true,
        facility:      true,
        licenseNumber: true,
        message:       true,
        status:        true,
        reviewedBy:    true,
        reviewedAt:    true,
        reviewNotes:   true,
        createdStaffId: true,
        createdAt:     true,
      },
    })
  },

  async approve(id: string, reviewerStaffId: string, reviewNotes?: string) {
    const request = await prisma.signupRequest.findUnique({
      where: { id },
      select: {
        id:         true,
        firstName:  true,
        lastName:   true,
        email:      true,
        phone:      true,
        profession: true,
        role:       true,
        department: true,
        tenantId:   true,
        status:     true,
      },
    })

    if (!request) {
      throw new Error('Sign-up request not found.')
    }

    if (request.status !== 'PENDING') {
      throw new Error(`This request has already been ${request.status.toLowerCase()}.`)
    }

    const tempPassword = crypto.randomUUID()

    const staff = await staffService.createStaff({
      firstName:   request.firstName,
      lastName:    request.lastName,
      email:       request.email,
      password:    tempPassword,
      role:        request.role,
      department:  request.department,
      tenantId:    request.tenantId,
      phoneNumber: request.phone,
      isHOD:       false,
      canVerify:   false,
    })

    const updated = await prisma.signupRequest.update({
      where: { id },
      data: {
        status:         'APPROVED',
        reviewedBy:     reviewerStaffId,
        reviewedAt:     new Date(),
        reviewNotes:    reviewNotes ?? null,
        createdStaffId: staff.id,
      },
      select: {
        id:             true,
        firstName:      true,
        lastName:       true,
        email:          true,
        status:         true,
        reviewedAt:     true,
        createdStaffId: true,
      },
    })

    return updated
  },

  async reject(id: string, reviewerStaffId: string, reviewNotes?: string) {
    const request = await prisma.signupRequest.findUnique({ where: { id } })

    if (!request) {
      throw new Error('Sign-up request not found.')
    }

    if (request.status !== 'PENDING') {
      throw new Error(`This request has already been ${request.status.toLowerCase()}.`)
    }

    return prisma.signupRequest.update({
      where: { id },
      data: {
        status:      'REJECTED',
        reviewedBy:  reviewerStaffId,
        reviewedAt:  new Date(),
        reviewNotes: reviewNotes ?? null,
      },
      select: {
        id:         true,
        firstName:  true,
        lastName:   true,
        email:      true,
        status:     true,
        reviewedAt: true,
      },
    })
  },
}