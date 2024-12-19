import { Injectable } from '@nestjs/common';
import { Product } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TwoFactorService } from 'src/two-factor/two-factor.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private twoFactor: TwoFactorService,
  ) {}

  async create(
    data: {
      name: string;
      priceUsd: number;
      description: string;
    },
    userId: number,
  ): Promise<Product> {
    return this.prisma.product.create({
      data: {
        ...data,
        userId,
      },
    });
  }

  private async includePriceEth(products: Product[]): Promise<Product[]> {
    const ethRate = await this.getEthRate(); // Pobierz kurs ETH
    return products.map((product) => ({
      ...product,
      priceEth: product.priceUsd / ethRate,
    }));
  }

  async findAll(): Promise<Product[]> {
    const products = await this.prisma.product.findMany();
    return await this.includePriceEth(products);
  }

  async findOne(id: number): Promise<Product & { priceEth: number }> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const ethRate = await this.getEthRate(); // Pobierz kurs ETH

    return {
      ...product,
      priceEth: product.priceUsd / ethRate,
    };
  }

  async update(id: number, data: Partial<Product>): Promise<Product> {
    return this.prisma.product.update({ where: { id }, data });
  }

  async remove(id: number): Promise<Product> {
    return this.prisma.product.delete({ where: { id } });
  }

  private async getEthRate(): Promise<number> {
    // Tutaj należy zaimplementować logikę pobierania kursu ETH/USD (np. przez API)
    return 1600; // Przykładowa wartość kursu ETH
  }

  async generateCode(userId: number): Promise<string> {
    return this.twoFactor.generateCode(userId);
  }

  async validateCode(userId: number, code: string): Promise<boolean> {
    return this.twoFactor.validateCode(userId, code);
  }
}
