import { IsNotEmpty, IsString, Length } from 'class-validator';

export class DeleteProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Kod 2FA jest wymagany.' })
  @Length(6, 6, { message: 'Kod 2FA musi mieć dokładnie 6 znaków.' })
  code: string;
}
