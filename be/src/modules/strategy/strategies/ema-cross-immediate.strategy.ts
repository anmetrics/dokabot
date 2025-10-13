import { EMA } from 'technicalindicators';
import { Logger } from '@nestjs/common';
import { IStrategy } from './strategy.interface';
import { BinanceService } from 'src/modules/binance/binance.service';
import { Candle, Order } from 'binance-api-node';
import { TradeEvent } from '../events/trade.event';
import Decimal from 'decimal.js';
import { randomUUID } from 'crypto';
import {
  loadPositions,
  savePositions,
  logSellSuccess,
  SellSuccessLog,
  logTotalProfit,
} from '../helpers/savePosition';
import { formatDate } from '../helpers/formatDate';
import { getActualBoughtQtyAndFee } from '../helpers/crypto';

type Position = {
  id: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
  totalQtyActual: number;
  buyTime: number;
};

type TimeframeData = {
  prices: number[];
  lastCandles: Candle[];
};

/**
 * EmaCrossImmediateStrategy
 * - Chơi nến 15 phút
 * - Khi EMA7 cắt lên EMA99 => SELL ngay (không xác nhận)
 * - Khi EMA7 cắt xuống EMA99 => BUY ngay (không xác nhận)
 * - Có cooldown để tránh mua/bán liên tục
 * - Giữ biến lastProfitableSellPct: nếu đã có lần bán có lợi nhuận, chiến lược sẽ
 *   đảm bảo tiền phí ước tính < lastProfitableSellPct trước khi thực hiện trade mới.
 *   (Bạn có thể điều chỉnh `estimatedFeePct` và `minRequiredProfitPctOverride`)
 */
export class EmaCrossImmediateStrategy implements IStrategy {
  private logger = new Logger('EmaCrossImmediateStrategy');
  private cumulativeProfit = 0;
  private positions: Position[] = [];

  private maxPositions = 2;
  private maxBuyPrice = 1500;
  private tradePerBuyUsd = 50;

  // Indicator periods
  private emaFastPeriod = 7;
  private emaSlowPeriod = 99;

  // Cooldown to prevent ping-pong (ms)
  private cooldownMs = 45 * 60 * 1000; // 45 phút
  private lastTradeTime = 0;

  private profitUsageLimitPct = 0.8;

  private dcaDropPct = 7; // giảm 3% so với giá mua thấp nhất thì DCA thêm

  // Fee / profit protection
  // estimatedFeePct: 0.001 = 0.1% per trade (adjust to your account fee tier)
  // note: this is a conservative estimate; if you have maker/taker differences set accordingly
  private estimatedFeePct = 0.001;

  // If you want to force a minimum required profit pct (decimal, e.g. 0.005 = 0.5%)
  // before allowing trades to run when lastProfitableSellPct is not available
  private minRequiredProfitPctOverride = 0.024; // 2.4%

  // track last profitable sell percent (decimal). Updated only when a sell yields positive profit
  private lastProfitableSellPct: number | null = null;

  private timeframeData: Record<string, TimeframeData> = {};

  constructor(
    private readonly binanceService: BinanceService,
    private readonly symbol: string,
    private readonly emitEvent?: (event: TradeEvent) => void,
  ) {
    this.positions = loadPositions();
    console.log(
      'CURRENT_POSITION:',
      this.positions,
      'length:',
      this.positions.length,
    );
  }

  async startAll() {
    await this.start('15m');
  }

  private async start(timeframe: '15m') {
    this.logger.log(
      `Starting EMA7 x EMA99 immediate-cross strategy for ${this.symbol} [${timeframe}]`,
    );

    const historicalCandles = await this.binanceService.getHistoricalCandles(
      this.symbol,
      timeframe,
      500,
    );

    this.timeframeData[timeframe] = {
      prices: historicalCandles.map((c) => Number(c.close)),
      lastCandles: historicalCandles.slice(-3) as unknown as Candle[],
    };

    this.binanceService.subscribeCandles(this.symbol, timeframe, (trade) => {
      const data = this.timeframeData[timeframe];
      data.lastCandles.push(trade);
      if (data.lastCandles.length > 3) data.lastCandles.shift();

      data.prices.push(Number(trade.close));
      if (data.prices.length > 500) data.prices.shift();

      this.calcPrice(timeframe);
    });
  }

  private async calcPrice(timeframe: string) {
    try {
      const data = this.timeframeData[timeframe];
      if (!data || data.prices.length < this.emaSlowPeriod) return;

      const price = await this.binanceService.getPrice(this.symbol);
      if (!price) return;

      const { prices, lastCandles } = data;

      // === EMA ===
      const emaFast = EMA.calculate({
        period: this.emaFastPeriod,
        values: prices,
      });
      const emaSlow = EMA.calculate({
        period: this.emaSlowPeriod,
        values: prices,
      });

      if (emaFast.length < 2 || emaSlow.length < 2) return;

      const lastEmaFast = emaFast[emaFast.length - 1];
      const prevEmaFast = emaFast[emaFast.length - 2];
      const lastEmaSlow = emaSlow[emaSlow.length - 1];
      const prevEmaSlow = emaSlow[emaSlow.length - 2];

      // Cross detections
      const bullishCross =
        prevEmaFast < prevEmaSlow && lastEmaFast > lastEmaSlow; // EMA7 cắt lên => SELL
      const bearishCross =
        prevEmaFast > prevEmaSlow && lastEmaFast < lastEmaSlow; // EMA7 cắt xuống => BUY

      const now = Date.now();
      const timeSinceLastTrade = now - this.lastTradeTime;
      const cooldownOk =
        this.lastTradeTime === 0 || timeSinceLastTrade >= this.cooldownMs;

      console.log('====================', formatDate(new Date()));
      console.log('Price:', price.toFixed(6));
      console.log(
        'BullishCross(sell):',
        bullishCross,
        'BearishCross(buy):',
        bearishCross,
        'CooldownOk:',
        cooldownOk,
      );

      // Estimate fee percent for a single trade
      const estimatedSingleTradeFeePct = this.estimatedFeePct;
      // Conservative round-trip fee estimate (buy then sell)
      const estimatedRoundTripFeePct = estimatedSingleTradeFeePct * 2;

      // Determine the required minimum profit pct: use last profitable sell pct if exists, else override
      const requiredProfitPct =
        this.lastProfitableSellPct ?? this.minRequiredProfitPctOverride;

      // A helper that checks the fee constraint the user requested:
      // "tiền phí < số phần trăm setting lợi nhuận của lần bán có lợi nhuận trước đó"
      // We'll compare estimatedRoundTripFeePct < requiredProfitPct
      const adjustedProfitThreshold =
        requiredProfitPct * this.profitUsageLimitPct;
      const feeConstraintOk =
        estimatedRoundTripFeePct < adjustedProfitThreshold;

      // === BUY logic (EMA7 cắt xuống EMA99) ===

      const lowestBuy = Math.min(...this.positions.map((p) => p.buyPrice));
      const dcaTriggerPrice = lowestBuy * (1 - this.dcaDropPct / 100);

      const isDcaValid = !this.positions.length || price <= dcaTriggerPrice;

      if (
        bearishCross &&
        cooldownOk &&
        this.positions.length < this.maxPositions &&
        price < this.maxBuyPrice &&
        isDcaValid
      ) {
        // check fee constraint before entering new position
        if (!feeConstraintOk && this.lastProfitableSellPct !== null) {
          console.log(
            'Skip BUY: estimated fees >= last profitable sell pct requirement',
            {
              estimatedRoundTripFeePct,
              lastProfitableSellPct: this.lastProfitableSellPct,
            },
          );
        } else {
          // Place market buy
          const qty = this.usdToQty(price, this.tradePerBuyUsd);
          if (qty > 0) {
            const order = await this.binanceService.placeMarketOrder(
              this.symbol,
              'BUY',
              qty,
            );
            const { totalQty } = getActualBoughtQtyAndFee(order);

            const usdSpent = await this.getFeeFromOrder(order);

            this.positions.push({
              id: randomUUID(),
              buyPrice: price,
              qty,
              usdSpent,
              totalQtyActual: +totalQty,
              buyTime: Date.now(),
            });
            savePositions(this.positions);
            this.lastTradeTime = Date.now();

            console.log(`[${timeframe}] BUY ${qty} ${this.symbol} @ ${price}`);
          }
        }
      }

      // === SELL logic (EMA7 cắt lên EMA99) ===
      if (bullishCross && cooldownOk && this.positions.length > 0) {
        // check fee constraint before selling
        if (!feeConstraintOk && this.lastProfitableSellPct !== null) {
          console.log(
            'Skip SELL: estimated fees >= last profitable sell pct requirement',
            {
              estimatedRoundTripFeePct,
              lastProfitableSellPct: this.lastProfitableSellPct,
            },
          );
        } else {
          // sell all positions
          const balances = await this.binanceService.getAccount();
          const asset = this.symbol.replace('USDT', '');
          const free = Number(
            balances.balances.find((b) => b.asset === asset)?.free || 0,
          );

          const totalQty = this.positions.reduce(
            (sum, pos) => sum.plus(new Decimal(pos.qty)),
            new Decimal(0),
          );
          const totalUsdSpent = this.positions.reduce(
            (sum, pos) => sum + pos.usdSpent,
            0,
          );

          if (totalQty.lessThanOrEqualTo(0) || totalQty.greaterThan(free))
            return;

          const order = await this.binanceService.placeMarketOrder(
            this.symbol,
            'SELL',
            this.adjustToStepSize(totalQty.toNumber()),
          );

          const revenueUsdt = await this.getRevenueFromSellOrder(order);
          const profit = revenueUsdt - totalUsdSpent;
          const profitPct = revenueUsdt / totalUsdSpent - 1; // decimal

          this.cumulativeProfit += profit;

          const soldIds = new Set(this.positions.map((p) => p.id));
          const soldPositions = [...this.positions];
          this.positions = this.positions.filter((p) => !soldIds.has(p.id));
          savePositions(this.positions);
          this.lastTradeTime = Date.now();

          console.log(
            `[${timeframe}] SELL ${totalQty.toNumber()} ${asset} @ ${price}, Profit: ${profit.toFixed(4)}, Cumulative: ${this.cumulativeProfit.toFixed(4)}`,
          );

          const sellLog: SellSuccessLog = {
            symbol: this.symbol,
            buyPrices: soldPositions.map((p) => p.buyPrice),
            sellPrice: price,
            totalAmountBuyActual: soldPositions.reduce(
              (sum, p) => sum + p.totalQtyActual,
              0,
            ),
            totalAmountBuyUsdtSpent: totalUsdSpent,
            totalProfit: profit,
            totalRevenueUsdt: revenueUsdt,
          };

          logSellSuccess(sellLog);

          // update lastProfitableSellPct if this sell was profitable
          if (profit > 0 && profitPct > 0) {
            this.lastProfitableSellPct = profitPct;
            console.log(
              'Updated lastProfitableSellPct to',
              this.lastProfitableSellPct,
            );
          }
        }
      }
    } catch (err) {
      console.error(`[${timeframe}] Strategy error:`, err);
    } finally {
      logTotalProfit();
    }
  }

  stop() {
    this.logger.log(
      `Stopped EMA7 x EMA99 immediate-cross strategy for ${this.symbol}`,
    );
  }

  private adjustToStepSize(qty: number, stepSize = 0.001) {
    return parseFloat((Math.floor(qty / stepSize) * stepSize).toFixed(3));
  }

  private usdToQty(price: number, usd: number) {
    return this.adjustToStepSize(usd / price);
  }

  private async getFeeFromOrder(order: Order) {
    let totalFeeUSDT = 0;
    if (!order.fills) return 0;
    for (const fill of order.fills) {
      const commission = parseFloat(fill.commission);
      const asset = fill.commissionAsset;
      if (asset === 'USDT') totalFeeUSDT += commission;
      else if (asset === this.symbol.replace('USDT', ''))
        totalFeeUSDT += commission * parseFloat(fill.price);
      else {
        const assetPrice = await this.binanceService.getPrice(`${asset}USDT`);
        totalFeeUSDT += commission * assetPrice;
      }
    }
    return totalFeeUSDT;
  }

  private async getRevenueFromSellOrder(order: Order) {
    let revenueUSDT = 0;
    if (!order.fills) return 0;
    for (const fill of order.fills) {
      const qty = parseFloat(fill.qty);
      const price = parseFloat(fill.price);
      let feeUSDT = 0;
      const commission = parseFloat(fill.commission);
      const asset = fill.commissionAsset;

      if (asset === 'USDT') feeUSDT = commission;
      else if (asset === this.symbol.replace('USDT', ''))
        feeUSDT = commission * price;
      else {
        const assetPrice = await this.binanceService.getPrice(`${asset}USDT`);
        feeUSDT = commission * assetPrice;
      }

      revenueUSDT += qty * price - feeUSDT;
    }
    return revenueUSDT;
  }
}
