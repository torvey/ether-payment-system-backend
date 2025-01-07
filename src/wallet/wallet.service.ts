import { BadRequestException, Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { encrypt } from 'ops/scripts/crypto-utils';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async createMainWallet(
    address: string,
    encryptedPrivateKey: string,
  ): Promise<void> {
    // Sprawdzenie, czy istnieje już konto główne
    const mainWalletExists = await this.prisma.wallet.findFirst({
      where: { isMain: true },
    });

    if (mainWalletExists) {
      throw new BadRequestException(
        'Konto główne już istnieje. Nie można utworzyć drugiego.',
      );
    }

    // Tworzenie konta głównego
    await this.prisma.wallet.create({
      data: {
        address,
        encryptedPrivateKey,
        isMain: true,
      },
    });
  }

  async getWalletByAddress(address: string) {
    return this.prisma.wallet.findUnique({
      where: { address },
    });
  }

  async createWallet(): Promise<{ id: number; address: string }> {
    const wallet = ethers.Wallet.createRandom();

    const newWallet = await this.prisma.wallet.create({
      data: {
        address: wallet.address,
        encryptedPrivateKey: encrypt(wallet.privateKey),
      },
    });

    return { id: newWallet.id, address: newWallet.address };
  }

  async getWalletForPayment(): Promise<number> {
    const wallets = await this.prisma.wallet.findMany({
      where: {
        isMain: false,
        Payment: {
          none: {
            PaymentStatus: {
              every: {
                name: 'pending',
              },
            },
          },
        },
      },
      include: {
        balances: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const sortedWallets = wallets.sort((a, b) => {
      const balanceA = a.balances[0]?.balance_eth;
      const balanceB = b.balances[0]?.balance_eth;
      return balanceB.localeCompare(balanceA);
    });

    if (sortedWallets.length > 0) {
      const { id } = sortedWallets[0];

      return id;
    }
    const { id } = await this.createWallet();

    return id;
  }
}
