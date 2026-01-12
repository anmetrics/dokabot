import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PlatformCredentialService } from './platform-credential.service';
import { CreatePlatformCredentialDto } from './dto/create-platform-credential.dto';
import { UpdatePlatformCredentialDto } from './dto/update-platform-credential.dto';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';

@Controller('platform-credentials')
@UseGuards(AuthenticationGuard)
export class PlatformCredentialController {
  constructor(
    private readonly platformCredentialService: PlatformCredentialService,
  ) {}

  @Post()
  create(@Body() createDto: CreatePlatformCredentialDto) {
    return this.platformCredentialService.create(createDto);
  }

  @Get()
  findAll() {
    return this.platformCredentialService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.platformCredentialService.findById(id);
  }

  @Get('platform/:platform')
  findByPlatform(@Param('platform') platform: string) {
    return this.platformCredentialService.findByPlatform(platform);
  }

  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.platformCredentialService.findByUserId(userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePlatformCredentialDto,
  ) {
    return this.platformCredentialService.update(id, updateDto);
  }

  @Patch(':id/toggle-active')
  toggleActive(@Param('id') id: string) {
    return this.platformCredentialService.toggleActive(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.platformCredentialService.remove(id);
  }
}
