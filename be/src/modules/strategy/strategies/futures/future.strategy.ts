import { EMA, ATR } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { Candle } from 'binance-api-node';
import { IStrategy } from '../../strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { adjustToStepSize } from '../../helpers/crypto';
import { SETTING_KEY } from 'src/modules/settings/settings.enum';

export class FuturesEmaAtrStrategy implements IStrategy {
  private logger = new Logger('FuturesEmaAtrStrategy');

  private readonly symbol = 'SOLUSDT';
  private readonly timeframe = '15m';

  // EMA periods
  private readonly emaFast = 7;
  private readonly emaMedium = 25;
  private readonly emaSlow = 99;

  // ATR filter
  private readonly atrPeriod = 14;
  private readonly atrThreshold = 7; // sideway threshold

  // Risk management
  private readonly usdPerTrade = 4;
  private readonly maxLeverage = 10;
  private readonly stopLossPrice = 100; // cố định

  private timeframes: Record<
    string,
    {
      closes: number[];
      highs: number[];
      lows: number[];
      lastCandles: Candle[];
      emaFast: number[];
      emaMedium: number[];
      emaSlow: number[];
      atr: number[];
    }
  > = {};

  constructor(private readonly binanceService: BinanceService) {}

  async startAll() {
    await this.start();
  }

  private async start() {
    this.logger.log('Starting Futures EMA + ATR Strategy');

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      this.timeframe,
      500,
    );

    this.timeframes[this.timeframe] = {
      closes: historicalCandles.map((c) => +c.close),
      highs: historicalCandles.map((c) => +c.high),
      lows: historicalCandles.map((c) => +c.low),
      lastCandles: historicalCandles.slice(-3) as unknown as Candle[],
      emaFast: [],
      emaMedium: [],
      emaSlow: [],
      atr: [],
    };

    this.binanceService.subscribeCandles(
      this.symbol,
      this.timeframe,
      (candle) => this.onCandle(this.timeframe, candle),
    );
  }

  private onCandle(tf: string, candle: Candle) {
    const data = this.timeframes[tf];
    if (!data) return;

    data.lastCandles.push(candle);
    if (data.lastCandles.length > 3) data.lastCandles.shift();

    data.closes.push(+candle.close);
    data.highs.push(+candle.high);
    data.lows.push(+candle.low);
    if (data.closes.length > 500) {
      data.closes.shift();
      data.highs.shift();
      data.lows.shift();
    }

    data.emaFast = EMA.calculate({ period: this.emaFast, values: data.closes });
    data.emaMedium = EMA.calculate({
      period: this.emaMedium,
      values: data.closes,
    });
    data.emaSlow = EMA.calculate({ period: this.emaSlow, values: data.closes });

    data.atr = ATR.calculate({
      period: this.atrPeriod,
      high: data.highs,
      low: data.lows,
      close: data.closes,
    });

    this.processSignals(tf, +candle.close).catch((e) => this.logger.error(e));
  }

  private async processSignals(tf: string, lastClose: number) {
    if (tf !== this.timeframe) return;
    const data = this.timeframes[tf];
    if (!data) return;

    const enable = await this.binanceService.getSettingByKey(
      SETTING_KEY.ENABLE_FUTURE,
    );

    if (enable !== 'true') {
      return;
    }

    const len = data.closes.length;
    if (len < this.emaSlow + 2 || data.atr.length < 1) return;

    const lastEmaFast = data.emaFast[data.emaFast.length - 1];
    const prevEmaFast = data.emaFast[data.emaFast.length - 2];
    const lastEmaSlow = data.emaSlow[data.emaSlow.length - 1];

    // sideway filter
    const lastAtr = data.atr[data.atr.length - 1];
    if (lastAtr < this.atrThreshold) return;

    // Xác định xu hướng mới
    const crossUp =
      prevEmaFast <= data.emaSlow[data.emaSlow.length - 2] &&
      lastEmaFast > lastEmaSlow;
    const crossDown =
      prevEmaFast >= data.emaSlow[data.emaSlow.length - 2] &&
      lastEmaFast < lastEmaSlow;

    if (!crossUp && !crossDown) return;

    // Lấy tất cả position hiện tại từ Binance
    const positionsRaw = await this.binanceService.getFuturesPositions(
      this.symbol,
    );
    const positions = positionsRaw && positionsRaw.length ? positionsRaw : [];

    // Xác định side mới
    const newSide: 'LONG' | 'SHORT' = crossUp ? 'LONG' : 'SHORT';

    // Nếu đang giữ position ngược xu hướng → đảo lệnh ngay
    for (const pos of positions) {
      const side = parseFloat(pos.positionAmt) > 0 ? 'LONG' : 'SHORT';
      if (side !== newSide) {
        this.logger.log(
          `Reversing position from ${side} to ${newSide} at price ${lastClose}`,
        );
        await this.binanceService.closeFuturesPosition(this.symbol, side);
      }
    }

    // Mở position theo xu hướng mới
    const qty = adjustToStepSize(
      (this.usdPerTrade * this.maxLeverage) / lastClose,
      this.symbol,
    );

    await this.binanceService.placeFuturesMarketOrder(
      this.symbol,
      newSide === 'LONG' ? 'BUY' : 'SELL',
      qty,
    );
    this.logger.log(
      `Opened ${newSide} position qty=${qty} at price=${lastClose}`,
    );
  }

  stop() {
    this.logger.log('Stopped Futures EMA + ATR Strategy');
  }
}
