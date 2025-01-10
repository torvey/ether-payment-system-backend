import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthorizationTokenService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tworzenie tymczasowego tokenu
   */
  async createToken(userId: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex'); // Generowanie unikalnego tokenu
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Token ważny 15 minut

    // Zapis tokenu w bazie
    await this.prisma.authorizationToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Sprawdzanie poprawności tokenu
   */
  async validateToken(token: string): Promise<boolean> {
    const foundToken = await this.prisma.authorizationToken.findFirst({
      where: {
        token,
        expiresAt: { gte: new Date() }, // Token musi być aktualny
      },
    });

    return !!foundToken; // Zwraca true, jeśli token jest poprawny
  }

  async getTokenUser(token: string): Promise<number> {
    const foundToken = await this.prisma.authorizationToken.findFirst({
      where: {
        token,
        expiresAt: { gte: new Date() }, // Token musi być aktualny
      },
    });

    console.log(token, foundToken);

    return foundToken.userId;
  }

  /**
   * Usunięcie tokenów użytkownika
   */
  async deleteTokensForUser(userId: number) {
    await this.prisma.authorizationToken.deleteMany({
      where: { userId },
    });
  }
}
