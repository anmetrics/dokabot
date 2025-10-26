import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Binance, {
  Candle,
  CandleChartInterval_LT,
  Order,
  OrderSide,
  OrderSide_LT,
  OrderType,
} from 'binance-api-node';
import { OrderbookEvent } from './events/orderbook.event';
import { MarketTrend } from './binance.enum';
import { ATR, EMA } from 'technicalindicators';
import { logTotalProfit } from '../strategy/helpers/savePosition';
import { formatProfitLog } from '../strategy/helpers/logger';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from 'src/prisma.service';
import { Prisma } from 'generated/prisma';
import { LIST_SYMBOL, SETTING_KEY } from '../settings/settings.enum';
import { BuyCoinDto } from './dto/buy-coin.dto';

type ReversalPattern = {
  name: string;
  trend: 'neutral' | 'up' | 'down';
};

@Injectable()
export class BinanceService implements OnModuleInit {
  private client: ReturnType<typeof Binance> | null = null;
  private logger = new Logger('BinanceService');

  constructor(
    private eventEmitter: EventEmitter2,
    private readonly telegramService: TelegramService,
    private readonly prismaService: PrismaService,
  ) {
    this.init();
  }
  async onModuleInit() {
    const existingSettings = await this.prismaService.setting.findMany({});
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return
    const existingKeys = new Set(existingSettings.map((s) => s.key));

    const defaults: Record<string, string> = {
      [SETTING_KEY.ENABLE_BUY]: 'true',
      [SETTING_KEY.ENABLE_SELL]: 'true',
      [SETTING_KEY.MAX_BNB_PRICE]: '1100',
      [SETTING_KEY.MAX_SOL_PRICE]: '190',
      [SETTING_KEY.MAX_BTC_PRICE]: '110000',
      [SETTING_KEY.MAX_BNB_PRICE_MINI]: '1100',
      [SETTING_KEY.MAX_SOL_PRICE_MINI]: '190',
      [SETTING_KEY.MAX_BTC_PRICE_MINI]: '110000',
      [SETTING_KEY.DCA_WHEN_DROP_PERCENT]: '0.03',
    };

    const missingKeys = Object.keys(SETTING_KEY).filter(
      (key) => !existingKeys.has(key),
    );

    if (missingKeys.length > 0) {
      await this.prismaService.setting.createMany({
        data: missingKeys.map((key) => ({
          key,
          value: defaults[key] ?? '',
        })),
        skipDuplicates: true,
      });
    }
  }

  init() {
    const apiKey = process.env.BINANCE_API_KEY || '';
    const apiSecret = process.env.BINANCE_API_SECRET || '';
    const useTestnet = !!process.env.BINANCE_TESTNET;

    console.log('useTestnet:', useTestnet);

    this.client = Binance({
      apiKey,
      apiSecret,
      httpBase: useTestnet ? 'https://testnet.binance.vision' : undefined,
      wsBase: useTestnet ? 'wss://testnet.binance.vision' : undefined,
    });

    this.logger.log(
      'Binance client initialized' + (useTestnet ? ' (TESTNET)' : ''),
    );
  }

  // existing methods...
  subscribeAggTrades(symbol: string, cb: (trade: any) => void) {
    if (!this.client) throw new Error('Client not initialized');
    const lowercase = symbol.toLowerCase();
    return this.client.ws.aggTrades(lowercase, cb);
  }

  async getPrice(symbol: string) {
    if (!this.client) throw new Error('Client not initialized');
    const res = await this.client.prices();
    return Number(res[symbol]);
  }

  async getPrices(symbols: string[]) {
    if (!this.client) throw new Error('Client not initialized');
    const res = await this.client.prices();

    return Object.fromEntries(
      symbols
        .filter((symbol) => res[symbol])
        .map((symbol) => [symbol, Number(res[symbol])]),
    );
  }

  async getRevenueFromSellOrder(
    order: Order,
    symbol: string,
    inputBnbPrice?: number,
  ) {
    const bnbPrice = inputBnbPrice
      ? inputBnbPrice
      : await this.getPrice(LIST_SYMBOL.BNBUSDT);
    let revenueUSDT = 0;
    if (!order.fills) return 0;
    for (const fill of order.fills) {
      const qty = parseFloat(fill.qty);
      const price = parseFloat(fill.price);
      let feeUSDT = 0;
      const commission = parseFloat(fill.commission);
      const asset = fill.commissionAsset;

      if (asset === 'USDT') feeUSDT = commission;
      else if (asset === symbol.replace('USDT', ''))
        feeUSDT = commission * price;
      else if (asset === 'BNB') {
        feeUSDT = commission * bnbPrice;
      } else {
        const assetPrice = await this.getPrice(`${asset}USDT`);
        feeUSDT = commission * assetPrice;
      }

      revenueUSDT += qty * price - feeUSDT;
    }
    return revenueUSDT;
  }

  async placeMarketOrder(symbol: string, side: OrderSide_LT, quantity: number) {
    if (!this.client) throw new Error('Client not initialized');
    try {
      const order = await this.client.order({
        symbol,
        side,
        type: OrderType.MARKET,
        quantity: quantity.toString(),
      });
      this.logger.log(`Order placed: ${JSON.stringify(order)}`);
      return order;
    } catch (err) {
      this.logger.error('Order error: ' + JSON.stringify(err));
      throw err;
    }
  }

  subscribeOrderBook(symbol: string) {
    if (!this.client) throw new Error('Client not initialized');
    this.client.ws.depth(symbol.toLowerCase(), (depth) => {
      this.eventEmitter.emit(OrderbookEvent.UPDATE, depth);
    });
  }

  async getAccount() {
    if (!this.client) throw new Error('Client not initialized');
    return this.client.accountInfo();
  }

  // -------------------------
  // NEW: get historical candles (REST)
  async getHistoricalCandles(
    symbol: string,
    interval: CandleChartInterval_LT = '1m',
    limit = 500,
  ) {
    if (!this.client) throw new Error('Client not initialized');
    // binance-api-node provides client.candles
    // returns array of { openTime, open, high, low, close, volume, closeTime, ...}
    return this.client.candles({ symbol, interval, limit });
  }

  // NEW: subscribe to kline/candles via websocket
  subscribeCandles(
    symbol: string,
    interval = '1m',
    cb: (candle: Candle) => void,
  ) {
    if (!this.client) throw new Error('Client not initialized');
    const lowercase = symbol.toLowerCase();
    const unsub = this.client.ws.candles(lowercase, interval, (candle) => {
      // candle structure from binance-api-node: { isFinal, open, high, low, close, ... }
      // We'll only call cb when candle.isFinal === true to avoid painting on partial bars
      if (candle.isFinal) cb(candle);
    });
    // client.ws.candles returns an unsubscribe function
    return unsub as () => void;
  }

  async detectMarketTrend(
    symbol: string,
    options?: {
      candleInterval?: CandleChartInterval_LT;
      lookback?: number; // số nến dùng để phân tích
      emaPeriod?: number; // EMA dài hạn
      atrPeriod?: number; // ATR period
      sidewayThresholdPct?: number; // biên độ % để coi là sideway
      slopeThresholdPct?: number; // slope EMA tối thiểu để coi trend
    },
  ): Promise<MarketTrend> {
    const candleInterval = options?.candleInterval || '1h';
    const lookback = options?.lookback || 50;
    const emaPeriod = options?.emaPeriod || 26;
    const atrPeriod = options?.atrPeriod || 14;
    const sidewayThresholdPct = options?.sidewayThresholdPct || 2; // 2% biến động = sideway
    const slopeThresholdPct = options?.slopeThresholdPct || 0.2; // EMA slope %

    // 1. Lấy nến lịch sử
    const candles = await this.getHistoricalCandles(
      symbol,
      candleInterval,
      lookback,
    );
    const closes = candles.map((c) => Number(c.close));
    const highs = candles.map((c) => Number(c.high));
    const lows = candles.map((c) => Number(c.low));

    // 2. Tính ATR để đo volatility
    const atrValues = ATR.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: atrPeriod,
    });
    const lastAtr = atrValues[atrValues.length - 1];
    const lastClose = closes[closes.length - 1];

    // ATR % so với giá đóng cửa
    const atrPct = (lastAtr / lastClose) * 100;

    // Nếu biến động nhỏ → sideway
    if (atrPct < sidewayThresholdPct) return 'SIDEWAY';

    // 3. EMA dài hạn và slope
    const emaValues = EMA.calculate({ period: emaPeriod, values: closes });
    const lastEma = emaValues[emaValues.length - 1];
    const firstEma = emaValues[0];
    const emaSlopePct = ((lastEma - firstEma) / firstEma) * 100;

    if (Math.abs(emaSlopePct) < slopeThresholdPct) return 'SIDEWAY';
    if (emaSlopePct > 0) return 'UPTREND';
    return 'DOWNTREND';
  }

  detectReversalCandle(
    candle: Candle,
    prevCandle: Candle,
    prevPrevCandle: Candle,
  ): ReversalPattern {
    if (!candle || !prevCandle || !prevPrevCandle) {
      return { name: 'Invalid candle data', trend: 'neutral' };
    }

    const parseCandle = (c: Candle) => ({
      open: parseFloat(c.open),
      close: parseFloat(c.close),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
    });

    const { open, close, high, low } = parseCandle(candle);
    const { open: prevOpen, close: prevClose } = parseCandle(prevCandle);
    const { open: prevPrevOpen, close: prevPrevClose } =
      parseCandle(prevPrevCandle);

    if (
      [
        open,
        close,
        high,
        low,
        prevOpen,
        prevClose,
        prevPrevOpen,
        prevPrevClose,
      ].some(isNaN)
    ) {
      return { name: 'Invalid candle values', trend: 'neutral' };
    }

    const body = Math.abs(close - open);
    const upperShadow = high - Math.max(open, close);
    const lowerShadow = Math.min(open, close) - low;
    const candleRange = high - low;

    // === 1. Doji (indecision / reversal) ===
    if (body <= candleRange * 0.1) {
      const strongDownTrendBefore =
        prevClose < prevOpen &&
        prevPrevClose < prevPrevOpen &&
        (prevPrevOpen - close) / prevPrevOpen >= 0.03;

      if (strongDownTrendBefore) {
        return { name: 'Doji (Bullish Reversal)', trend: 'up' };
      }

      return { name: 'Doji (Indecision)', trend: 'neutral' };
    }

    // === 2. Hammer / Hanging Man ===
    const isHammerOrHangingMan =
      body <= candleRange * 0.3 &&
      lowerShadow >= 2 * body &&
      upperShadow <= body * 0.5;

    if (isHammerOrHangingMan) {
      if (close > open) {
        return { name: 'Hammer (Bullish Reversal)', trend: 'up' };
      } else {
        return { name: 'Hanging Man (Bearish Reversal)', trend: 'down' };
      }
    }

    // === 3. Inverted Hammer / Shooting Star ===
    const isInvertedHammerOrShootingStar =
      body <= candleRange * 0.3 &&
      upperShadow >= 2 * body &&
      lowerShadow <= body * 0.5;

    if (isInvertedHammerOrShootingStar) {
      if (close > open) {
        return { name: 'Inverted Hammer (Bullish Reversal)', trend: 'up' };
      } else {
        return { name: 'Shooting Star (Bearish Reversal)', trend: 'down' };
      }
    }

    // === 4. Bullish Engulfing ===
    const isBullishEngulfing =
      prevClose < prevOpen &&
      close > open &&
      open <= prevClose &&
      close >= prevOpen &&
      close - open > prevOpen - prevClose;

    if (isBullishEngulfing) {
      return { name: 'Bullish Engulfing (Reversal)', trend: 'up' };
    }

    // === 5. Bearish Engulfing ===
    const isBearishEngulfing =
      prevClose > prevOpen &&
      close < open &&
      open >= prevClose &&
      close <= prevOpen &&
      open - close > prevClose - prevOpen;

    if (isBearishEngulfing) {
      return { name: 'Bearish Engulfing (Reversal)', trend: 'down' };
    }

    return { name: 'No pattern detected', trend: 'neutral' };
  }

  async sendLog() {
    try {
      const { log: BNBUSDTLog } = await this.getLog('BNBUSDT');
      const { log: BTCUSDTLog } = await this.getLog('BTCUSDT');
      const { log: SOLUSDTLog } = await this.getLog('SOLUSDT');

      await this.telegramService.sendMessage(formatProfitLog(BNBUSDTLog));
      await this.telegramService.sendMessage(formatProfitLog(BTCUSDTLog));
      await this.telegramService.sendMessage(formatProfitLog(SOLUSDTLog));
    } catch (error) {
      console.error('❌ ReflectReportJob failed:', error);
    }
  }

  async getLog(symbol: 'BNBUSDT' | 'BTCUSDT' | 'SOLUSDT') {
    const priceMap = await this.getPrices(['BTCUSDT', 'BNBUSDT', 'SOLUSDT']);
    const log = await logTotalProfit(
      this,
      {
        BNBUSDT: priceMap[LIST_SYMBOL.BNBUSDT],
        BTCUSDT: priceMap[LIST_SYMBOL.BTCUSDT],
        SOLUSDT: priceMap[LIST_SYMBOL.SOLUSDT],
      },
      symbol,
    );

    return {
      log,
    };
  }

  async getOpenPositions(strategy: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await this.prismaService.position.findMany({
      where: {
        strategy: strategy,
      },
      orderBy: {
        buyPrice: 'asc',
      },
    });
  }

  async savePosition(data: Prisma.PositionCreateInput) {
    return await this.prismaService.position.create({
      data,
    });
  }

  async deletePosition(id: string) {
    return await this.prismaService.position.delete({
      where: { id },
    });
  }

  async saveSellSuccess(data: Prisma.SellSuccessCreateInput) {
    return await this.prismaService.sellSuccess.create({ data });
  }

  async getListSellSuccess() {
    return await this.prismaService.sellSuccess.findMany({});
  }

  async getAllOpenPositions() {
    const positions = await this.prismaService.position.findMany({
      where: {},
      orderBy: {
        createdAt: 'desc',
      },
    });

    const uniqueSymbols = [...new Set(positions.map((p) => p.symbol))];

    const priceMap = await this.getPrices(uniqueSymbols);

    const positionsWithPnL = positions.map((pos) => {
      const currentPrice = priceMap[pos.symbol] ?? 0;
      const profit = (currentPrice - pos.buyPrice) * pos.qty;
      const profitPercent =
        ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100;
      return {
        ...pos,
        strategy: pos.strategy.includes('_')
          ? pos.strategy.split('_').pop()!
          : '',
        currentPrice,
        profit,
        profitPercent,
      };
    });

    return positionsWithPnL;
  }

  async getHistories(
    page: number = 1,
    limit: number = 10,
    startDate?: string,
    endDate?: string,
    symbol?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by date range
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Filter by symbol (case-insensitive)
    if (symbol) {
      where.symbol = {
        contains: symbol,
        mode: 'insensitive',
      };
    }

    // Fetch paginated data
    const [data, total] = await Promise.all([
      this.prismaService.sellSuccess.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prismaService.sellSuccess.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDateProfits(
    period?: '1m' | '3m' | '6m' | '1y' | 'all',
    groupBy: 'day' | 'week' = 'day',
  ) {
    const now = new Date();
    let startDate: Date | undefined;

    switch (period) {
      case '1m':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '3m':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6m':
        startDate = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case '1y':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      case 'all':
        startDate = undefined;
        break;
      default:
        startDate = undefined;
    }

    const startCondition = startDate
      ? `WHERE created_at >= '${startDate.toISOString().slice(0, 19).replace('T', ' ')}'`
      : '';

    const groupExpr =
      groupBy === 'week'
        ? `DATE_FORMAT(created_at, '%x-W%v')` // ISO week format (e.g. 2025-W43)
        : `DATE(created_at)`;

    const result = await this.prismaService.$queryRawUnsafe<
      { date: string; totalProfit: number }[]
    >(`
    SELECT 
      ${groupExpr} AS date,
      SUM(total_profit) AS totalProfit
    FROM sell_successes
    ${startCondition}
    GROUP BY ${groupExpr}
    ORDER BY ${groupExpr} ASC
  `);

    return result.map((r) => ({
      date: r.date,
      totalProfit: Number(r.totalProfit),
    }));
  }

  buy(dto: BuyCoinDto) {
    const { market, quantity, symbol } = dto;
    const timestamp = Date.now();
    const data: any = {
      symbol,
      side: 'BUY',
      type: market ? 'MARKET' : 'LIMIT',
      quantity,
      timestamp,
    };

    if (!dto.market) {
      if (!dto.price)
        throw new BadRequestException('Price is required for LIMIT order');
      data.price = dto.price;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return data;
  }

  async sell(id: string, price?: number) {
    const openPosition = await this.prismaService.position.findFirst({
      where: {
        id,
      },
    });
    if (!openPosition) {
      throw new BadRequestException('Invalid position');
    }

    const listPrices = await this.getPrices([
      openPosition.symbol,
      LIST_SYMBOL.BNBUSDT,
    ]);
    const currentPrice = listPrices[openPosition.symbol];
    const minProfitPct = 0.005;

    if (price) {
      const minAllowed = currentPrice * 0.994;
      if (price < minAllowed) {
        throw new BadRequestException(
          `Price too low. Minimum allowed is ${minAllowed.toFixed(
            2,
          )} (${((1 - price / currentPrice) * 100).toFixed(6)}% below current price)`,
        );
      }
    }

    const sellable = currentPrice >= openPosition.buyPrice * (1 + minProfitPct);
    if (!sellable) {
      throw new BadRequestException('Invalid profit');
    }

    const order = price
      ? await this.client!.order({
          symbol: openPosition.symbol,
          side: OrderSide.SELL,
          type: OrderType.MARKET,
          quantity: String(openPosition.qty),
        })
      : await this.placeMarketOrder(
          openPosition.symbol,
          OrderSide.SELL,
          openPosition.qty,
        );
    const revenueUsdt = await this.getRevenueFromSellOrder(
      order,
      openPosition.symbol,
      listPrices[LIST_SYMBOL.BNBUSDT],
    );

    const profit = revenueUsdt - openPosition.usdSpent;

    await this.deletePosition(openPosition.id);
    await this.saveSellSuccess({
      symbol: openPosition.symbol,
      buyPrices: [openPosition.buyPrice],
      sellPrice: currentPrice,
      totalAmountBuyActual: openPosition.qty,
      totalAmountBuyUsdtSpent: openPosition.usdSpent,
      totalProfit: profit,
      totalRevenueUsdt: revenueUsdt,
    });
    return order;
  }

  async getCumulativeProfits() {
    const data = await this.prismaService.sellSuccess.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        createdAt: true,
        totalProfit: true,
      },
    });

    const grouped = data.reduce(
      (acc, item) => {
        const date = new Date(item.createdAt).toISOString().split('T')[0];
        if (!acc[date]) acc[date] = 0;
        acc[date] += Number(item.totalProfit);
        return acc;
      },
      {} as Record<string, number>,
    );

    const dailyProfits = Object.entries(grouped)
      .map(([date, totalProfit]) => ({ date, totalProfit }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let cumulative = 0;
    const cumulativeProfits = dailyProfits.map((d) => {
      cumulative += d.totalProfit;
      return {
        date: d.date,
        dailyProfit: d.totalProfit,
        cumulativeProfit: cumulative,
      };
    });
    return cumulativeProfits;
  }

  async getListSettings() {
    return this.prismaService.setting.findMany({});
  }

  async updateSetting(key: SETTING_KEY, value: any) {
    return this.prismaService.setting.update({
      where: {
        key,
      },
      data: {
        value,
      },
    });
  }

  async getSettingByKey(key: SETTING_KEY | null) {
    if (!key) return;
    const setting = await this.prismaService.setting.findFirst({
      where: {
        key,
      },
    });
    return setting?.value;
  }
}
