import { Module } from '@nestjs/common';
import { ExchangeRateModule } from 'src/exchange-rate/exchange-rate.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TwoFactorModule } from 'src/two-factor/two-factor.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, TwoFactorModule, ExchangeRateModule],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
