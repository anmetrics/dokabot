import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { BinanceService } from './binance.service';

@Controller('binance')
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
}
