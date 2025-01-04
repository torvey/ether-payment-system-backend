import { Injectable } from '@nestjs/common';
import { Currency, Product } from '@prisma/client';
import { FixedNumber } from 'ethers';
import { ExchangeRateService } from 'src/exchange-rate/exchange-rate.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TwoFactorService } from 'src/two-factor/two-factor.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private twoFactor: TwoFactorService,
    private exchangeRateService: ExchangeRateService,
  ) {}

  async create(
    data: {
      name: string;
      price: string;
      description: string;
      currency: Currency;
    },
    userId: number,
  ): Promise<Product> {
    return this.prisma.product.create({
      data: {
        ...data,
        userId,
        price: FixedNumber.fromString(data.price).toFormat('2').toString(),
      },
    });
  }

  async includePriceEth(
    products: Product[],
  ): Promise<(Product & { priceEth: string })[]> {
    return Promise.all(
      products.map(async (product) => {
        const ethRate = await this.exchangeRateService.getLatestEthRate(
          product.currency,
        );
        const price = FixedNumber.fromString(product.price);
        const priceEth = price.divUnsafe(FixedNumber.fromString(ethRate));

        return {
          ...product,
          priceEth: priceEth.toString(),
        };
      }),
    );
  }

  async findAll(): Promise<Product[]> {
    const products = await this.prisma.product.findMany();
    return await this.includePriceEth(products);
  }

  async findOne(id: number): Promise<Product & { priceEth: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const ethRate = FixedNumber.fromString(
      await this.exchangeRateService.getLatestEthRate(product.currency),
    );
    const price = FixedNumber.fromString(product.price);
    const priceEth = price.divUnsafe(ethRate); // Obliczanie ETH

    return {
      ...product,
      priceEth: priceEth.toString(),
    };
  }

  async update(id: number, data: Partial<Product>): Promise<Product> {
    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async remove(id: number): Promise<Product> {
    return this.prisma.product.delete({ where: { id } });
  }

  // private async getEthRate(currency: Currency): Promise<string> {
  //   const rates = {
  //     USD: '1600.00', // 1 ETH = 1600 USD
  //     EURO: '1500.00', // 1 ETH = 1500 EURO
  //     GBP: '1400.00', // 1 ETH = 1400 GBP
  //     PLN: '7000.00', // 1 ETH = 7000 PLN
  //   };

  //   // Tutaj należy zaimplementować logikę pobierania kursu ETH/USD (np. przez API)
  //   if (!rates[currency]) {
  //     throw new Error(`Nieobsługiwana waluta: ${currency}`);
  //   }

  //   return rates[currency];
  // }

  async generateCode(userId: number): Promise<string> {
    return this.twoFactor.generateCode(userId);
  }

  async validateCode(userId: number, code: string): Promise<boolean> {
    return this.twoFactor.validateCode(userId, code);
  }
}
