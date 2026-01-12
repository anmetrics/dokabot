import { Module } from '@nestjs/common';
import { PlatformCredentialService } from './platform-credential.service';
import { PlatformCredentialController } from './platform-credential.controller';

@Module({
  controllers: [PlatformCredentialController],
  providers: [PlatformCredentialService],
  exports: [PlatformCredentialService],
})
export class PlatformCredentialModule {}
