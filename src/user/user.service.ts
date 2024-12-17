import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createUser(email: string, password: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { email, password: hashedPassword },
    });
  }

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createTwoFactorCode(userId: number): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-cyfrowy kod
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Kod ważny 5 minut

    await this.prisma.twoFactorCode.create({
      data: {
        userId,
        code,
        expiresAt,
      },
    });

    return code;
  }

  async validateTwoFactorCode(userId: number, code: string): Promise<boolean> {
    const twoFactorCode = await this.prisma.twoFactorCode.findFirst({
      where: {
        userId,
        code,
        expiresAt: { gte: new Date() }, // Kod nie może być przeterminowany
      },
    });

    return !!twoFactorCode; // Zwraca true, jeśli kod jest poprawny
  }

  async deleteTwoFactorCodes(userId: number) {
    await this.prisma.twoFactorCode.deleteMany({
      where: { userId },
    });
  }
}
