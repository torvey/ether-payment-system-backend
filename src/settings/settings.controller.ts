import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { UserRequest } from 'src/user/user.service';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  async getSettings(@Req() req: UserRequest) {
    return this.settings.getSettings(req.user.userId);
  }

  @Post('save')
  async saveSettings(
    @Req() req: UserRequest,
    @Body() { domainName }: { domainName: string },
  ) {
    if (!domainName) {
      throw new Error('Domain name is required');
    }

    return this.settings.saveDomainName(req.user.userId, domainName);
  }
}
