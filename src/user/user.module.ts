import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SettingsModule } from 'src/settings/settings.module';
import { UserService } from './user.service';

@Module({
  imports: [PrismaModule, SettingsModule],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
