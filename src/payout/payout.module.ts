import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TransferModule } from 'src/transfer/transfer.module';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';

@Module({
  imports: [PrismaModule, TransferModule],
  providers: [PayoutService],
  controllers: [PayoutController],
})
export class PayoutModule {}
