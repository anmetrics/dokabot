import { EMA, MACD } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';

export class EmaMacdStrategy implements IStrategy {
  private logger = new Logger('EmaMacdStrategy');
  private prices: number[] = [];
  private running = false;
  private hasPosition = false; // Spot: true = đang giữ coin, false = không giữ

  private emaShortPeriod = 12;
  private emaLongPeriod = 26;
  private macdFastPeriod = 12;
  private macdSlowPeriod = 26;
  private macdSignalPeriod = 9;

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly tradeUsd: number,
  ) {}

  async start() {
    this.logger.log(`Starting EMA+MACD spot strategy for ${this.symbol}`);
    this.running = true;

    // Subscribe price stream
    this.binanceService.subscribeAggTrades(this.symbol, (trade) => {
      const price = Number(trade.price);
      this.prices.push(price);
      if (this.prices.length > 500) this.prices.shift();
    });

    while (this.running) {
      try {
        const price =
          this.prices[this.prices.length - 1] ||
          (await this.binanceService.getPrice(this.symbol));

        console.log('price', price);
        if (
          !price ||
          this.prices.length <
            Math.max(
              this.emaLongPeriod,
              this.macdSlowPeriod + this.macdSignalPeriod,
            )
        ) {
          await this.sleep(5000);
          continue;
        }

        // EMA
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

        // MACD
        const macdResult = MACD.calculate({
          values: this.prices,
          fastPeriod: this.macdFastPeriod,
          slowPeriod: this.macdSlowPeriod,
          signalPeriod: this.macdSignalPeriod,
          SimpleMAOscillator: false,
          SimpleMASignal: false,
        });
        const lastMacd = macdResult[macdResult.length - 1];
        if (!lastMacd || !lastMacd.MACD || !lastMacd.signal) {
          await this.sleep(5000);
          continue;
        }

        // ==== Trading logic cho Spot ====
        if (trendUp && lastMacd.MACD > lastMacd.signal && !this.hasPosition) {
          // BUY
          const qty = this.usdToQty(price);
          this.logger.log(`BUY ${qty} ${this.symbol} @ ${price}`);
          await this.binanceService.placeMarketOrder(this.symbol, 'BUY', qty);
          this.hasPosition = true;
        } else if (
          trendDown &&
          lastMacd.MACD < lastMacd.signal &&
          this.hasPosition
        ) {
          // SELL: lấy số coin thực tế trong ví
          const balances = await this.binanceService.getAccount();
          const asset = this.symbol.replace('USDT', ''); // ví dụ BTCUSDT -> BTC
          const free = Number(
            balances.balances.find((b) => b.asset === asset)?.free || 0,
          );

          if (free > 0) {
            this.logger.log(`SELL ${free} ${asset} @ ${price}`);
            await this.binanceService.placeMarketOrder(
              this.symbol,
              'SELL',
              free,
            );
            this.hasPosition = false;
          }
        }
      } catch (err) {
        this.logger.error('Strategy error: ' + JSON.stringify(err));
      }

      await this.sleep(5000);
    }
  }

  stop() {
    this.running = false;
    this.logger.log(`Stopped EMA+MACD strategy for ${this.symbol}`);
  }

  private usdToQty(price: number) {
    // NOTE: bạn nên fetch stepSize từ exchangeInfo để làm tròn chính xác
    return Math.floor((this.tradeUsd / price) * 1e6) / 1e6;
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
