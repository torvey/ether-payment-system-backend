import { Body, Controller, Post } from '@nestjs/common';
import { GeneratePaymentLinkDto } from './dto/generate-payment-link.dto';
import { PaymentLinkService } from './payment-link.service';

@Controller('payment-link')
export class PaymentLinkController {
  constructor(private readonly paymentLinkService: PaymentLinkService) {}

  @Post()
  async generateLink(
    @Body() { customerId, productId, quantity }: GeneratePaymentLinkDto,
  ): Promise<{ link: string }> {
    const link = await this.paymentLinkService.generatePaymentLink(
      productId,
      quantity,
      customerId,
    );
    return { link };
  }
}
