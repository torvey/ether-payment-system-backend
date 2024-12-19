import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TwoFactorModule } from 'src/two-factor/two-factor.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [PrismaModule, TwoFactorModule],
  providers: [ProductsService],
  controllers: [ProductsController],
})
export class ProductsModule {}
