import { EMA, MACD, RSI } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle, Order } from 'binance-api-node';
import { TradeEvent } from '../events/trade.event';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import { loadPositions, savePositions } from '../helpers/savePosition';
import { formatDate } from '../helpers/formatDate';

type Position = {
  id: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
};

export class EmaMacdStrategy implements IStrategy {
  private logger = new Logger('EmaMacdStrategy');
  private prices: number[] = [];
  private running = false;

  private cumulativeProfit = 0;

  // private emaShortPeriod = 12;
  // private emaLongPeriod = 26;
  // private macdFastPeriod = 12;
  // private macdSlowPeriod = 26;
  // private macdSignalPeriod = 9;

  private emaShortPeriod = 3;
  private emaLongPeriod = 6;
  private macdFastPeriod = 6;
  private macdSlowPeriod = 12;
  private macdSignalPeriod = 5;

  private rsiPeriod = 7;
  private rsiOverbought = 64;
  private rsiOversold = 32;

  // === Settings for sideway trading ===
  private maxBuyPrice = 1250;
  private rebuyDropPct = 1.1;

  // Quản lý nhiều vị thế
  private positions: Position[] = [];

  private maxPositions = 5;
  private tradePerBuyUsd = 20; // mỗi lần mua 10$

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly emitEvent?: (event: TradeEvent) => void,
  ) {
    this.positions = loadPositions();
    console.log(
      'CURRENT_POSITION:',
      this.positions,
      'length: ',
      this.positions.length,
    );
  }

  async start() {
    this.logger.log(`Starting EMA+MACD spot strategy for ${this.symbol}`);

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      '1m',
      40,
    );
    this.prices = historicalCandles.map((c) => Number(c.close));
    console.log('prices', this.prices[this.prices.length - 1]);
    this.running = true;

    const lastCandles: Candle[] = [];

    this.binanceService.subscribeCandles(this.symbol, '1m', (trade) => {
      lastCandles.push(trade);

      if (lastCandles.length > 3) lastCandles.shift();

      const price = Number(trade.close);
      this.prices.push(price);

      if (this.prices.length > 40) this.prices.shift();

      this.calcPrice(lastCandles);
    });

    // const marketTrend = await this.binanceService.detectMarketTrend('BTCUSDT', {
    //   candleInterval: '5m',
    //   lookback: 96,
    //   emaPeriod: 26,
    //   atrPeriod: 14,
    //   sidewayThresholdPct: 2,
    //   slopeThresholdPct: 0.2,
    // });

    // console.log('Market trend:', marketTrend); // UPTREND | DOWNTREND | SIDEWAY
  }

  async calcPrice(lastCandles: Candle[]) {
    try {
      const price = await this.binanceService.getPrice(this.symbol);
      if (
        !price ||
        this.prices.length <
          Math.max(
            this.emaLongPeriod,
            this.macdSlowPeriod + this.macdSignalPeriod,
          )
      ) {
        return;
      }

      const rsiValues = RSI.calculate({
        values: this.prices,
        period: this.rsiPeriod,
      });
      const lastRsi = rsiValues[rsiValues.length - 1];
      if (!lastRsi) return;

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

      // const trendUp = lastEmaShort > lastEmaLong; // chậm quá
      const trendDown = lastEmaShort < lastEmaLong;

      const macdResult = MACD.calculate({
        values: this.prices,
        fastPeriod: this.macdFastPeriod,
        slowPeriod: this.macdSlowPeriod,
        signalPeriod: this.macdSignalPeriod,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const lastMacd = macdResult[macdResult.length - 1];
      if (!lastMacd || !lastMacd.MACD || !lastMacd.signal) return;

      console.log('lastRsi:', lastRsi);
      console.log('lastMacd: ', lastMacd);

      // === BUY logic ===

      const emaShortPrev = emaShort[emaShort.length - 2];
      const emaTurningUp =
        lastEmaShort > emaShortPrev && lastEmaShort > lastEmaLong;

      const prevRsi = rsiValues[rsiValues.length - 2];
      const rsiRising = lastRsi > prevRsi && lastRsi < this.rsiOversold;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars

      if (lastCandles.length < 3) return;

      const [_, c2, c3] = lastCandles.slice(-3); // 3 cây cuối

      const isBullishReversal =
        Number(c2.close) < Number(c2.open) && // trước đó là nến đỏ
        Number(c3.close) > Number(c3.open) && // hiện tại là nến xanh
        Number(c3.close) > Number(c2.open); // đóng cửa cao hơn open trước

      const isBullishReversalEarly =
        c2.close < c2.open && // nến đỏ trước
        c3.close > c3.open && // nến xanh hiện tại
        c3.close > c2.close; // đóng cửa cao hơn nến đỏ

      // Bullish Engulfing: dựa trên 2 cây cuối (c2 và c3)
      const isBullishEngulfing =
        c2.close < c2.open && // nến đỏ trước
        c3.close > c3.open && // nến xanh hiện tại
        c3.open < c2.close && // mở dưới nến đỏ
        c3.close > c2.open; // đóng trên nến đỏ

      const prevVolume = lastCandles[lastCandles.length - 2].volume;
      const currentVolume = c3.volume;
      const volumeSpike = Number(currentVolume) > Number(prevVolume) * 1.45; // tăng 45% so với nến trước

      const prevMacd =
        macdResult.length >= 2 ? macdResult[macdResult.length - 2] : undefined;
      if (!prevMacd || prevMacd.MACD === undefined) return;

      const macdPeaking =
        lastMacd.MACD < prevMacd.MACD && lastMacd.MACD > lastMacd.signal;

      // Check buy
      const isValidBuy =
        this.positions.length < this.maxPositions &&
        isBullishEngulfing &&
        rsiRising &&
        emaTurningUp &&
        volumeSpike &&
        lastRsi < this.rsiOversold && // oversold mạnh hơn
        lastRsi > prevRsi && // RSI bắt đầu tăng → đảo chiều
        price < this.maxBuyPrice &&
        (this.positions.length === 0 ||
          price <
            Math.min(...this.positions.map((p) => p.buyPrice)) *
              (1 - this.rebuyDropPct / 100));

      //  Check sell
      const isValidSell =
        (trendDown || macdPeaking) &&
        lastMacd.MACD < lastMacd.signal &&
        lastRsi > this.rsiOverbought &&
        this.positions.length > 0;

      // ================= Separator =================
      console.log(
        '\x1b[33m%s\x1b[0m',
        '=============================',
        formatDate(new Date()),
      );

      // ================= BUY LOG =================
      console.log('\x1b[32m%s\x1b[0m', '===== BUY CHECK =====');
      console.log(
        'isBullishReversalEarly  :',
        isBullishReversalEarly ? '\x1b[32mTRUE\x1b[0m' : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'EMA Turning Up :',
        emaTurningUp ? '\x1b[32mTRUE\x1b[0m' : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'Bullish Reversal:',
        isBullishReversal ? '\x1b[32mTRUE\x1b[0m' : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'RSI < Oversold :',
        lastRsi < this.rsiOversold
          ? '\x1b[32mTRUE\x1b[0m'
          : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'MACD Bullish   :',
        lastMacd.MACD > lastMacd.signal
          ? '\x1b[32mTRUE\x1b[0m'
          : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'Price < MaxBuy :',
        price < this.maxBuyPrice
          ? '\x1b[32mTRUE\x1b[0m'
          : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'Rebuy Condition:',
        this.positions.length === 0 ||
          price <
            Math.min(...this.positions.map((p) => p.buyPrice)) *
              (1 - this.rebuyDropPct / 100)
          ? '\x1b[32mTRUE\x1b[0m'
          : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        '=> IS VALID BUY :',
        isValidBuy ? '\x1b[32mTRUE\x1b[0m' : '\x1b[31mFALSE\x1b[0m',
      );

      // ================= SELL LOG =================
      console.log('\x1b[31m%s\x1b[0m', '===== SELL CHECK =====');
      console.log(
        'Trend Down     :',
        trendDown ? '\x1b[32mTRUE\x1b[0m' : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'MACD Bearish   :',
        lastMacd.MACD < lastMacd.signal
          ? '\x1b[32mTRUE\x1b[0m'
          : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'RSI > Overbought :',
        lastRsi > this.rsiOverbought
          ? '\x1b[32mTRUE\x1b[0m'
          : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        'Has Position   :',
        this.positions.length > 0
          ? '\x1b[32mTRUE\x1b[0m'
          : '\x1b[31mFALSE\x1b[0m',
      );
      console.log(
        '=> IS VALID SELL:',
        isValidSell ? '\x1b[32mTRUE\x1b[0m' : '\x1b[31mFALSE\x1b[0m',
      );

      if (isValidBuy) {
        const qty = this.usdToQty(price, this.tradePerBuyUsd);
        if (qty > 0) {
          console.log('----------------');
          console.log(`BUY ${qty} ${this.symbol} @ ${price}`);
          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'BUY',
            qty,
          );
          console.log('----------------');

          this.positions.push({
            id: randomUUID(),
            buyPrice: price,
            qty,
            usdSpent: await this.getFeeFromOrder(order),
          });
          savePositions(this.positions);

          // this.emitEvent?.({
          //   side: 'BUY',
          //   symbol: this.symbol,
          //   price,
          //   qty,
          //   timestamp: Date.now(),
          //   strategy: 'EmaMacdStrategy',
          // });
        }
      }

      // === SELL logic (theo từng position) ===
      else if (
        (trendDown || macdPeaking) &&
        lastMacd.MACD < lastMacd.signal &&
        lastRsi > this.rsiOverbought &&
        this.positions.length > 0
      ) {
        const balances = await this.binanceService.getAccount();
        const asset = this.symbol.replace('USDT', '');
        const free = Number(
          balances.balances.find((b) => b.asset === asset)?.free || 0,
        );

        const sellable = this.positions.filter(
          (pos) => price > pos.buyPrice * 1.006,
        );

        // Tính tổng qty cần bán
        const totalQty = sellable.reduce(
          (sum, pos) => sum.plus(new Decimal(pos.qty)),
          new Decimal(0),
        );

        // Tính tổng vốn bỏ ra cho các vị thế bán
        const totalUsdSpent = sellable.reduce(
          (sum, pos) => sum + pos.usdSpent,
          0,
        );

        console.log('totalQty:', totalQty, 'free:', free);

        if (totalQty.lessThanOrEqualTo(0)) return;

        if (totalQty.lessThanOrEqualTo(free)) {
          // === Tính lãi/lỗ ===
          // Cộng dồn vào cumulativeProfit

          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'SELL',
            this.adjustToStepSize(totalQty.toNumber()),
          );

          const revenue = await this.getRevenueFromSellOrder(order);
          const currentProfit = revenue - totalUsdSpent; // Trừ vốn bỏ ra
          this.cumulativeProfit += currentProfit;

          console.log('--------------------------');
          console.log(
            `SELL ${totalQty.toNumber()} ${asset} @ ${price}, Tổng lãi / lỗ: ${this.cumulativeProfit}USDT`,
          );
          console.log(
            `PROFIT THIS SELL: ${currentProfit.toFixed(4)} USDT | CUMULATIVE PROFIT: ${this.cumulativeProfit.toFixed(4)} USDT`,
          );
          console.log('--------------------------');

          // this.emitEvent?.({
          //   side: 'SELL',
          //   symbol: this.symbol,
          //   price,
          //   qty: free,
          //   timestamp: Date.now(),
          //   strategy: '',
          // });

          // Xoá các position đã bán
          const soldIds = new Set(sellable.map((item) => item.id));
          this.positions = this.positions.filter((pos) => !soldIds.has(pos.id));
          savePositions(this.positions);
        }
      }
    } catch (err) {
      console.log('Strategy error: ' + err);
    }
  }

  stop() {
    this.running = false;
    this.logger.log(`Stopped EMA+MACD strategy for ${this.symbol}`);
  }

  private adjustToStepSize(qty: number, stepSize = 0.001) {
    return Math.floor(qty / stepSize) * stepSize;
  }

  private usdToQty(price: number, usd: number) {
    const qty = usd / price;
    return this.adjustToStepSize(qty, 0.001); // stepSize của BNB
  }

  private async getFeeFromOrder(order: Order) {
    let totalFeeUSDT = 0;

    if (order.fills) {
      for (const fill of order.fills) {
        const commission = parseFloat(fill.commission);
        const asset = fill.commissionAsset;

        if (asset === 'USDT') {
          totalFeeUSDT += commission;
        } else if (asset === this.symbol.replace('USDT', '')) {
          // phí cùng loại với đồng trade (vd: BTC trong BTCUSDT)
          totalFeeUSDT += commission * parseFloat(fill.price);
        } else {
          // phí bằng đồng khác (vd: BNB)
          const assetPrice = await this.binanceService.getPrice(`${asset}USDT`);
          totalFeeUSDT += commission * assetPrice;
        }
      }
    }

    return totalFeeUSDT;
  }

  private async getRevenueFromSellOrder(order: Order) {
    let revenueUSDT = 0;
    if (order.fills) {
      for (const fill of order.fills) {
        const fillQty = parseFloat(fill.qty);
        const fillPrice = parseFloat(fill.price);
        const gross = fillQty * fillPrice;

        // Trừ fee
        let feeUSDT = 0;
        const commission = parseFloat(fill.commission);
        const asset = fill.commissionAsset;

        if (asset === 'USDT') {
          feeUSDT = commission;
        } else if (asset === this.symbol.replace('USDT', '')) {
          feeUSDT = commission * fillPrice;
        } else {
          const assetPrice = await this.binanceService.getPrice(`${asset}USDT`);
          feeUSDT = commission * assetPrice;
        }

        revenueUSDT += gross - feeUSDT;
      }
    }

    return revenueUSDT;
  }
}
