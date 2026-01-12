import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreatePlatformCredentialDto } from './dto/create-platform-credential.dto';
import { UpdatePlatformCredentialDto } from './dto/update-platform-credential.dto';

@Injectable()
export class PlatformCredentialService {
  constructor(private prisma: PrismaService) {}

  async create(createDto: CreatePlatformCredentialDto) {
    const credential = await this.prisma.platformCredential.create({
      data: createDto,
    });
    return credential;
  }

  async findAll() {
    const credential = await this.prisma.platformCredential.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return credential;
  }

  async findById(id: string) {
    const credential = await this.prisma.platformCredential.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!credential) {
      throw new NotFoundException(
        `Platform credential with ID ${id} not found`,
      );
    }

    return credential;
  }

  async findByPlatform(platform: string) {
    const credential = await this.prisma.platformCredential.findMany({
      where: {
        platform,
        isActive: true,
      },
      include: {
        user: true,
      },
    });
    return credential;
  }

  async findByUserId(userId: string) {
    const credential = await this.prisma.platformCredential.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return credential;
  }

  async findActiveBinanceCredential() {
    const credentials = await this.prisma.platformCredential.findMany({
      where: {
        platform: 'binance',
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 1,
    });

    if (credentials.length === 0) {
      throw new NotFoundException('No active Binance credentials found');
    }

    return credentials[0];
  }

  async update(id: string, updateDto: UpdatePlatformCredentialDto) {
    await this.findById(id); // Check if exists

    const credentials = await this.prisma.platformCredential.update({
      where: { id },
      data: updateDto,
    });
    return credentials;
  }

  async remove(id: string) {
    await this.findById(id); // Check if exists

    const credentials = await this.prisma.platformCredential.delete({
      where: { id },
    });
    return credentials;
  }

  async toggleActive(id: string) {
    const credential = await this.findById(id);

    const credentials = await this.prisma.platformCredential.update({
      where: { id },
      data: {
        isActive: !credential.isActive,
      },
    });
    return credentials;
  }
}
