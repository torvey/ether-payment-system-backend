import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { encrypt } from './crypto-utils'; // Import funkcji szyfrowania

const prisma = new PrismaClient();

async function initializeWallets() {
  console.log('Rozpoczynam inicjalizację kont...');

  // Sprawdzenie, czy istnieje już konto główne
  const mainWalletExists = await prisma.wallet.findFirst({
    where: { isMain: true },
  });

  if (mainWalletExists) {
    console.error('Konto główne już istnieje. Przerywam inicjalizację.');
    return;
  }

  // Tworzenie głównego konta
  const mainWallet = ethers.Wallet.createRandom();
  const mainAddress = mainWallet.address;
  const encryptedPrivateKey = encrypt(mainWallet.privateKey);

  console.log(`Główne konto: ${mainAddress}`);

  const mainWalletRecord = await prisma.wallet.create({
    data: {
      address: mainAddress,
      encryptedPrivateKey,
      isMain: true,
    },
  });

  await prisma.walletBalance.create({
    data: {
      walletId: mainWalletRecord.id,
      balance_eth: '0',
    },
  });

  // Tworzenie kont pobocznych
  for (let i = 0; i < 10; i++) {
    const sideWallet = ethers.Wallet.createRandom();
    const encryptedPrivateKey = encrypt(sideWallet.privateKey);

    console.log(`Konto poboczne ${i + 1}: ${sideWallet.address}`);

    const sideWalletRecord = await prisma.wallet.create({
      data: {
        address: sideWallet.address,
        encryptedPrivateKey,
        isMain: false,
      },
    });

    await prisma.walletBalance.create({
      data: {
        walletId: sideWalletRecord.id,
        balance_eth: '0',
      },
    });
  }

  console.log('Inicjalizacja kont zakończona.');
  await prisma.$disconnect();
}

initializeWallets().catch((error) => {
  console.error('Błąd podczas inicjalizacji kont:', error);
  prisma.$disconnect();
  process.exit(1);
});
