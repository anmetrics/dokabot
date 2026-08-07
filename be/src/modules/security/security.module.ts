import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeyVaultService } from './key-vault.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [KeyVaultService],
  exports: [KeyVaultService],
})
export class SecurityModule {}
