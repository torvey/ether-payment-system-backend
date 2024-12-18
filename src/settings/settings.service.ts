import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async createApiKey(userId: number) {
    const key = crypto.randomBytes(32).toString('hex');

    return this.prisma.settings.create({
      data: {
        userId,
        apiKey: key,
        domainName: '',
      },
    });
  }

  async saveDomainName(userId: number, domainName: string) {
    // Walidacja nazwy domeny
    const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domainName)) {
      throw new BadRequestException('Invalid domain name format');
    }

    return this.prisma.settings.update({
      where: {
        userId,
      },
      data: {
        domainName,
      },
    });
  }

  async getSettings(userId: number) {
    return this.prisma.settings.findUnique({
      where: {
        userId,
      },
    });
  }
}
