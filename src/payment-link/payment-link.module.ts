import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PaymentLinkController } from './payment-link.controller';
import { PaymentLinkService } from './payment-link.service';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentLinkController],
  providers: [PaymentLinkService],
})
export class PaymentLinkModule {}
