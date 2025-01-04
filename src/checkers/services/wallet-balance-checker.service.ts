import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { PrismaService } from 'src/prisma/prisma.service';
@Injectable()
export class WalletBalanceCheckerService {
  private readonly logger = new Logger(WalletBalanceCheckerService.name);
  private readonly provider: ethers.providers.JsonRpcProvider;

  constructor(private readonly prisma: PrismaService) {
    // Ustawienie RPC dla sieci Sepolia
    const rpcUrl = process.env.ETHEREUM_RPC_URL;
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkBalances() {
    this.logger.log('Rozpoczynam sprawdzanie sald portfeli...');

    try {
      // Pobieramy wszystkie portfele z bazy danych
      const wallets = await this.prisma.wallet.findMany();

      for (const wallet of wallets) {
        // Sprawdzamy saldo portfela
        const balance = await this.provider.getBalance(wallet.address);
        const balanceInEth = ethers.utils.formatEther(balance);

        // Zapisanie nowego wpisu do tabeli WalletBalance
        await this.prisma.walletBalance.create({
          data: {
            walletId: wallet.id,
            balance_eth: balanceInEth,
          },
        });

        this.logger.log(
          `Dodano wpis dla portfela ${wallet.address}: ${balanceInEth} ETH`,
        );
      }
    } catch (error) {
      this.logger.error('Błąd podczas sprawdzania sald portfeli:', error);
    }

    this.logger.log('Zakończono sprawdzanie sald portfeli.');
  }
}
