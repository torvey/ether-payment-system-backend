import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { decrypt } from 'ops/scripts/crypto-utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { WalletService } from 'src/wallet/wallet.service';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);
  private readonly networkFeeLimit = ethers.utils.parseUnits('0.01', 'ether');

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  async executeTransfer(fromWalletId: number, to: string, amount: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: fromWalletId },
    });

    if (!wallet) {
      throw new Error(`Wallet with ID ${fromWalletId} not found.`);
    }

    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const balance = await provider.getBalance(wallet.address);

    if (ethers.BigNumber.from(balance).lt(ethers.BigNumber.from(amount))) {
      throw new Error('Insufficient funds for transfer.');
    }

    const gasPrice = await provider.getGasPrice();
    const gasLimit = 21000; // Typowa wartość dla prostego transferu ETH
    const totalGasCost = gasPrice.mul(gasLimit);

    if (totalGasCost.gt(this.networkFeeLimit)) {
      throw new Error(
        `Gas fee too high: ${ethers.utils.formatEther(totalGasCost)} ETH. `,
      );
    }

    const maxValue = ethers.BigNumber.from(amount).sub(totalGasCost);

    const decryptedPrivateKey = await this.decryptPrivateKey(
      wallet.encryptedPrivateKey,
    );
    const signer = new ethers.Wallet(decryptedPrivateKey, provider);

    const tx = await signer.sendTransaction({
      to,
      value: maxValue,
      gasPrice,
    });

    return tx;
  }

  async transferToMainAccount(): Promise<void> {
    try {
      const mainWallet = await this.prisma.wallet.findFirst({
        where: { isMain: true },
      });

      if (!mainWallet) {
        throw new Error('Main wallet not found.');
      }

      const subWallets = await this.prisma.wallet.findMany({
        where: { isMain: false },
        include: { balances: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });

      if (subWallets.length === 0) {
        this.logger.warn('No subaccounts found for transfer.');
        return;
      }

      const transactions = [];

      for (const wallet of subWallets) {
        const [{ balance_eth: balance }] = wallet.balances;

        if (!balance || ethers.utils.parseEther(balance).isZero()) {
          this.logger.warn(`Wallet ${wallet.address} has no funds.`);
          continue;
        }

        const gasPrice = await this.getGasPrice();

        if (gasPrice.gt(this.networkFeeLimit)) {
          this.logger.warn(
            `Network fee (${ethers.utils.formatEther(
              gasPrice,
            )} ETH) is higher than the limit (${ethers.utils.formatEther(this.networkFeeLimit)} ETH).`,
          );
          continue;
        }

        // Przygotuj transakcję
        transactions.push({
          from: wallet.address,
          to: mainWallet.address,
          value: balance,
        });
      }

      if (transactions.length === 0) {
        this.logger.warn('No transactions to process.');
        return;
      }

      // Przelej środki
      for (const tx of transactions) {
        await this.processTransaction(tx.from, tx.to);
      }

      this.logger.log(
        'Finished daily transfer from subaccounts to main account.',
      );
    } catch (error) {
      this.logger.error('Error during daily transfer.', error.stack);
    }
  }

  private async getGasPrice(): Promise<ethers.BigNumber> {
    // Możemy użyć providera np. ethers.js
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL,
    );
    return await provider.getGasPrice();
  }

  private async processTransaction(
    from: string,
    to: string,
    // value: string,
    // gasPrice: string,
  ) {
    try {
      // Odszyfruj klucz prywatny
      const wallet = await this.walletService.getWalletByAddress(from);
      const decryptedPrivateKey = await this.decryptPrivateKey(
        wallet.encryptedPrivateKey,
      );

      const provider = new ethers.providers.JsonRpcProvider(
        process.env.ETHEREUM_RPC_URL,
      );

      const balance = await provider.getBalance(wallet.address);

      const signer = new ethers.Wallet(decryptedPrivateKey, provider);

      const gasPrice = await this.getGasPrice();
      const gasLimit = 21000;
      const totalGasCost = gasPrice.mul(gasLimit);

      if (balance.lt(totalGasCost)) {
        throw new Error(
          `Insufficient funds. Balance: ${ethers.utils.formatEther(balance)} ETH, required: ${ethers.utils.formatEther(totalGasCost)} ETH`,
        );
      }

      const maxValue = balance.sub(totalGasCost);

      const tx = await signer.sendTransaction({
        to,
        value: maxValue,
        gasPrice,
      });

      this.logger.log(
        `Transaction ${tx.hash} sent from ${from} to ${to} with value ${ethers.utils.formatEther(
          maxValue,
        )} ETH.`,
      );

      await this.prisma.transaction.create({
        data: {
          transactionHash: tx.hash,
          from,
          to,
          amount: ethers.utils.formatEther(maxValue),
          type: 'internal', // Typ transakcji: wewnętrzna
          createdAt: new Date(), // Data transakcji
          walletId: wallet.id, // ID portfela źródłowego
          paymentId: 0,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to process transaction from ${from} to ${to}:`,
        error.stack,
      );
    }
  }

  private async decryptPrivateKey(
    encryptedPrivateKey: string,
  ): Promise<string> {
    return decrypt(encryptedPrivateKey);
  }

  @Cron('0 0 * * *') // Codziennie o północy
  //   @Cron(CronExpression.EVERY_MINUTE) // Codziennie o północy
  async dailyTransfer() {
    this.logger.log(
      'Starting daily transfer from subaccounts to main account.',
    );
    await this.transferToMainAccount();
  }
}
