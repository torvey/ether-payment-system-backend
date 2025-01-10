import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService) {}

  async sendCodeToEmail(email: string, code: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, // Host serwera SMTP
      port: parseInt(process.env.SMTP_PORT, 10), // Port SMTP
      secure: process.env.SMTP_SECURE === 'true', // true dla SSL, false dla TLS
      auth: {
        user: process.env.SMTP_USER, // Użytkownik SMTP
        pass: process.env.SMTP_PASS, // Hasło SMTP
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM, // Nadawca
      to: email, // Odbiorca
      subject: 'Your Two-Factor Authentication Code', // Temat
      text: `Your verification code is: ${code}`, // Treść e-maila (tekst)
      html: `<p>Your verification code is: <strong>${code}</strong></p>`, // Treść e-maila (HTML)
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      throw error;
    }
  }

  async generateCode(userId: number, email: string): Promise<string> {
    const code =
      process.env.NODE_ENV === 'test'
        ? '123456'
        : Math.floor(100000 + Math.random() * 900000).toString(); // 6-cyfrowy kod
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Kod ważny 5 minut

    // Utwórz nowy kod
    await this.prisma.twoFactorCode.create({
      data: {
        userId,
        code,
        expiresAt,
      },
    });

    await this.sendCodeToEmail(email, code);

    return code;
  }

  async validateCode(userId: number, code: string): Promise<boolean> {
    const validCode = await this.prisma.twoFactorCode.findFirst({
      where: {
        userId,
        code,
        expiresAt: { gte: new Date() }, // Kod musi być aktualny
      },
    });

    return !!validCode;
  }
}
