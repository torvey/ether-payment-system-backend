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
        price: parseFloat(data.price).toFixed(2),
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

  async getProductTransactions(product: Product, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        payment: {
          productId: product.id,
        },
      },
      skip: offset,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        payment: true,
      },
    });

    // Zwróć transakcje i informację o paginacji
    const totalCount = await this.prisma.transaction.count({
      where: {
        payment: {
          productId: product.id,
        },
      },
    });

    return {
      transactions,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    };
  }

  async generateCode(userId: number, email: string): Promise<string> {
    return this.twoFactor.generateCode(userId, email);
  }

  async validateCode(userId: number, code: string): Promise<boolean> {
    return this.twoFactor.validateCode(userId, code);
  }
}
