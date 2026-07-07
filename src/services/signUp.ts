import { prisma } from '../lib/prisma'
import { staffService } from './staffService'
import type { CreateSignupRequestInput, SignupRequestListParams } from '../types/signUp'

export const signupService = {
  /**
   * Create a new sign-up request from a prospective staff member.
   * Public — no authentication required.
   */
  async create(input: CreateSignupRequestInput) {
    // Check for existing pending request with same email
    const existing = await prisma.signupRequest.findFirst({
      where: {
        email:  input.email.toLowerCase().trim(),
        status: 'PENDING',
      },
    })

    if (existing) {
      throw new Error('A pending request already exists for this email address.')
    }

    // Check if email is already in use by an active staff member
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
        department:    input.department,
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

  /**
   * List sign-up requests for admin review.
   */
  async list(params: SignupRequestListParams = {}) {
    const { status, page = 1, limit = 20 } = params
    const skip = (page - 1) * limit

    const where = status ? { status } : {}

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

  /**
   * Get a single sign-up request by ID.
   */
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

  /**
   * Approve a sign-up request.
   * Delegates to staffService.createStaff so password is properly hashed
   * and all validation/department rules are enforced.
   */
  async approve(id: string, reviewerStaffId: string, reviewNotes?: string) {
    const request = await prisma.signupRequest.findUnique({ where: { id } })

    if (!request) {
      throw new Error('Sign-up request not found.')
    }

    if (request.status !== 'PENDING') {
      throw new Error(`This request has already been ${request.status.toLowerCase()}.`)
    }

    // Generate a secure temporary password — user resets on first login
    const tempPassword = crypto.randomUUID()

    // Use staffService so argon2 hashing, validation, and dept rules run
    const staff = await staffService.createStaff({
      firstName:   request.firstName,
      lastName:    request.lastName,
      email:       request.email,
      password:    tempPassword,
      role:        'DOCTOR',
      department:  request.department,
      phoneNumber: request.phone,
      isHOD:       false,
      canVerify:   false,
    })

    // Update the signup request
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

  /**
   * Reject a sign-up request.
   */
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