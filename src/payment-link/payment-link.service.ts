import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid'; // Biblioteka do generowania unikalnych identyfikatorów

@Injectable()
export class PaymentLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async generatePaymentLink(
    productId: number,
    quantity: number,
    customerId: string,
  ): Promise<string> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // Data ważności (1 godzina)

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Produkt o ID ${productId} nie istnieje.`);
    }

    // Sprawdzenie, czy istnieje aktywny link o tych samych parametrach
    const existingLink = await this.prisma.paymentLink.findFirst({
      where: {
        productId,
        quantity,
        customerId,
        isUsed: false,
        expiresAt: { gt: now },
      },
    });

    if (existingLink) {
      return existingLink.link; // Zwracamy istniejący link
    }

    // Generowanie nowego linku
    const link = uuidv4(); // Generujemy unikalny link

    // Zapis nowego linku w bazie
    const paymentLink = await this.prisma.paymentLink.create({
      data: {
        productId,
        quantity,
        customerId,
        link,
        expiresAt,
      },
    });

    return paymentLink.link;
  }
}
