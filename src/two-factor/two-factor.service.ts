import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generowanie nowego kodu 2FA
   */
  async generateCode(userId: number): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-cyfrowy kod
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Kod ważny 5 minut

    console.log('Kod:', code);

    // Utwórz nowy kod
    await this.prisma.twoFactorCode.create({
      data: {
        userId,
        code,
        expiresAt,
      },
    });

    return code;
  }

  /**
   * Weryfikacja kodu 2FA
   */
  async validateCode(userId: number, code: string): Promise<boolean> {
    const validCode = await this.prisma.twoFactorCode.findFirst({
      where: {
        userId,
        code,
        expiresAt: { gte: new Date() }, // Kod musi być aktualny
      },
    });

    return !!validCode; // Zwraca true, jeśli kod jest poprawny
  }
}
