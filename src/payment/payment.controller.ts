import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { Public } from 'src/auth/public.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import { GeneratePaymentLinkDto } from './dto/generate-payment-link.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('token')
  async generateToken(
    @Body() { customerId, productId, quantity }: GeneratePaymentLinkDto,
    @Headers('origin') requestOrigin: string,
  ): Promise<{ token: string }> {
    let domain: string | undefined;

    try {
      const url = new URL(requestOrigin);
      domain = url.host;
    } catch (error) {
      throw new ForbiddenException('Invalid Origin header.');
    }

    const settings = await this.prisma.settings.findFirst({
      where: { domainName: domain },
    });

    if (!settings) {
      throw new ForbiddenException('Domain not recognized.');
    }

    const { userId } = settings;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.userId !== userId) {
      throw new NotFoundException('Product not found.');
    }

    const token = await this.paymentService.generatePaymentToken(
      productId,
      quantity,
      customerId,
    );
    return { token };
  }

  @Public()
  @Get('info/:token')
  async getPaymentInfo(
    @Param('token') token: string,
  ): Promise<{ name: string; amount: string; cryptocurrency: string }> {
    return this.paymentService.getPaymentInfo(token);
  }

  @Public()
  @Get('details/:token')
  async getPaymentDetails(@Param('token') token: string) {
    try {
      const { payment, transaction, status } =
        await this.paymentService.getPaymentDetails(token);

      if (!payment) {
        throw new NotFoundException('Płatność nie istnieje.');
      }

      const data = {
        id: payment.id,
        name: payment.product.name,
        amount: payment.totalAmount,
        cryptocurrency: payment.cryptocurrency,
        address: payment.wallet.address,
        hash: transaction?.transactionHash,
      };

      if (status === 'failed') {
        throw new BadRequestException('Płatność zakończona niepowodzeniem.');
      }

      if (status === 'expired') {
        return {
          status,
          message: 'Płatność wygasła.',
          data,
        };
      }

      if (new Date() > payment.expiresAt && status === 'pending') {
        await this.paymentService.updatePaymentStatus(token);
        return {
          status: 'expired',
          message: 'Płatność wygasła.',
          data,
        };
      }

      if (status === 'completed') {
        return {
          status,
          message: 'Płatność została zakończona pomyślnie.',
          data,
        };
      }

      return {
        status,
        message: 'Płatność w toku',
        data,
      };
    } catch (e) {
      throw new BadRequestException('Wystąpił nieoczekiwany błąd');
    }
  }

  @Public()
  @Post('check-transactions/:token')
  async checkTransactions(@Param('token') token: string) {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: {
          token,
        },
        include: {
          PaymentStatus: true,
          wallet: true,
        },
      });

      const status = this.paymentService.getStatus(payment.PaymentStatus);

      if (status !== 'pending') {
        return {
          status,
          message: 'Sprawdzanie zakończono pomyślnie',
        };
      }

      await this.paymentService.manualProcessPayments(payment.wallet.address);

      return {
        status,
        message: 'Sprawdzanie zakończono pomyślnie',
      };
    } catch (e) {
      throw new BadRequestException('Wystąpił nieoczekiwany błąd');
    }
  }
}
