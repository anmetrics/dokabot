import { IsInt, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class WalletChallengeDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Địa chỉ ví không hợp lệ' })
  address: string;

  @IsOptional()
  @IsInt()
  chainId?: number;
}

export class WalletVerifyDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Địa chỉ ví không hợp lệ' })
  address: string;

  @IsString()
  @MaxLength(300)
  @Matches(/^0x[a-fA-F0-9]+$/, { message: 'Chữ ký không hợp lệ' })
  signature: string;
}
