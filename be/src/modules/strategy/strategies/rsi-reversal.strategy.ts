import { RSI, ATR } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle } from 'binance-api-node';
import { randomUUID } from 'crypto';
import { adjustToStepSize, getActualBought } from '../helpers/crypto';
import Decimal from 'decimal.js';
import { IStrategy } from '../strategy.interface';
import { Position } from 'generated/prisma';
import { LIST_SYMBOL } from 'src/modules/settings/settings.enum';

type TimeframeData = {
  closes: number[];
  highs: number[];
  lows: number[];
  lastCandles: Candle[];
};

export class RsiReversalDcaStrategy implements IStrategy {
  private logger = new Logger('RsiReversalStrategy');
  private cumulativeProfit = 0;

  // === CONFIG ===
  private maxDcaTimes = 7; // tối đa số lần DCA cho 1 vị thế
  private dcaMultiplier = 2; // mỗi lần DCA sau gấp x.x lần trước

  private DCA_PRICE_DROP_PCT = 0.08;

  private rsiPeriod = 12;
  private atrPeriod = 12;

  private rsiBuyThreshold = 18;
  private rsiSellThreshold = 80;

  private cooldownMs = 2 * 60 * 1000; // 2 phút
  private lastTradeTime = 0;

  private timeframeData: Record<string, TimeframeData> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly baseBuyUsd: number,
    private readonly timeframe: '1m' | '3m' | '5m' | '15m' | '30m',
    private readonly minProfitPct: number,
  ) {}

  async startAll() {
    await this.start(this.timeframe);
  }

  private async start(timeframe: '1m' | '3m' | '5m' | '15m' | '30m') {
    console.log(
      `Starting RSI Reversal + DCA Strategy for ${this.symbol} [${timeframe}]R, baseBuyUsd: ${this.baseBuyUsd}, BaseProfit:${this.minProfitPct}`,
    );
    const positions = await this.binanceService.getOpenPositions(this.symbol);
    console.log(this.symbol + ':', positions);

    console.log('-------------------');

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      timeframe,
      500,
    );

    this.timeframeData[timeframe] = {
      closes: historicalCandles.map((c) => +c.close),
      highs: historicalCandles.map((c) => +c.high),
      lows: historicalCandles.map((c) => +c.low),
      lastCandles: historicalCandles.slice(-3) as unknown as Candle[],
    };

    this.binanceService.subscribeCandles(this.symbol, timeframe, (candle) => {
      const data = this.timeframeData[timeframe];
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

      this.calcSignal(timeframe);
    });
  }

  private async calcSignal(timeframe: string) {
    try {
      const data = this.timeframeData[timeframe];
      if (!data || data.closes.length < this.rsiPeriod + 1) return;

      const rsi = RSI.calculate({
        period: this.rsiPeriod,
        values: data.closes,
      });
      const atr = ATR.calculate({
        high: data.highs,
        low: data.lows,
        close: data.closes,
        period: this.atrPeriod,
      });

      if (rsi.length < 1 || atr.length < 1) return;

      const lastRsi = rsi[rsi.length - 1];
      const lastAtr = atr[atr.length - 1];
      const price = data.closes[data.closes.length - 1];
      const now = Date.now();
      const cooldownOk =
        this.lastTradeTime === 0 || now - this.lastTradeTime >= this.cooldownMs;

      const openPositions = await this.binanceService.getOpenPositions(
        this.symbol,
      );

      // === BUY or DCA với ATR filter ===
      if (lastRsi <= this.rsiBuyThreshold && cooldownOk) {
        const minBuyPrice = openPositions.length
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return
            Math.min(...openPositions.map((p) => p.buyPrice))
          : price;

        const dcaTimes = openPositions.length - 1;

        const dcaIndex = dcaTimes + 1;

        const extraDropPct = dcaIndex * 0.01 * 1.6;
        const DCA_PERCENT = 1 - this.DCA_PRICE_DROP_PCT - extraDropPct;

        const isDcaValid =
          dcaTimes < this.maxDcaTimes &&
          price < minBuyPrice - lastAtr &&
          price < minBuyPrice * DCA_PERCENT;

        if (openPositions.length === 0 || isDcaValid) {
          await this.buyPosition(price, dcaIndex || 0);
          this.lastTradeTime = now;
        }
      }

      if (lastRsi < this.rsiSellThreshold) {
        return;
      }

      // === SELL với trailing ATR để tránh bán quá sớm ===
      if (openPositions.length > 0) {
        const sellablePositions = openPositions.filter((pos) => {
          const dynamicMinProfitPct = this.getDynamicMinProfitPct(
            pos?.dcaIndex || 0,
          );
          return price >= pos.buyPrice * (1 + dynamicMinProfitPct);
        });
        if (!sellablePositions.length) {
          return;
        }

        for (const pos of sellablePositions) {
          if (pos.sellPrice && pos.sellPrice > 0 && price < pos.sellPrice) {
            continue;
          }
          await this.sellPosition(pos, price, timeframe);
        }
      }
    } catch (e) {
      console.error(`[${timeframe}] Error in DCA RSI strategy:`, e);
    }
  }

  private async buyPosition(price: number, dcaIndex: number) {
    const usdToSpend = this.baseBuyUsd * Math.pow(this.dcaMultiplier, dcaIndex);

    const balances = await this.binanceService.getAccount();
    const freeUsdt = Number(
      balances.balances.find((b) => b.asset === 'USDT')?.free || 0,
    );

    if (freeUsdt < usdToSpend) {
      console.log(
        `[DCA ${dcaIndex}] Not enough USDT (${freeUsdt.toFixed(
          2,
        )}) to buy need ${usdToSpend.toFixed(2)} USD`,
      );
      return;
    }

    const qty = adjustToStepSize(usdToSpend / price, this.symbol);

    const order = await this.binanceService.placeMarketOrder(
      this.symbol,
      'BUY',
      qty,
    );
    const bnbPrice = await this.binanceService.getPrice(LIST_SYMBOL.BNBUSDT);
    const {
      totalQty: totalQtyActual,
      totalSpent,
      avgPrice,
    } = getActualBought(order, bnbPrice);

    await this.binanceService.savePosition({
      id: randomUUID(),
      buyPrice: avgPrice,
      qty,
      usdSpent: totalSpent,
      totalQtyActual,
      dcaIndex,
      strategy: this.symbol,
      symbol: this.symbol,
    });
  }

  private getDynamicMinProfitPct(dcaIndex: number) {
    const base = this.minProfitPct;
    const increment = 0.008;
    return base + dcaIndex * increment;
  }

  private async sellPosition(pos: Position, price: number, timeframe: string) {
    const balances = await this.binanceService.getAccount();
    const asset = this.symbol.replace('USDT', '');
    const free = Number(
      balances.balances.find((b) => b.asset === asset)?.free || 0,
    );

    if (new Decimal(pos.qty).greaterThan(free)) {
      console.log('NOT ENOUGH TOKEN TO SELL : ', pos.qty);
      return;
    }

    const order = await this.binanceService.placeMarketOrder(
      this.symbol,
      'SELL',
      pos.qty,
    );

    const revenueUsdt = await this.binanceService.getRevenueFromSellOrder(
      order,
      this.symbol,
    );

    const profit = revenueUsdt - pos.usdSpent;
    this.cumulativeProfit += profit;

    await this.binanceService.deletePosition(pos.id);

    await this.binanceService.saveSellSuccess({
      symbol: this.symbol,
      buyPrices: [pos.buyPrice],
      sellPrice: price,
      totalAmountBuyActual: pos.qty,
      totalAmountBuyUsdtSpent: pos.usdSpent,
      totalProfit: profit,
      totalRevenueUsdt: revenueUsdt,
    });
    console.log(
      `[${timeframe}] SELL (DCA ${pos.dcaIndex}) ${pos.qty} ${this.symbol} @ ${price} — Profit: ${profit.toFixed(2)}`,
    );
  }

  stop() {
    this.logger.log(`Stopped RSI DCA strategy for ${this.symbol}`);
  }
}
