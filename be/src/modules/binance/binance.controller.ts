import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BinanceService } from './binance.service';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';
import { SETTING_KEY } from '../settings/settings.enum';
import { BuyCoinDto } from './dto/buy-coin.dto';

@Controller('binance')
@UseGuards(AuthenticationGuard)
export class BinanceController {
  constructor(private readonly binanceService: BinanceService) {}

  @Get('positions')
  @HttpCode(HttpStatus.OK)
  getAllOpenPositions() {
    return this.binanceService.getAllOpenPositions();
  }

  @Get('logs')
  @HttpCode(HttpStatus.OK)
  async getLogs() {
    const { log: BNBUSDTLog } = await this.binanceService.getLog('BNBUSDT');
    const { log: BTCUSDTLog } = await this.binanceService.getLog('BTCUSDT');
    const { log: SOLUSDTLog } = await this.binanceService.getLog('SOLUSDT');
    return {
      BNBUSDTLog,
      BTCUSDTLog,
      SOLUSDTLog,
    };
  }

  @Get('histories')
  @HttpCode(HttpStatus.OK)
  async getHistories(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('symbol') symbol?: string,
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Validate page and limit
    if (isNaN(pageNum) || pageNum < 1) {
      return [];
    }
    if (isNaN(limitNum) || limitNum < 1) {
      return [];
    }

    return this.binanceService.getHistories(
      pageNum,
      limitNum,
      startDate,
      endDate,
      symbol,
    );
  }

  @Get('profits')
  @HttpCode(HttpStatus.OK)
  async getDateProfits() {
    return this.binanceService.getDateProfits();
  }

  @Get('cumulative-profits')
  @HttpCode(HttpStatus.OK)
  async getCumulativeProfits() {
    return this.binanceService.getCumulativeProfits();
  }

  @Get('account')
  @HttpCode(HttpStatus.OK)
  async getAccount() {
    return this.binanceService.getAccount();
  }

  @Get('settings')
  @HttpCode(HttpStatus.OK)
  async GetListSettings() {
    return this.binanceService.getListSettings();
  }

  @Post('buy')
  @HttpCode(HttpStatus.OK)
  buyCoin(@Body() dto: BuyCoinDto) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.binanceService.buy(dto);
  }

  @Post('sell')
  @HttpCode(HttpStatus.OK)
  sell(
    @Body()
    body: {
      id: string;
      price?: number;
    },
  ) {
    const { id, price } = body;
    if (!id?.trim()) {
      return;
    }
    return this.binanceService.sell(id, Number(price));
  }

  @Patch('settings')
  @HttpCode(HttpStatus.OK)
  async updateSettings(@Body() payload: Record<SETTING_KEY, string>) {
    const results: any[] = [];
    for (const [key, value] of Object.entries(payload)) {
      if (!Object.values(SETTING_KEY).includes(key as SETTING_KEY)) {
        throw new BadRequestException(`Invalid setting key: ${key}`);
      }
      if (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        [SETTING_KEY.ENABLE_BUY, SETTING_KEY.ENABLE_SELL].includes(key as any)
      ) {
        if (!['true', 'false'].includes(value)) {
          throw new BadRequestException(`Invalid value for ${key}`);
        }
      }
      // gọi service update
      const res = await this.binanceService.updateSetting(
        key as SETTING_KEY,
        value,
      );
      results.push(res);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return results;
  }
}
