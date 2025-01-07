import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { PrismaService } from 'src/prisma/prisma.service';
import { TransferService } from 'src/transfer/transfer.service';

@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transferService: TransferService,
  ) {}

  async schedulePayout(userId: number, address: string) {
    const { amount } = await this.getPayoutAmount(userId);

    if (ethers.BigNumber.from(amount).isZero()) {
      throw new BadRequestException('No funds available for payout.');
    }

    await this.prisma.scheduledPayout.create({
      data: {
        userId,
        amount,
        address,
        status: 'pending',
      },
    });

    return {
      message: 'Payout has been scheduled successfully.',
      scheduled: true,
    };
  }

  // Pobierz kwotę do wypłaty dla użytkownika
  async getPayoutAmount(userId: number): Promise<{ amount: string }> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        payment: {
          product: {
            userId,
          },
        },
        type: 'external',
      },
    });

    const totalAmount = transactions.reduce((sum, tx) => {
      return sum.add(ethers.BigNumber.from(ethers.utils.parseEther(tx.amount)));
    }, ethers.BigNumber.from(0));

    return { amount: ethers.utils.formatEther(totalAmount) };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledPayouts() {
    const pendingPayouts = await this.prisma.scheduledPayout.findMany({
      where: {
        status: 'pending',
      },
    });

    if (pendingPayouts.length === 0) {
      this.logger.log('No pending payouts found.');
      return;
    }

    const mainWallet = await this.prisma.wallet.findFirst({
      where: { isMain: true },
    });

    if (!mainWallet) {
      throw new Error('Main wallet not found.');
    }

    const provider = new ethers.providers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL,
    );
    const balance = await provider.getBalance(mainWallet.address);

    for (const payout of pendingPayouts) {
      try {
        if (
          ethers.BigNumber.from(balance).lt(
            ethers.BigNumber.from(payout.amount),
          )
        ) {
          this.logger.log(
            `Insufficient funds for payout ID ${payout.id}. Skipping to the next.`,
          );
          continue;
        }

        const tx = await this.transferService.executeTransfer(
          mainWallet.id,
          payout.address,
          payout.amount,
        );

        await this.prisma.scheduledPayout.update({
          where: { id: payout.id },
          data: {
            status: 'completed',
            updatedAt: new Date(),
          },
        });

        this.logger.log(
          `Payout ID ${payout.id} completed successfully. Transaction hash: ${tx.hash}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process payout ID ${payout.id}. Reason: ${error.message}`,
        );
      }
    }
  }
}
