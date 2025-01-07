import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule'; // Importujemy Cron
import { Currency, ExchangeRate } from '@prisma/client';
import { CurrencyConfig } from 'src/config/config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly coingeckoApiUrl =
    'https://api.coingecko.com/api/v3/simple/price';

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduleAddNewExchangeRates(): Promise<void> {
    this.logger.log('Rozpoczynam zadanie pobierania kursów wymiany...');
    try {
      await this.addNewExchangeRates();
      this.logger.log('Nowe kursy wymiany zostały zapisane w bazie.');
    } catch (error) {
      this.logger.error(
        'Błąd podczas wykonywania zadania pobierania kursów wymiany:',
        error,
      );
    }
  }

  async addNewExchangeRates(): Promise<Record<Currency, string>> {
    const rates = await this.fetchEthRatesFromAPI();

    for (const currency of CurrencyConfig.supportedCurrencies) {
      await this.prisma.exchangeRate.create({
        data: {
          currency,
          rate: rates[currency],
        },
      });
    }

    return rates;
  }

  async getLatestEthRate(currency: Currency): Promise<string> {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const exchangeRate = await this.prisma.exchangeRate.findFirst({
      where: { currency },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!exchangeRate || exchangeRate.updatedAt < thirtyMinutesAgo) {
      this.logger.log(
        `Kurs dla waluty ${currency} jest starszy niż 30 minut lub nie istnieje. Pobieram nowe dane...`,
      );

      const newRates = await this.addNewExchangeRates();

      if (!newRates[currency]) {
        throw new Error(
          `Nie udało się zaktualizować kursu dla waluty: ${currency}`,
        );
      }

      return newRates[currency];
    }

    return exchangeRate.rate;
  }

  async getLatestRate(currency: Currency): Promise<ExchangeRate> {
    return this.prisma.exchangeRate.findFirst({
      where: { currency },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  private async fetchEthRatesFromAPI(): Promise<Record<Currency, string>> {
    const apiKey = process.env.COINGECKO_API_KEY; // Klucz API w zmiennej środowiskowej

    const url = `${this.coingeckoApiUrl}?ids=ethereum&vs_currencies=${CurrencyConfig.supportedCurrencies.join(',')}&x-cg-demo-api-key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Błąd API CoinGecko: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    const rates: Record<Currency, string> = {} as Record<Currency, string>;

    for (const currency of CurrencyConfig.supportedCurrencies) {
      const rate = data.ethereum[currency.toLowerCase()];
      if (!rate) {
        throw new Error(`Nie udało się pobrać kursu dla waluty: ${currency}`);
      }
      rates[currency] = rate.toString();
    }

    return rates;
  }
}
