import { Module } from '@nestjs/common';
import { ExchangeRateModule } from 'src/exchange-rate/exchange-rate.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ProductsModule } from 'src/products/products.module';
import { TransactionModule } from 'src/transaction/transaction.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [
    PrismaModule,
    ProductsModule,
    ExchangeRateModule,
    WalletModule,
    TransactionModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
