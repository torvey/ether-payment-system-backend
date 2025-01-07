import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class PayoutRequestDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid Ethereum address format.',
  })
  address: string;

  @IsString()
  @IsNotEmpty({ message: 'Kod 2FA jest wymagany.' })
  @Length(6, 6, { message: 'Kod 2FA musi mieć dokładnie 6 znaków.' })
  code: string;
}
