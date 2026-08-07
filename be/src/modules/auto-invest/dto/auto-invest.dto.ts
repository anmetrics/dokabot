import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { RiskProfile } from '../presets';

export class EnableAutoInvestDto {
  @IsString()
  exchangeAccountId: string;

  @IsIn(['CONSERVATIVE', 'BALANCED', 'GROWTH'], {
    message: 'profile must be CONSERVATIVE, BALANCED or GROWTH',
  })
  profile: RiskProfile;

  /** Total budget across the whole portfolio, split between legs by weight. */
  @IsNumber()
  @Min(50, { message: 'Ngân sách tối thiểu là 50 USD' })
  @Max(10_000_000)
  budgetUsd: number;

  /** Defaults to paper — real money is never the default. */
  @IsOptional()
  @IsBoolean()
  isPaper?: boolean;
}
