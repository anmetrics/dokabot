import * as fs from 'fs';
import * as path from 'path';
import { formatDate } from './formatDate';
import { Position } from 'generated/prisma';
import { BinanceService } from 'src/modules/binance/binance.service';

// Lưu file positions relative với root project

const getFilePath = (strategy: string) => {
  const folderPath = path.resolve(process.cwd(), 'src');
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return path.join(folderPath, `${strategy}.json`);
};

export const savePositions = (symbol: string, positions: Position[]) => {
  try {
    fs.writeFileSync(
      getFilePath(symbol),
      JSON.stringify(positions, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error('Failed to save positions', err);
  }
};

const SELL_SUCCESS_FILE = path.resolve(process.cwd(), 'src/sell_success.json');

const ensureFileExists = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
  }
};

export interface SellPositionInfo {
  id: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
}

export interface SellSuccessLog {
  symbol: string;
  time?: string;
  buyPrices: number[];
  sellPrice: number;
  totalAmountBuyActual: number; // tổng token thực nhận sau phí mua
  totalAmountBuyUsdtSpent: number; // tổng USDT đã chi
  totalProfit: number; // lợi nhuận thực nhận
  totalRevenueUsdt: number; // tổng USDT nhận được sau bán
}

export const logSellSuccess = (sellData: SellSuccessLog) => {
  try {
    ensureFileExists(SELL_SUCCESS_FILE);
    const raw = fs.readFileSync(SELL_SUCCESS_FILE, 'utf-8');
    const list: SellSuccessLog[] = JSON.parse(raw);

    list.push({
      ...sellData,
      time: formatDate(new Date()),
    });

    fs.writeFileSync(SELL_SUCCESS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to log sell success', err);
  }
};

export const logTotalProfit = async (
  binanceService: BinanceService,
  prices: {
    BNBUSDT: number;
    BTCUSDT: number;
    SOLUSDT: number;
  },
  symbol: 'BNBUSDT' | 'BTCUSDT' | 'SOLUSDT',
) => {
  try {
    const symbols = [symbol];

    let list: SellSuccessLog[] = [];
    if (fs.existsSync(SELL_SUCCESS_FILE)) {
      const raw = fs.readFileSync(SELL_SUCCESS_FILE, 'utf-8');
      list = JSON.parse(raw);
    }

    let grandProfit = 0;
    let grandRevenue = 0;
    let grandSpent = 0;

    const result: any = {
      symbols: [],
      grandTotal: {
        totalProfit: 0,
        totalRevenue: 0,
        totalSpent: 0,
      },
    };

    console.log(
      '==================== TOTAL SUMMARY PER SYMBOL ====================',
    );

    for (const symbol of symbols) {
      console.log(`\n--- Symbol: ${symbol} ---`);

      const symbolData: any = {
        symbol,
        sellSummary: null,
        openPositions: null,
      };

      // ===================== SELL LOG SUMMARY =====================
      const logs = list.filter((log) => log.symbol === symbol);
      if (logs.length > 0) {
        const totalProfit = logs.reduce((sum, log) => sum + log.totalProfit, 0);
        const totalRevenue = logs.reduce(
          (sum, log) => sum + log.totalRevenueUsdt,
          0,
        );
        const totalSpent = logs.reduce(
          (sum, log) => sum + log.totalAmountBuyUsdtSpent,
          0,
        );

        console.log('Total Sell Count    :', logs.length);
        console.log('Total Profit (USDT) :', totalProfit.toFixed(4));
        console.log('Total Revenue (USDT):', totalRevenue.toFixed(4));
        console.log('Total Spent (USDT)  :', totalSpent.toFixed(4));

        symbolData.sellSummary = {
          totalSellCount: logs.length,
          totalProfit,
          totalRevenue,
          totalSpent,
        };

        grandProfit += totalProfit;
        grandRevenue += totalRevenue;
        grandSpent += totalSpent;
      } else {
        console.log('No sell records found.');
      }

      // ===================== OPEN POSITIONS SUMMARY =====================
      const positions: Position[] =
        await binanceService.getOpenPositions(symbol);
      const positionsMini: Position[] = await binanceService.getOpenPositions(
        symbol + '_MINI',
      );
      if (positionsMini?.length) {
        positions.push(...positionsMini);
      }

      if (positions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const totalQty = positions.reduce((sum, p) => sum + p.qty, 0);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const totalUsdSpent = positions.reduce((sum, p) => sum + p.usdSpent, 0);
        const avgBuyPrice = totalQty > 0 ? totalUsdSpent / totalQty : 0;

        const currentValue = prices[symbol.replace('_MINI', '')] * totalQty;
        const unrealizedPnL = currentValue - totalUsdSpent;

        console.log('>>> OPEN POSITIONS SUMMARY');
        console.log('Total Quantity       :', totalQty.toFixed(8));
        console.log('Avg Buy Price        :', avgBuyPrice.toFixed(4));
        console.log(
          'Current Price        :',
          prices[symbol.replace('_MINI', '')].toFixed(4),
        );
        console.log('Total Spent (Open)   :', totalUsdSpent.toFixed(4), 'USDT');
        console.log('Current Value        :', currentValue.toFixed(4), 'USDT');
        console.log('Unrealized PnL       :', unrealizedPnL.toFixed(4), 'USDT');

        symbolData.openPositions = {
          totalQty,
          avgBuyPrice,
          currentPrice: prices[symbol.replace('_MINI', '')],
          totalSpentOpen: totalUsdSpent,
          currentValue,
          unrealizedPnL,
        };
      } else {
        console.log('>>> No open positions.');
      }

      result.symbols.push(symbolData);
    }

    result.grandTotal = {
      totalProfit: grandProfit,
      totalRevenue: grandRevenue,
      totalSpent: grandSpent,
    };

    console.log('\n==================== GRAND TOTAL ====================');
    console.log('Total Profit (USDT) :', grandProfit.toFixed(4));
    console.log('Total Revenue (USDT):', grandRevenue.toFixed(4));
    console.log('Total Spent (USDT)  :', grandSpent.toFixed(4));
    console.log('=====================================================');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  } catch (err) {
    console.error('Failed to calculate total profit', err);
    throw err;
  }
};
