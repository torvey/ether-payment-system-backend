import { Currency } from '@prisma/client';
import {
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsString,
} from 'class-validator';
import { CurrencyConfig } from 'src/config/config';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Nazwa produktu jest wymagana.' })
  name: string;

  @IsNumberString({}, { message: 'Cena musi być liczbą w formacie string .' })
  @IsDecimal(
    { decimal_digits: '0,2' },
    { message: 'Cena może mieć maksymalnie 2 miejsca po przecinku.' },
  )
  price: string;

  @IsString()
  @IsNotEmpty({ message: 'Opis produktu jest wymagany.' })
  description: string;

  @IsEnum(CurrencyConfig.supportedCurrencies, {
    message: 'Waluta musi być jedną z: USD, EURO, GBP, PLN.',
  })
  currency: Currency;
}
