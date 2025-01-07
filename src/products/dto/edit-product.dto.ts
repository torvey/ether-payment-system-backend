import { PartialType } from '@nestjs/mapped-types';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsString()
  @IsNotEmpty({ message: 'Kod 2FA jest wymagany.' })
  @Length(6, 6, { message: 'Kod 2FA musi mieć dokładnie 6 znaków.' })
  code: string;
}
