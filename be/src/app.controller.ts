import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { BinanceService } from './modules/binance/binance.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly binanceService: BinanceService,
  ) {}

  @Get()
  getLog() {
    return this.binanceService.getLog();
  }
}
