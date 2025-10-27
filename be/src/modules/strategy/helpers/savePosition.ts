import { Position } from 'generated/prisma';
import { BinanceService } from 'src/modules/binance/binance.service';

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

    const list = await binanceService.getListSellSuccess();

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

    for (const symbol of symbols) {
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
        symbolData.sellSummary = {
          totalSellCount: logs.length,
          totalProfit,
          totalRevenue,
          totalSpent,
        };

        grandProfit += totalProfit;
        grandRevenue += totalRevenue;
        grandSpent += totalSpent;
      }

      // ===================== OPEN POSITIONS SUMMARY =====================
      const positions: Position[] =
        await binanceService.getListPositionsBySymbol(symbol);

      if (positions.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const totalQty = positions.reduce((sum, p) => sum + p.qty, 0);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        const totalUsdSpent = positions.reduce((sum, p) => sum + p.usdSpent, 0);
        const avgBuyPrice = totalQty > 0 ? totalUsdSpent / totalQty : 0;

        const currentValue = prices[symbol.replace('_MINI', '')] * totalQty;
        const unrealizedPnL = currentValue - totalUsdSpent;

        symbolData.openPositions = {
          totalQty,
          avgBuyPrice,
          currentPrice: prices[symbol.replace('_MINI', '')],
          totalSpentOpen: totalUsdSpent,
          currentValue,
          unrealizedPnL,
        };
      }

      result.symbols.push(symbolData);
    }

    result.grandTotal = {
      totalProfit: grandProfit,
      totalRevenue: grandRevenue,
      totalSpent: grandSpent,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return result;
  } catch (err) {
    console.error('Failed to calculate total profit', err);
    throw err;
  }
};
