import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class PayoutRequestDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid Ethereum address format.',
  })
  address: string;
}
