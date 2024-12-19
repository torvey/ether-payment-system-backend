import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Nazwa produktu jest wymagana.' })
  name: string;

  @IsNumber({ allowNaN: false }, { message: 'Cena musi być liczbą.' })
  @Min(0.01, { message: 'Cena musi być większa od 0.' })
  priceUsd: number;

  @IsString()
  @IsNotEmpty({ message: 'Opis produktu jest wymagany.' })
  description: string;
}
