import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreatePlatformCredentialDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  platform: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  apiKey: string;

  @IsString()
  @IsNotEmpty()
  apiSecret: string;

  @IsBoolean()
  @IsOptional()
  isTestnet?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  whitelistIps?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
