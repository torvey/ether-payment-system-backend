import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TransferModule } from 'src/transfer/transfer.module';
import { TwoFactorModule } from 'src/two-factor/two-factor.module';
import { PayoutController } from './payout.controller';
import { PayoutService } from './payout.service';

@Module({
  imports: [PrismaModule, TransferModule, TwoFactorModule],
  providers: [PayoutService],
  controllers: [PayoutController],
})
export class PayoutModule {}
