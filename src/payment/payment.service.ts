import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentStatus, PaymentStatusEnum, Product } from '@prisma/client';
import { FixedNumber } from 'ethers';
import { ExchangeRateService } from 'src/exchange-rate/exchange-rate.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductsService } from 'src/products/products.service';
import { WalletService } from 'src/wallet/wallet.service';
import { v4 as uuidv4 } from 'uuid'; // Biblioteka do generowania unikalnych identyfikatorów

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly exchangeRates: ExchangeRateService,
    private readonly walletService: WalletService,
  ) {}

  private getAmountInEth(priceEth: string, quantity: number): string {
    return FixedNumber.fromString(priceEth)
      .mulUnsafe(FixedNumber.fromString(quantity.toString()))
      .toString();
  }

  private async getPriceInEth(product: Product): Promise<string> {
    const [productEthPrice] = await this.products.includePriceEth([product]);

    return productEthPrice.priceEth;
  }

  async generatePaymentToken(
    productId: number,
    quantity: number,
    customerId: string,
  ): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Produkt o ID ${productId} nie istnieje.`);
    }

    const existingPayment = await this.prisma.payment.findFirst({
      where: {
        productId,
        quantity,
        customerId,
        PaymentStatus: {
          every: {
            name: 'pending',
          },
        },
      },
    });

    if (existingPayment) {
      return existingPayment.token; // Zwracamy istniejący link
    }

    // Generowanie nowego linku
    const token = uuidv4(); // Generujemy unikalny link

    const ethPrice = await this.getPriceInEth(product);
    const totalAmount = this.getAmountInEth(ethPrice, quantity);
    const newestExchangeRate = await this.exchangeRates.getLatestRate(
      product.currency,
    );

    const walletId = await this.walletService.getWalletForPayment();

    const payment = await this.prisma.payment.create({
      data: {
        productId,
        quantity,
        customerId,
        expiresAt,
        token,
        totalAmount,
        exchangeRateId: newestExchangeRate.id,
        walletId,
        PaymentStatus: {
          create: {
            name: 'pending',
          },
        },
      },
    });

    return payment.token;
  }

  async getPaymentInfo(token: string): Promise<{
    name: string;
    amount: string;
    cryptocurrency: string;
  }> {
    const payment = await this.prisma.payment.findUnique({
      where: {
        token,
      },
      include: {
        PaymentStatus: true,
        product: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Płatność nie istnieje.');
    }

    if (this.checkStatus(payment.PaymentStatus, 'completed')) {
      throw new BadRequestException('Płatność jest już zakończona.');
    }

    if (this.checkStatus(payment.PaymentStatus, 'expired')) {
      throw new BadRequestException('Płatność wygasła.');
    }

    if (this.checkStatus(payment.PaymentStatus, 'failed')) {
      throw new BadRequestException('Płatność zakończona niepowodzeniem.');
    }

    if (new Date() > payment.expiresAt) {
      await this.updatePaymentStatus(token);
      throw new NotFoundException('Płatność wygasła.');
    }

    return {
      name: payment.product.name,
      amount: payment.totalAmount,
      cryptocurrency: payment.cryptocurrency,
    };
  }

  private checkStatus(
    paymentStatus: PaymentStatus[],
    status: PaymentStatusEnum,
  ): boolean {
    if (status === 'pending') return paymentStatus.length === 1;

    return paymentStatus.some((item) => item.name === status);
  }

  async getPaymentDetails(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        token: id,
      },
      include: {
        PaymentStatus: true,
        product: true,
        wallet: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Płatność nie istnieje.');
    }

    if (this.checkStatus(payment.PaymentStatus, 'completed')) {
      throw new BadRequestException('Płatność jest już zakończona.');
    }

    if (this.checkStatus(payment.PaymentStatus, 'expired')) {
      throw new BadRequestException('Płatność wygasła.');
    }

    if (this.checkStatus(payment.PaymentStatus, 'failed')) {
      throw new BadRequestException('Płatność zakończona niepowodzeniem.');
    }

    if (new Date() > payment.expiresAt) {
      await this.updatePaymentStatus(id);
      throw new NotFoundException('Płatność wygasła');
    }

    return {
      id: payment.id,
      name: payment.product.name,
      amount: payment.totalAmount,
      cryptocurrency: payment.cryptocurrency,
      address: payment.wallet.address,
    };
  }

  async updatePaymentStatus(
    token: string,
    newStatus?: Exclude<PaymentStatusEnum, 'pending' | 'expired'>,
  ): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { token },
      include: {
        PaymentStatus: true,
      },
    });

    if (payment.PaymentStatus.some((status) => status.name !== 'pending')) {
      throw new BadRequestException(
        `Status płatności nie może być zmieniony, ponieważ płatność jest już zakończona.`,
      );
    }

    if (!payment) {
      throw new NotFoundException('Płatność nie istnieje.');
    }

    if (new Date() > payment.expiresAt) {
      await this.prisma.paymentStatus.create({
        data: {
          name: 'expired',
          paymentId: payment.id,
          createdAt: new Date(),
        },
      });
      return;
    }

    if (!newStatus) {
      throw new BadRequestException('Brak nowego statusu płatności.');
    }

    // Aktualizacja statusu płatność
    await this.prisma.paymentStatus.create({
      data: {
        name: newStatus,
        paymentId: payment.id,
        createdAt: new Date(),
      },
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expirePayments() {
    const now = new Date();

    // Pobieramy płatności, które wygasły
    const expiredPayments = await this.prisma.payment.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
        PaymentStatus: {
          every: {
            name: 'pending',
          },
        },
      },
    });

    if (expiredPayments.length === 0) {
      return;
    }

    // Aktualizujemy status każdej płatności na `expired`
    for (const payment of expiredPayments) {
      await this.prisma.paymentStatus.create({
        data: {
          name: 'expired',
          paymentId: payment.id,
          createdAt: now,
        },
      });
    }

    console.log(`${expiredPayments.length} - przeterminowane płatności.`);
  }
}
