import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { TransactionService } from 'src/transaction/transaction.service';
import { UserRequest } from 'src/user/user.service';

@Controller('transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  async getUserTransactions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Req() req: UserRequest,
  ) {
    const userId = req.user.userId;

    if (!userId) {
      throw new BadRequestException('User ID not found in the request.');
    }

    return this.transactionService.getTransactionsForUser(
      userId,
      Number(page),
      Number(limit),
    );
  }
}
