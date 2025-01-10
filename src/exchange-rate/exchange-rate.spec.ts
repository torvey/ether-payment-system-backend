import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateService } from './exchange-rate.service';

jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  let prisma: PrismaService;

  beforeEach(async () => {
    global.fetch = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRateService,
        {
          provide: PrismaService,
          useValue: {
            exchangeRate: {
              create: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
        Logger,
      ],
    }).compile();

    service = module.get<ExchangeRateService>(ExchangeRateService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('addNewExchangeRates', () => {
    it('should fetch rates and save them to the database', async () => {
      // Mockowanie fetch

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ethereum: { usd: 1234.56, eur: 987.65, gbp: 1000, pln: 100 },
          }),
          { status: 200 },
        ),
      );

      // Wywołanie metody
      await service.addNewExchangeRates();

      expect(prisma.exchangeRate.create).toHaveBeenCalledWith({
        data: { currency: 'USD', rate: '1234.56' },
      });
      expect(prisma.exchangeRate.create).toHaveBeenCalledWith({
        data: { currency: 'EUR', rate: '987.65' },
      });
    });

    it('should throw an error if the API call fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'API limit exceeded' }), {
          status: 429,
        }),
      );

      await expect(service.addNewExchangeRates()).rejects.toThrow(
        'Błąd API CoinGecko: {"error":"API limit exceeded"}',
      );
    });
  });

  describe('getLatestEthRate', () => {
    it('should return the latest rate from the database if it is fresh', async () => {
      const mockExchangeRate = {
        rate: '1234.56',
        updatedAt: new Date(),
      };

      jest
        .spyOn(prisma.exchangeRate, 'findFirst')
        .mockResolvedValueOnce(mockExchangeRate as any);

      const result = await service.getLatestEthRate('USD');
      expect(result).toBe('1234.56');
      expect(prisma.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: { currency: 'USD' },
        orderBy: { updatedAt: 'desc' },
      });
    });

    it('should fetch new rates if the database rate is older than 30 minutes', async () => {
      const oldDate = new Date(Date.now() - 31 * 60 * 1000);
      jest.spyOn(prisma.exchangeRate, 'findFirst').mockResolvedValueOnce({
        rate: '1234.56',
        updatedAt: oldDate,
      } as any);

      const mockRates = { usd: 1234.56, eur: 987.65, gbp: 1000, pln: 100 };
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        new Response(JSON.stringify({ ethereum: mockRates }), { status: 200 }),
      );

      const result = await service.getLatestEthRate('USD');

      expect(result).toBe('1234.56');
      expect(prisma.exchangeRate.create).toHaveBeenCalled();
    });

    it('should throw an error if no rates are found', async () => {
      jest.spyOn(prisma.exchangeRate, 'findFirst').mockResolvedValueOnce(null);

      (fetch as jest.Mock).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ethereum: {} }), // Brak kursów
          { status: 200 },
        ),
      );

      await expect(service.getLatestEthRate('USD')).rejects.toThrow(
        'Nie udało się pobrać kursu dla waluty: USD',
      );
    });
  });

  describe('getLatestRate', () => {
    it('should return the latest rate for a currency', async () => {
      const mockExchangeRate = {
        id: 1,
        currency: 'USD',
        rate: '1234.56',
        updatedAt: new Date(),
      };

      jest
        .spyOn(prisma.exchangeRate, 'findFirst')
        .mockResolvedValueOnce(mockExchangeRate as any);

      const result = await service.getLatestRate('USD');
      expect(result).toEqual(mockExchangeRate);
      expect(prisma.exchangeRate.findFirst).toHaveBeenCalledWith({
        where: { currency: 'USD' },
        orderBy: { updatedAt: 'desc' },
      });
    });
  });
});
