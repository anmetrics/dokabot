import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PlaceOrderDto {
  @IsString()
  exchangeAccountId: string;

  @IsOptional()
  @IsString()
  botId?: string;

  @IsString()
  @Matches(/^[A-Z0-9]{5,20}$/, { message: 'symbol must look like BTCUSDT' })
  symbol: string;

  @IsIn(['BUY', 'SELL'], { message: 'side must be BUY or SELL' })
  side: 'BUY' | 'SELL';

  @IsIn(['MARKET', 'LIMIT'], { message: 'type must be MARKET or LIMIT' })
  type: 'MARKET' | 'LIMIT';

  /** String, not number — see Numeric in exchange.types.ts. */
  @IsNumberString({}, { message: 'quantity must be a decimal string' })
  quantity: string;

  @IsOptional()
  @IsNumberString({}, { message: 'price must be a decimal string' })
  price?: string;

  /**
   * Caller-supplied intent id. Retrying with the same value returns the original
   * order instead of placing a new one.
   */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey: string;
}
