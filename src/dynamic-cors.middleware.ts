import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class DynamicCorsMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const requestOrigin = req.headers.origin;

    if (!requestOrigin) {
      // Jeśli brak `origin`, odrzucamy żądanie
      res.status(403).send('Forbidden: No Origin header');
      return;
    }

    let domain: string | undefined;
    try {
      const url = new URL(requestOrigin);
      domain = url.host;
    } catch (error) {
      res.status(400).send('Invalid Origin URL');
      return;
    }

    // Sprawdź w bazie danych, czy `origin` jest dozwolony
    const allowedOrigin = await this.prisma.settings.findFirst({
      where: { domainName: domain },
    });

    if (allowedOrigin) {
      // Jeśli `origin` jest dozwolony, ustaw nagłówki CORS
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      // Jeśli `origin` nie jest dozwolony, odrzucamy żądanie
      res.status(403).send('Forbidden: Origin not allowed');
      return;
    }

    // Obsługa preflight requestów
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  }
}
