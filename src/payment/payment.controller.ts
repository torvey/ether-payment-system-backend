import {
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

// @UseInterceptors(DynamicCorsInterceptor)
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly prisma: PrismaService,
  ) {}

  // Ten endpoint sluzy do generowania unikalnego ID dla platnosci, ktory jest uzywany
  // do tworzenia iframe czy potem do przeniesienia do płatności
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
    return this.paymentService.getPaymentDetails(token);
  }
}
