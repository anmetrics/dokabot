// strategies/ema-rsi.strategy.ts
import { EMA, RSI } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { BinanceService } from 'src/modules/binance/binance.service';
import { IStrategy } from './strategy.interface';

export class EmaRsiStrategy implements IStrategy {
  private logger = new Logger('EmaRsiStrategy');
  private prices: number[] = [];
  private running = false;

  private emaShortPeriod = 9;
  private emaLongPeriod = 21;
  private rsiPeriod = 14;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly tradeUsd: number,
  ) {}

  async start() {
    this.logger.log(`Starting EMA+RSI strategy for ${this.symbol}`);
    this.running = true;

    this.binanceService.subscribeAggTrades(this.symbol, (trade) => {
      const price = Number(trade.p);
      this.prices.push(price);
      if (this.prices.length > 200) this.prices.shift();
    });

    while (this.running) {
      try {
        const price =
          this.prices[this.prices.length - 1] ||
          (await this.binanceService.getPrice(this.symbol));

        if (
          !price ||
          this.prices.length < Math.max(this.emaLongPeriod, this.rsiPeriod)
        ) {
          await this.sleep(5000);
          continue;
        }

        const emaShort = EMA.calculate({
          period: this.emaShortPeriod,
          values: this.prices,
        });
        const emaLong = EMA.calculate({
          period: this.emaLongPeriod,
          values: this.prices,
        });
        const lastEmaShort = emaShort[emaShort.length - 1];
        const lastEmaLong = emaLong[emaLong.length - 1];

        const trendUp = lastEmaShort > lastEmaLong;
        const trendDown = lastEmaShort < lastEmaLong;

        const rsiValues = RSI.calculate({
          values: this.prices,
          period: this.rsiPeriod,
        });
        const lastRsi = rsiValues[rsiValues.length - 1];

        if (trendUp && lastRsi < 40) {
          const qty = this.usdToQty(price);
          this.logger.log(`Buying ${qty}`);
          await this.binanceService.placeMarketOrder(this.symbol, 'BUY', qty);
        } else if (trendDown && lastRsi > 60) {
          const qty = this.usdToQty(price);
          this.logger.log(`Selling ${qty}`);
          await this.binanceService.placeMarketOrder(this.symbol, 'SELL', qty);
        }
      } catch (err) {
        this.logger.error(err);
      }

      await this.sleep(5000);
    }
  }

  stop() {
    this.running = false;
  }

  private usdToQty(price: number) {
    return Math.floor((this.tradeUsd / price) * 1e6) / 1e6;
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
