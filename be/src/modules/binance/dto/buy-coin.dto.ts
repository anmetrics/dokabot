import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class BuyCoinDto {
  @IsString()
  symbol: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsBoolean()
  market: boolean;
}
