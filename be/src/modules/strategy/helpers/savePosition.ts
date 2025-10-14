import * as fs from 'fs';
import * as path from 'path';
import { formatDate } from './formatDate';

// Lưu file positions relative với root project
const FILE_PATH = path.resolve(process.cwd(), 'src/positions.json');

export type Position = {
  id: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
  totalQtyActual: number;
  buyTime: number;
  dcaIndex: number;
};

export const loadPositions = (): Position[] => {
  try {
    if (!fs.existsSync(FILE_PATH)) {
      // Tạo folder nếu chưa tồn tại
      fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
      fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(FILE_PATH, 'utf-8');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load positions, creating new one', err);
    return [];
  }
};

export const savePositions = (positions: any[]) => {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(positions, null, 2), 'utf-8');
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

export const logTotalProfit = (currentPrice: number) => {
  try {
    if (!fs.existsSync(SELL_SUCCESS_FILE)) {
      console.log('No sell logs found.');
      return;
    }

    const raw = fs.readFileSync(SELL_SUCCESS_FILE, 'utf-8');
    const list: SellSuccessLog[] = JSON.parse(raw);

    const totalProfit = list.reduce((sum, log) => sum + log.totalProfit, 0);
    const totalRevenue = list.reduce(
      (sum, log) => sum + log.totalRevenueUsdt,
      0,
    );
    const totalSpent = list.reduce(
      (sum, log) => sum + log.totalAmountBuyUsdtSpent,
      0,
    );

    console.log('==================== TOTAL SELL SUMMARY ====================');
    console.log('Total Sell Count   :', list.length);
    console.log('Total Profit (USDT):', totalProfit.toFixed(4));
    console.log('Total Revenue (USDT):', totalRevenue.toFixed(4));
    console.log('Total Spent (USDT)  :', totalSpent.toFixed(4));
    console.log('===========================================================');

    // ========== PHẦN TỔNG HỢP VỊ THẾ HIỆN TẠI ==========
    const positions = loadPositions();
    if (positions.length === 0) {
      console.log('No open positions.');
      return;
    }

    const totalQty = positions.reduce((sum, p) => sum + p.qty, 0);
    const totalUsdSpent = positions.reduce((sum, p) => sum + p.usdSpent, 0);
    const avgBuyPrice = totalQty > 0 ? totalUsdSpent / totalQty : 0;

    const currentValue = currentPrice * totalQty;
    const unrealizedPnL = currentValue - totalUsdSpent;

    console.log('==================== OPEN POSITIONS SUMMARY ================');
    console.log('Total Quantity       :', totalQty.toFixed(8));
    console.log('Avg Buy Price        :', avgBuyPrice.toFixed(4));
    console.log('Current Price        :', currentPrice.toFixed(4));
    console.log('Total Spent (Open)   :', totalUsdSpent.toFixed(4), 'USDT');
    console.log('Current Value        :', currentValue.toFixed(4), 'USDT');
    console.log('Unrealized PnL       :', unrealizedPnL.toFixed(4), 'USDT');
    console.log('===========================================================');
  } catch (err) {
    console.error('Failed to calculate total profit', err);
  }
};
