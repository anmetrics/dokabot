import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
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
  async getHistories() {
    return this.binanceService.getHistories();
  }

  @Get('profits')
  @HttpCode(HttpStatus.OK)
  async getProfits() {
    return this.binanceService.getProfits();
  }

  @Get('account')
  @HttpCode(HttpStatus.OK)
  async getAccount() {
    return this.binanceService.getAccount();
  }
}
