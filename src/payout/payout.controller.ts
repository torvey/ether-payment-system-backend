import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { PayoutService } from 'src/payout/payout.service';
import { UserRequest } from 'src/user/user.service';
import { PayoutRequestDto } from './dto/payout.dto';

@Controller('payout')
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Get()
  async getPayoutAmount(@Req() req: UserRequest) {
    const userId = req.user.userId; // Wyciągamy userId z JWT
    if (!userId) {
      throw new Error('User ID not found in the request.');
    }

    return this.payoutService.getPayoutAmount(userId);
  }

  @Post()
  async initiatePayout(
    @Req() req: UserRequest,
    @Body() payoutRequestDto: PayoutRequestDto,
  ) {
    const userId = req.user?.userId;

    if (!userId) {
      throw new Error('User ID not found in the request.');
    }

    return this.payoutService.schedulePayout(userId, payoutRequestDto.address);
  }
}
