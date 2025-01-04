import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WalletBalanceCheckerService } from './services/wallet-balance-checker.service';

@Module({
  imports: [PrismaModule],
  providers: [WalletBalanceCheckerService],
})
export class CheckersModule {}
