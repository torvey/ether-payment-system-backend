import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Nazwa produktu jest wymagana.' })
  name: string;

  @IsNumberString({}, { message: 'Cena musi być liczbą w formacie string .' })
  priceUsd: string;

  @IsString()
  @IsNotEmpty({ message: 'Opis produktu jest wymagany.' })
  description: string;
}
