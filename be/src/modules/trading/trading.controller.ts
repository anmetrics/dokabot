import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { BotStatus } from 'generated/prisma';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../authentication/interfaces/authentication.interface';
import { BotsService } from './bots.service';
import { OrdersService } from './orders.service';
import { CreateBotDto, UpdateBotDto } from './dto/bot.dto';
import { PlaceOrderDto } from './dto/place-order.dto';

@Controller('bots')
@UseGuards(AuthenticationGuard)
export class BotsController {
  constructor(private readonly bots: BotsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.bots.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBotDto,
    @Req() request: Request,
  ) {
    return this.bots.create(user.id, dto, context(request));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBotDto,
  ) {
    return this.bots.update(user.id, id, dto);
  }

  @Post(':id/start')
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.bots.setStatus(user.id, id, BotStatus.RUNNING, context(request));
  }

  @Post(':id/pause')
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.bots.setStatus(user.id, id, BotStatus.PAUSED, context(request));
  }

  @Post(':id/stop')
  stop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.bots.setStatus(user.id, id, BotStatus.STOPPED, context(request));
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.bots.remove(user.id, id, context(request));
  }
}

@Controller('orders')
@UseGuards(AuthenticationGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('botId') botId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orders.list(user.id, {
      botId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  place(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PlaceOrderDto,
    @Req() request: Request,
  ) {
    return this.orders.place(user.id, dto, context(request));
  }

  @Post(':id/sync')
  sync(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.sync(user.id, id);
  }

  @Delete(':id')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    return this.orders.cancel(user.id, id, context(request));
  }
}

function context(request: Request) {
  return {
    ip: request.ip,
    userAgent: request.get('user-agent') ?? undefined,
  };
}
