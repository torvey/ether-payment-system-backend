import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class GeneratePaymentLinkDto {
  @IsInt()
  @Min(1, { message: 'productId musi być liczbą całkowitą większą od 0.' })
  productId: number;

  @IsInt()
  @Min(1, { message: 'quantity musi być liczbą całkowitą większą od 0.' })
  quantity: number;

  @IsString()
  @IsNotEmpty({
    message: 'customerId jest wymagane i musi być niepustym ciągiem znaków.',
  })
  customerId: string;
}
