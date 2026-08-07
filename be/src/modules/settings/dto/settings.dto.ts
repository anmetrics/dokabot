import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SymbolRuleDto {
  @IsString()
  @Matches(/^[A-Z0-9]{5,20}$/, { message: 'symbol phải có dạng BTCUSDT' })
  symbol: string;

  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  maxBuyPrice: number;

  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  minBuyPrice: number;

  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  maxSellPrice: number;

  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  minSellPrice: number;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1_000_000)
  defaultOrderSizeUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  defaultTakeProfitPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(100)
  defaultStopLossPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultMaxLossUsd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxConcurrentBots?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDailyLossUsd?: number;

  @IsOptional()
  @IsBoolean()
  tradingPaused?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SymbolRuleDto)
  symbolRules?: SymbolRuleDto[];

  @IsOptional()
  @IsBoolean()
  notifyOnFill?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnError?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnBotStopped?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramChatId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @IsString()
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}/, {
    message:
      'Mật khẩu mới cần ít nhất 12 ký tự, có chữ hoa, chữ thường và số',
  })
  newPassword: string;
}
