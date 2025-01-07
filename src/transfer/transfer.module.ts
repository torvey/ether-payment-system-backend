import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { TransferService } from './transfer.service';

@Module({
  imports: [PrismaModule, WalletModule],
  providers: [TransferService],
  exports: [TransferService],
})
export class TransferModule {}
