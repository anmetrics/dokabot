import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Exchange } from 'generated/prisma';

export class CreateExchangeAccountDto {
  @IsEnum(Exchange, { message: 'exchange must be BINANCE or BYBIT' })
  exchange: Exchange;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  label: string;

  @IsString()
  @MinLength(16, { message: 'API key looks too short' })
  @MaxLength(256)
  apiKey: string;

  @IsString()
  @MinLength(16, { message: 'API secret looks too short' })
  @MaxLength(256)
  apiSecret: string;

  @IsOptional()
  @IsBoolean()
  isTestnet?: boolean;
}

export class UpdateExchangeAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  label?: string;
}
