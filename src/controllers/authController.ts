import { type FastifyRequest, type FastifyReply } from 'fastify';
import { staffService } from '../services/staffService';

interface LoginBody {
  email:    string;
  password: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword:     string;
}

export const authController = {

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, password } = request.body as LoginBody;
      const staff = await staffService.login({ email, password });

      const token = await reply.jwtSign({
        sub:        staff.id,
        role:       staff.role,
        department: staff.department,
        isHOD:      staff.isHOD,
        canVerify:  staff.canVerify,
        email:      staff.email,
      });

      return reply.status(200).send({
        token,
        staff: {
          id:         staff.id,
          firstName:  staff.firstName,
          lastName:   staff.lastName,
          email:      staff.email,
          role:       staff.role,
          department: staff.department,
          isHOD:      staff.isHOD,
          canVerify:  staff.canVerify,
        },
      });
    } catch (err: any) {
      return reply.status(401).send({ error: err.message });
    }
  },

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { currentPassword, newPassword } = request.body as ChangePasswordBody;
      await staffService.changePassword(
        request.user.sub,
        currentPassword,
        newPassword,
      );
      return reply.status(200).send({ message: 'Password updated successfully' });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      const staff = await staffService.getStaffById(request.user.sub);
      if (!staff) return reply.status(404).send({ error: 'Staff not found' });
      return reply.status(200).send(staff);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  },
};