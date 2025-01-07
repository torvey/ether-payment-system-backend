import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TwoFactorModule } from 'src/two-factor/two-factor.module';
import { UserModule } from 'src/user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthorizationTokenService } from './authorization-token.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRATION },
    }),
    UserModule,
    TwoFactorModule,
    PrismaModule,
  ],
  providers: [AuthService, JwtStrategy, AuthorizationTokenService],
  controllers: [AuthController],
})
export class AuthModule {}
