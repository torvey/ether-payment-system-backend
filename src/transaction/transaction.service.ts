import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import * as pLimit from 'p-limit';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TransactionService {
  private readonly provider: ethers.providers.EtherscanProvider;
  private readonly limit = pLimit(5);

  constructor(private readonly prisma: PrismaService) {
    this.provider = new ethers.providers.EtherscanProvider(
      process.env.ETHEREUM_NETWORK,
      process.env.ETHERSCAN_API_KEY,
    );
  }

  async getTransactionsForWallet(
    address: string,
  ): Promise<ethers.providers.TransactionResponse[]> {
    return this.limit(async () => {
      try {
        return this.provider.getHistory(address);
      } catch (error) {
        throw error;
      }
    });
  }

  async saveTransaction(
    paymentId: number,
    walletId: number,
    tx: ethers.providers.TransactionResponse,
    paymentCreatedAt: Date,
    type: 'external' | 'internal',
  ) {
    try {
      const existingTransaction = await this.prisma.transaction.findUnique({
        where: { transactionHash: tx.hash },
      });

      const transactionTimestamp = new Date(tx.timestamp * 1000);

      if (existingTransaction || transactionTimestamp < paymentCreatedAt) {
        return;
      }

      await this.prisma.transaction.create({
        data: {
          paymentId,
          walletId,
          transactionHash: tx.hash,
          from: tx.from,
          to: tx.to,
          amount: ethers.utils.formatEther(tx.value),
          type,
        },
      });
    } catch (e) {
      throw e;
    }
  }

  async getTotalReceivedForPayment(paymentId: number): Promise<string> {
    try {
      const transactions = await this.prisma.transaction.findMany({
        where: {
          paymentId,
          type: 'external',
        },
      });

      const total = transactions.reduce((acc, tx) => {
        return acc.add(ethers.utils.parseEther(tx.amount));
      }, ethers.BigNumber.from(0));

      return ethers.utils.formatEther(total);
    } catch (e) {
      throw e;
    }
  }

  async getTransactionsForUser(userId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const transactions = await this.prisma.transaction.findMany({
      where: {
        payment: {
          product: {
            userId,
          },
        },
      },
      skip: offset,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        payment: true,
      },
    });

    // Oblicz całkowitą liczbę transakcji
    const totalCount = await this.prisma.transaction.count({
      where: {
        payment: {
          product: {
            userId,
          },
        },
      },
    });

    return {
      transactions,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
    };
  }
}
