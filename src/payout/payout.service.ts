import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Cryptocurrency } from '@prisma/client';
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

    const parsedAmount = ethers.utils.parseEther(amount);

    if (parsedAmount.isZero()) {
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
  async getPayoutAmount(
    userId: number,
  ): Promise<{ amount: string; currency: Cryptocurrency }> {
    const lastValidPayout = await this.prisma.scheduledPayout.findFirst({
      where: {
        userId,
        status: {
          in: ['pending', 'completed'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let lastPayoutDate = new Date(0);

    if (lastValidPayout) {
      lastPayoutDate = lastValidPayout.createdAt;
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        payment: {
          product: {
            userId,
          },
        },
        type: 'external',
        createdAt: {
          gt: lastPayoutDate,
        },
      },
    });

    const totalAmount = transactions.reduce((sum, tx) => {
      return sum.add(ethers.BigNumber.from(ethers.utils.parseEther(tx.amount)));
    }, ethers.BigNumber.from(0));

    return {
      amount: ethers.utils.formatEther(totalAmount),
      currency: 'ETH',
    };
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

    for (const payout of pendingPayouts) {
      try {
        const balance = await provider.getBalance(mainWallet.address);
        const payoutAmountInWei = ethers.utils.parseEther(payout.amount);

        if (balance.lt(payoutAmountInWei)) {
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

        await this.prisma.transaction.create({
          data: {
            walletId: mainWallet.id,
            transactionHash: tx.hash,
            from: mainWallet.address,
            to: payout.address,
            amount: payout.amount,
            type: 'payout',
            createdAt: new Date(),
          },
        });

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
        console.log(error);
        this.logger.error(
          `Failed to process payout ID ${payout.id}. Reason: ${error.message}`,
        );
      }
    }
  }
}
