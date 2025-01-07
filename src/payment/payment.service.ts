import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Payment,
  PaymentStatus,
  PaymentStatusEnum,
  Product,
  Transaction,
  Wallet,
} from '@prisma/client';
import { ethers, FixedNumber } from 'ethers';
import { ExchangeRateService } from 'src/exchange-rate/exchange-rate.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductsService } from 'src/products/products.service';
import { TransactionService } from 'src/transaction/transaction.service';
import { WalletService } from 'src/wallet/wallet.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly exchangeRates: ExchangeRateService,
    private readonly walletService: WalletService,
    private readonly transactionService: TransactionService,
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

  getStatus(paymentStatus: PaymentStatus[]): PaymentStatusEnum {
    if (paymentStatus.length === 1) return 'pending';

    const statuses: PaymentStatusEnum[] = ['completed', 'expired', 'failed'];

    return statuses.filter((status) =>
      paymentStatus.map(({ name }) => name).includes(status),
    )[0];
  }

  async getPaymentDetails(id: string): Promise<{
    status: PaymentStatusEnum;
    payment: Payment & {
      product: Product;
      wallet: Wallet;
      PaymentStatus: PaymentStatus[];
    };
    transaction: Transaction;
  }> {
    const payment = await this.prisma.payment.findUnique({
      where: {
        token: id,
      },
      include: {
        PaymentStatus: true,
        product: true,
        wallet: true,
        Transaction: true,
      },
    });

    let transaction: Transaction | undefined = undefined;

    if (payment.Transaction.length === 1) {
      [transaction] = payment.Transaction;
    }

    return {
      status: this.getStatus(payment.PaymentStatus),
      payment,
      transaction,
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

  private async processPayment(payment: Payment & { wallet: Wallet }) {
    try {
      const { wallet, totalAmount, createdAt } = payment;

      this.logger.log(
        `Processing payment ID: ${payment.id} for wallet: ${wallet.address}`,
      );

      this.logger.log(`Fetching transactions for wallet: ${wallet.address}`);

      const transactions =
        await this.transactionService.getTransactionsForWallet(wallet.address);

      const relevantTransactions = transactions.filter(
        (tx) =>
          tx.timestamp >= Math.floor(createdAt.getTime() / 1000) &&
          tx.to?.toLowerCase() === wallet.address.toLowerCase(),
      );

      this.logger.log(
        `Found ${relevantTransactions.length} transactions for wallet: ${wallet.address} and for payment ID: ${payment.id}`,
      );

      await Promise.all(
        relevantTransactions.map((tx) =>
          this.transactionService.saveTransaction(
            payment.id,
            wallet.id,
            tx,
            payment.createdAt,
            'external',
          ),
        ),
      );

      this.logger.log(
        ` New transactions for wallet: ${wallet.address} saved in database.`,
      );

      const totalReceived = relevantTransactions.reduce((sum, tx) => {
        return sum.add(ethers.BigNumber.from(tx.value));
      }, ethers.BigNumber.from(0));

      this.logger.log(
        `Total received for payment ID ${payment.id}: ${ethers.utils.formatEther(totalReceived)} ${payment.cryptocurrency}`,
      );

      // Sprawdzamy, czy wpłacono wystarczającą ilość środków
      if (totalReceived.gte(ethers.utils.parseEther(totalAmount))) {
        await this.prisma.paymentStatus.create({
          data: {
            name: 'completed',
            paymentId: payment.id,
            createdAt: new Date(),
          },
        });

        this.logger.log(`Payment ID ${payment.id} marked as completed.`);
        return;
      }

      this.logger.warn(
        `Payment ID ${payment.id} has insufficient funds. Received: ${ethers.utils.formatEther(
          totalReceived,
        )} ETH, Required: ${totalAmount} ETH`,
      );
    } catch (paymentError) {
      this.logger.error(
        `Error processing payment ID: ${payment.id}`,
        paymentError.stack,
      );
      throw paymentError;
    }
  }

  async handleNotFinnishedPayment(
    payment: Payment & { Transaction: Transaction[] },
    now: Date,
  ) {
    const hasAnyTransaction = !!payment.Transaction.length;

    if (hasAnyTransaction) {
      await this.prisma.paymentStatus.create({
        data: {
          name: 'failed',
          paymentId: payment.id,
          createdAt: now,
        },
      });
      this.logger.warn(
        `Payment ID ${payment.id} marked as failed (has transactions).`,
      );
    } else {
      await this.prisma.paymentStatus.create({
        data: {
          name: 'expired',
          paymentId: payment.id,
          createdAt: now,
        },
      });
      this.logger.warn(`Payment ID ${payment.id} marked as expired.`);
    }
  }

  async handlePayments(
    pendingPayments: Array<
      Payment & { wallet: Wallet; Transaction: Transaction[] }
    >,
  ) {
    const now = new Date();

    if (!pendingPayments.length) {
      this.logger.log(`No pending payments found.`);
      return;
    }

    await Promise.all(
      pendingPayments.map((payment) => {
        const isExpired = payment.expiresAt <= now;

        if (isExpired) {
          return this.handleNotFinnishedPayment(payment, now);
        } else {
          return this.processPayment(payment);
        }
      }),
    );
  }

  async manualProcessPayments(address: string) {
    this.logger.log(`Starting to process payments manually.`);

    try {
      const pendingPayments = await this.prisma.payment.findMany({
        where: {
          PaymentStatus: {
            every: { name: 'pending' },
          },
          wallet: {
            address,
          },
        },
        include: {
          wallet: true,
          Transaction: true,
        },
      });

      await this.handlePayments(pendingPayments);

      this.logger.log(`Finished processing manually payments.`);
    } catch (e) {
      this.logger.error(`Failed to process manually payments.`, e.stack);
      throw e;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async autoProcessPayments() {
    this.logger.log(`Starting to process payments automatically.`);

    try {
      // Pobierz płatności `pending`
      const pendingPayments = await this.prisma.payment.findMany({
        where: {
          PaymentStatus: {
            every: { name: 'pending' },
          },
        },
        include: {
          wallet: true,
          Transaction: true,
        },
      });

      this.handlePayments(pendingPayments);

      this.logger.log(`Finished processing automaticaly payments.`);
    } catch (e) {
      this.logger.error(`Failed to process automaticaly payments.`, e.stack);
      throw e;
    }
  }
}
