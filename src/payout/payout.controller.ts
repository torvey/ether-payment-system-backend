import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { PayoutService } from 'src/payout/payout.service';
import { TwoFactorService } from 'src/two-factor/two-factor.service';
import { UserRequest } from 'src/user/user.service';
import { PayoutRequestDto } from './dto/payout.dto';

@Controller('payout')
export class PayoutController {
  constructor(
    private readonly payoutService: PayoutService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  @Get()
  async getPayoutAmount(@Req() req: UserRequest) {
    const userId = req.user.userId; // Wyciągamy userId z JWT
    if (!userId) {
      throw new Error('User ID not found in the request.');
    }

    return this.payoutService.getPayoutAmount(userId);
  }

  @Post('generate-code')
  async generateCode(@Req() req: UserRequest) {
    const { email, userId } = req.user;

    await this.twoFactor.generateCode(userId, email);

    return { message: 'Code generated' };
  }

  @Post('schedule')
  async schedulePayout(
    @Req() req: UserRequest,
    @Body() { address, code }: PayoutRequestDto,
  ) {
    const { userId } = req.user;

    if (!userId) {
      throw new Error('User ID not found in the request.');
    }

    if (await this.twoFactor.validateCode(userId, code)) {
      return this.payoutService.schedulePayout(userId, address);
    }

    throw new BadRequestException('Invalid code');
  }
}
