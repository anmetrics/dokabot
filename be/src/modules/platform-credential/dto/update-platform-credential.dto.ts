import { PartialType } from '@nestjs/mapped-types';
import { CreatePlatformCredentialDto } from './create-platform-credential.dto';

export class UpdatePlatformCredentialDto extends PartialType(
  CreatePlatformCredentialDto,
) {}
