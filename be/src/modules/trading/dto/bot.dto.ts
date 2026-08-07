import {
  IsBoolean,
  IsIn,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d'];

export class CreateBotDto {
  @IsString()
  exchangeAccountId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  strategyKey: string;

  @IsString()
  @Matches(/^[A-Z0-9]{5,20}$/, { message: 'symbol must look like BTCUSDT' })
  symbol: string;

  @IsIn(TIMEFRAMES)
  timeframe: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** Defaults to true — a new bot never touches real money by accident. */
  @IsOptional()
  @IsBoolean()
  isPaper?: boolean;

  @IsOptional()
  @IsNumberString({}, { message: 'maxLossUsd must be a decimal string' })
  maxLossUsd?: string;
}

export class UpdateBotDto {
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsNumberString()
  maxLossUsd?: string;

  @IsOptional()
  @IsBoolean()
  isPaper?: boolean;
}
