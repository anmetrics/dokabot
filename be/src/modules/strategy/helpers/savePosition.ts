import * as fs from 'fs';
import * as path from 'path';
import { formatDate } from './formatDate';
import { STRATEGIES } from '../strategies';

export type Position = {
  id: string;
  strategy: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
  totalQtyActual: number;
  buyTime: number;
};

const getFilePath = (strategy: string) => {
  const folderPath = path.resolve(process.cwd(), 'src/positions');
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return path.join(folderPath, `${strategy}.json`);
};

export const loadPositions = (strategy: string): Position[] => {
  try {
    const filePath = getFilePath(strategy);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data: Position[] = JSON.parse(raw || '[]');
    return data;
  } catch (err) {
    console.error(`❌ Failed to load positions for ${strategy}:`, err);
    return [];
  }
};

export const savePositions = (
  positions: Position[],
  strategy: string,
  action: 'add' | 'remove' = 'add',
) => {
  try {
    // === Xác định đường dẫn file riêng cho từng strategy ===
    const positionsDir = path.resolve(process.cwd(), 'src/positions');
    if (!fs.existsSync(positionsDir)) {
      fs.mkdirSync(positionsDir, { recursive: true });
    }

    const filePath = path.join(positionsDir, `${strategy}.json`);

    // === Đọc dữ liệu cũ nếu có ===
    let existingPositions: Position[] = [];
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      existingPositions = JSON.parse(data || '[]');
    }

    // === Cập nhật danh sách mới ===
    let updatedPositions: Position[] = [];

    if (action === 'add') {
      updatedPositions = [...existingPositions, ...positions];
      console.log(
        `🟢 [${strategy}] Added ${positions.length} position(s). Total: ${updatedPositions.length}`,
      );
    } else if (action === 'remove') {
      const idsToRemove = new Set(positions.map((p) => p.id));
      updatedPositions = existingPositions.filter(
        (p) => !idsToRemove.has(p.id),
      );
      console.log(
        `🔴 [${strategy}] Removed ${idsToRemove.size} position(s). Total: ${updatedPositions.length}`,
      );
    }

    // === Ghi lại file ===
    fs.writeFileSync(
      filePath,
      JSON.stringify(updatedPositions, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error(`❌ [${strategy}] Failed to save positions`, err);
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
  strategy: string;
  time?: string;
  buyPrices: number[];
  sellPrice: number;
  totalAmountBuyActual: number; // tổng token thực nhận sau phí mua
  totalAmountBuyUsdtSpent: number; // tổng USDT đã chi
  totalProfit: number; // lợi nhuận thực nhận
  totalRevenueUsdt: number; // tổng USDT nhận được sau bán
}

/**
 * Ghi log lệnh SELL thành công
 * -> mỗi strategy có file riêng: src/positions_selled/{strategy}.json
 */
export const logSellSuccess = (sellData: SellSuccessLog) => {
  try {
    // === Tạo thư mục nếu chưa tồn tại ===
    const logDir = path.resolve(process.cwd(), 'src/positions_selled');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // === Đường dẫn file riêng cho từng strategy ===
    const filePath = path.join(logDir, `${sellData.strategy}.json`);

    // === Đọc dữ liệu cũ nếu có ===
    let existingLogs: SellSuccessLog[] = [];
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      existingLogs = JSON.parse(raw || '[]');
    }

    // === Thêm bản ghi mới ===
    const newLog: SellSuccessLog = {
      ...sellData,
      time: formatDate(new Date()),
    };

    existingLogs.push(newLog);

    // === Ghi lại file ===
    fs.writeFileSync(filePath, JSON.stringify(existingLogs, null, 2), 'utf-8');

    console.log(
      `💾 [${sellData.strategy}] Logged SELL success (${sellData.symbol})`,
    );
  } catch (err) {
    console.error(`❌ [${sellData.strategy}] Failed to log sell success`, err);
  }
};

export const logTotalProfitAll = () => {
  const LOG_DIR = path.resolve(process.cwd(), 'src/positions_selled');
  try {
    if (!fs.existsSync(LOG_DIR)) {
      console.log('📁 No sell log directory found yet.');
      return;
    }

    console.log(
      '\n==================== GLOBAL STRATEGY PROFIT SUMMARY ====================',
    );

    let globalProfit = 0;
    let globalSpent = 0;
    let globalRevenue = 0;
    let globalCount = 0;

    for (const strategy of Object.keys(STRATEGIES)) {
      const filePath = path.join(LOG_DIR, `${strategy}.json`);

      if (!fs.existsSync(filePath)) {
        console.log(`⚪ ${strategy.padEnd(20)} | No logs yet`);
        continue;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const list: SellSuccessLog[] = JSON.parse(raw || '[]');
      if (!list.length) {
        console.log(`⚪ ${strategy.padEnd(20)} | Empty`);
        continue;
      }

      const totalProfit = list.reduce((s, l) => s + (l.totalProfit || 0), 0);
      const totalSpent = list.reduce(
        (s, l) => s + (l.totalAmountBuyUsdtSpent || 0),
        0,
      );
      const totalRevenue = list.reduce(
        (s, l) => s + (l.totalRevenueUsdt || 0),
        0,
      );
      const roiPct = totalSpent > 0 ? (totalProfit / totalSpent) * 100 : 0;

      console.log(
        `🟢 ${strategy.padEnd(20)} | Trades: ${list.length
          .toString()
          .padStart(
            3,
          )} | Profit: ${totalProfit.toFixed(2)} | ROI: ${roiPct.toFixed(2)}%`,
      );

      globalProfit += totalProfit;
      globalSpent += totalSpent;
      globalRevenue += totalRevenue;
      globalCount += list.length;
    }

    const globalRoi = globalSpent > 0 ? (globalProfit / globalSpent) * 100 : 0;

    console.log(
      '-----------------------------------------------------------------------',
    );
    console.log(`💰 Total Trades     : ${globalCount}`);
    console.log(`💵 Total Spent (USDT): ${globalSpent.toFixed(2)}`);
    console.log(`💵 Total Revenue     : ${globalRevenue.toFixed(2)}`);
    console.log(`✅ Total Profit      : ${globalProfit.toFixed(2)} USDT`);
    console.log(`📊 ROI (%)           : ${globalRoi.toFixed(2)}%`);
    console.log(
      '=======================================================================\n',
    );
  } catch (err) {
    console.error('❌ Failed to log all strategies profit', err);
  }
};
