import { Test, TestingModule } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { TwoFactorService } from './two-factor.service';

jest.mock('nodemailer');

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  let prisma: PrismaService;

  const mockPrismaService = {
    twoFactorCode: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockTransporter = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendCodeToEmail', () => {
    it('should send an email with the correct code', async () => {
      const email = 'test@example.com';
      const code = '123456';

      await service.sendCodeToEmail(email, code);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Your Two-Factor Authentication Code',
        text: `Your verification code is: ${code}`,
        html: `<p>Your verification code is: <strong>${code}</strong></p>`,
      });
    });

    it('should throw an error if email sending fails', async () => {
      mockTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await expect(
        service.sendCodeToEmail('test@example.com', '123456'),
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('generateCode', () => {
    it('should generate a code, save it in the database, and send an email', async () => {
      const userId = 1;
      const email = 'test@example.com';
      const code = '123456';

      process.env.NODE_ENV = 'test';
      mockPrismaService.twoFactorCode.create.mockResolvedValueOnce(undefined);

      jest.spyOn(service, 'sendCodeToEmail').mockResolvedValueOnce(undefined);

      const result = await service.generateCode(userId, email);

      expect(result).toBe(code);
      expect(mockPrismaService.twoFactorCode.create).toHaveBeenCalledWith({
        data: {
          userId,
          code,
          expiresAt: expect.any(Date),
        },
      });
      expect(service.sendCodeToEmail).toHaveBeenCalledWith(email, code);
    });
  });

  describe('validateCode', () => {
    it('should return true for a valid code', async () => {
      const userId = 1;
      const code = '123456';

      mockPrismaService.twoFactorCode.findFirst.mockResolvedValueOnce({
        id: 1,
        userId,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // Kod ważny 5 minut
      });

      const result = await service.validateCode(userId, code);

      expect(result).toBe(true);
      expect(mockPrismaService.twoFactorCode.findFirst).toHaveBeenCalledWith({
        where: {
          userId,
          code,
          expiresAt: { gte: expect.any(Date) },
        },
      });
    });

    it('should return false for an invalid code', async () => {
      mockPrismaService.twoFactorCode.findFirst.mockResolvedValueOnce(null);

      const result = await service.validateCode(1, '123456');

      expect(result).toBe(false);
    });
  });
});
