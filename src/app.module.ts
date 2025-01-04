import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import * as cors from 'cors';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CheckersModule } from './checkers/checkers.module';
import { DynamicCorsMiddleware } from './dynamic-cors.middleware';
import { PaymentModule } from './payment/payment.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SettingsModule } from './settings/settings.module';

const globalCors = cors({
  origin: process.env.FRONTEND_ORIGIN,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
});

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    SettingsModule,
    ProductsModule,
    PaymentModule,
    CheckersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(DynamicCorsMiddleware)
      .forRoutes({ path: 'payment/token', method: RequestMethod.ALL });

    consumer
      .apply(globalCors)
      .exclude({ path: 'payment/token', method: RequestMethod.ALL })
      .forRoutes('*');
  }
}
