import { Candle } from '../../exchange/exchange.types';
import { RISK_PARAMS } from '../params';
import {
  HOLD,
  Signal,
  StrategyDefinition,
  StrategyParams,
} from '../strategy.types';
import {
  atr,
  bollinger,
  closes,
  crossedAbove,
  crossedBelow,
  ema,
  highs,
  last,
  lows,
  macd,
  rsi,
  sma,
  stochastic,
  volumes,
} from './indicators';

const num = (params: StrategyParams, key: string) => Number(params[key]);
const bool = (params: StrategyParams, key: string) => params[key] === true;

/**
 * Scales a distance past a threshold into the 0–1 confidence band.
 *
 * `full` can legitimately be zero — flat prices collapse the Bollinger bands, a
 * flat channel has no width — and `0 / 0` would put NaN into a signal that callers
 * use to size positions. There is no information in that case, so confidence is 0.
 */
const confidenceFrom = (distance: number, full: number): number => {
  if (!Number.isFinite(distance) || !Number.isFinite(full) || full <= 0) return 0;
  return Math.max(0, Math.min(1, distance / full));
};

// ─────────────────────────────────────────────────────────────
// RSI mean reversion
// ─────────────────────────────────────────────────────────────
const rsiReversal: StrategyDefinition = {
  key: 'rsi-reversal',
  name: 'RSI Reversal',
  description:
    'Mua khi RSI vào vùng quá bán và bắt đầu quay đầu, bán khi vào vùng quá mua. Hợp với thị trường đi ngang.',
  category: 'mean-reversion',
  minCandles: 40,
  requiredCandles: (p) => num(p, 'period') * 3,
  params: [
    {
      key: 'period',
      label: 'Chu kỳ RSI',
      type: 'number',
      default: 14,
      min: 2,
      max: 100,
      unit: 'bars',
      help: 'Số nến dùng để tính RSI. Nhỏ hơn = nhạy hơn, nhiều tín hiệu nhiễu hơn.',
    },
    {
      key: 'oversold',
      label: 'Ngưỡng quá bán',
      type: 'number',
      default: 30,
      min: 1,
      max: 49,
      help: 'RSI dưới mức này được coi là quá bán.',
    },
    {
      key: 'overbought',
      label: 'Ngưỡng quá mua',
      type: 'number',
      default: 70,
      min: 51,
      max: 99,
      help: 'RSI trên mức này được coi là quá mua.',
    },
    {
      key: 'requireTurn',
      label: 'Chờ RSI quay đầu',
      type: 'boolean',
      default: true,
      help: 'Chỉ vào lệnh khi RSI đã bắt đầu đảo chiều, thay vì ngay khi chạm ngưỡng.',
    },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params) => {
    const period = num(params, 'period');
    const values = rsi(closes(candles), period);
    const current = last(values);
    const previous = values[values.length - 2];

    if (Number.isNaN(current)) return HOLD('Chưa đủ dữ liệu để tính RSI');

    const oversold = num(params, 'oversold');
    const overbought = num(params, 'overbought');
    const requireTurn = bool(params, 'requireTurn');

    if (current < oversold && (!requireTurn || current > previous)) {
      return {
        action: 'BUY',
        confidence: confidenceFrom(oversold - current, oversold),
        reason: `RSI ${current.toFixed(1)} dưới ngưỡng quá bán ${oversold}`,
        indicators: { rsi: current },
      };
    }

    if (current > overbought && (!requireTurn || current < previous)) {
      return {
        action: 'SELL',
        confidence: confidenceFrom(current - overbought, 100 - overbought),
        reason: `RSI ${current.toFixed(1)} trên ngưỡng quá mua ${overbought}`,
        indicators: { rsi: current },
      };
    }

    return { ...HOLD(`RSI ${current.toFixed(1)} ở vùng trung tính`), indicators: { rsi: current } };
  },
};

// ─────────────────────────────────────────────────────────────
// MACD crossover
// ─────────────────────────────────────────────────────────────
const macdCross: StrategyDefinition = {
  key: 'macd-cross',
  name: 'MACD Crossover',
  description:
    'Vào lệnh khi đường MACD cắt đường tín hiệu. Bắt xu hướng sớm, hiệu quả khi thị trường có trend rõ.',
  category: 'momentum',
  minCandles: 60,
  requiredCandles: (p) => num(p, 'slowPeriod') + num(p, 'signalPeriod') * 3,
  params: [
    { key: 'fastPeriod', label: 'EMA nhanh', type: 'number', default: 12, min: 2, max: 100, unit: 'bars' },
    { key: 'slowPeriod', label: 'EMA chậm', type: 'number', default: 26, min: 3, max: 200, unit: 'bars' },
    { key: 'signalPeriod', label: 'Đường tín hiệu', type: 'number', default: 9, min: 2, max: 50, unit: 'bars' },
    {
      key: 'requirePositiveHistogram',
      label: 'Chỉ mua khi histogram dương',
      type: 'boolean',
      default: false,
      help: 'Lọc bớt tín hiệu ngược xu hướng, đổi lại vào lệnh muộn hơn.',
    },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params) => {
    const fastPeriod = num(params, 'fastPeriod');
    const slowPeriod = num(params, 'slowPeriod');

    // A fast EMA that is not faster than the slow one produces a MACD line that
    // never means anything, so this is a configuration error, not a signal.
    if (fastPeriod >= slowPeriod) {
      return HOLD('EMA nhanh phải nhỏ hơn EMA chậm');
    }

    const { macd: line, signal, histogram } = macd(
      closes(candles),
      fastPeriod,
      slowPeriod,
      num(params, 'signalPeriod'),
    );

    const currentHistogram = last(histogram);
    if (Number.isNaN(currentHistogram)) return HOLD('Chưa đủ dữ liệu để tính MACD');

    const indicators = { macd: last(line), signal: last(signal), histogram: currentHistogram };

    if (crossedAbove(line, signal)) {
      if (bool(params, 'requirePositiveHistogram') && currentHistogram <= 0) {
        return { ...HOLD('MACD cắt lên nhưng histogram chưa dương'), indicators };
      }
      return {
        action: 'BUY',
        confidence: Math.min(1, Math.abs(currentHistogram) / (Math.abs(last(line)) || 1)),
        reason: 'MACD cắt lên trên đường tín hiệu',
        indicators,
      };
    }

    if (crossedBelow(line, signal)) {
      return {
        action: 'SELL',
        confidence: Math.min(1, Math.abs(currentHistogram) / (Math.abs(last(line)) || 1)),
        reason: 'MACD cắt xuống dưới đường tín hiệu',
        indicators,
      };
    }

    return { ...HOLD('MACD chưa cắt đường tín hiệu'), indicators };
  },
};

// ─────────────────────────────────────────────────────────────
// EMA cross
// ─────────────────────────────────────────────────────────────
const emaCross: StrategyDefinition = {
  key: 'ema-cross',
  name: 'EMA Cross (Golden/Death Cross)',
  description:
    'Mua khi EMA ngắn cắt lên EMA dài, bán khi cắt xuống. Chiến lược theo xu hướng kinh điển.',
  category: 'trend',
  minCandles: 250,
  requiredCandles: (p) => num(p, 'slowPeriod') + 20,
  params: [
    { key: 'fastPeriod', label: 'EMA ngắn', type: 'number', default: 50, min: 2, max: 200, unit: 'bars' },
    { key: 'slowPeriod', label: 'EMA dài', type: 'number', default: 200, min: 3, max: 500, unit: 'bars' },
    {
      key: 'volumeFilter',
      label: 'Lọc theo khối lượng',
      type: 'boolean',
      default: false,
      help: 'Chỉ vào lệnh khi khối lượng nến hiện tại cao hơn trung bình 20 nến.',
    },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params) => {
    const fastPeriod = num(params, 'fastPeriod');
    const slowPeriod = num(params, 'slowPeriod');
    if (fastPeriod >= slowPeriod) return HOLD('EMA ngắn phải nhỏ hơn EMA dài');

    const price = closes(candles);
    const fast = ema(price, fastPeriod);
    const slow = ema(price, slowPeriod);

    if (Number.isNaN(last(slow))) return HOLD('Chưa đủ nến để tính EMA dài');

    const indicators = { emaFast: last(fast), emaSlow: last(slow) };

    if (bool(params, 'volumeFilter')) {
      const vol = volumes(candles);
      const average = last(sma(vol, 20));
      if (!Number.isNaN(average) && last(vol) < average) {
        return { ...HOLD('Khối lượng thấp hơn trung bình, bỏ qua tín hiệu'), indicators };
      }
    }

    const spread = Math.abs(last(fast) - last(slow)) / last(slow);

    if (crossedAbove(fast, slow)) {
      return {
        action: 'BUY',
        confidence: confidenceFrom(spread, 0.02),
        reason: `EMA${fastPeriod} cắt lên EMA${slowPeriod}`,
        indicators,
      };
    }
    if (crossedBelow(fast, slow)) {
      return {
        action: 'SELL',
        confidence: confidenceFrom(spread, 0.02),
        reason: `EMA${fastPeriod} cắt xuống EMA${slowPeriod}`,
        indicators,
      };
    }

    return { ...HOLD('Hai đường EMA chưa cắt nhau'), indicators };
  },
};

// ─────────────────────────────────────────────────────────────
// Bollinger Bands mean reversion
// ─────────────────────────────────────────────────────────────
const bollingerReversion: StrategyDefinition = {
  key: 'bollinger-reversion',
  name: 'Bollinger Bands Reversion',
  description:
    'Mua khi giá chạm dải dưới, bán khi chạm dải trên. Kỳ vọng giá quay về đường trung bình.',
  category: 'mean-reversion',
  minCandles: 40,
  requiredCandles: (p) => num(p, 'period') * 2,
  params: [
    { key: 'period', label: 'Chu kỳ', type: 'number', default: 20, min: 5, max: 100, unit: 'bars' },
    {
      key: 'multiplier',
      label: 'Hệ số độ lệch chuẩn',
      type: 'number',
      default: 2,
      min: 0.5,
      max: 5,
      step: 0.1,
      help: 'Dải càng rộng thì tín hiệu càng hiếm nhưng càng chắc.',
    },
    {
      key: 'exitAtMiddle',
      label: 'Thoát tại đường giữa',
      type: 'boolean',
      default: true,
      help: 'Bán ra khi giá quay lại đường trung bình thay vì đợi chạm dải đối diện.',
    },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params) => {
    const price = closes(candles);
    const { upper, middle, lower } = bollinger(
      price,
      num(params, 'period'),
      num(params, 'multiplier'),
    );

    const current = last(price);
    if (Number.isNaN(last(middle))) return HOLD('Chưa đủ dữ liệu để tính Bollinger');

    const indicators = { upper: last(upper), middle: last(middle), lower: last(lower), price: current };
    const width = last(upper) - last(lower);

    if (current <= last(lower)) {
      return {
        action: 'BUY',
        confidence: confidenceFrom(last(lower) - current, width / 4),
        reason: 'Giá chạm dải Bollinger dưới',
        indicators,
      };
    }

    if (current >= last(upper)) {
      return {
        action: 'SELL',
        confidence: confidenceFrom(current - last(upper), width / 4),
        reason: 'Giá chạm dải Bollinger trên',
        indicators,
      };
    }

    if (bool(params, 'exitAtMiddle') && crossedAbove(price, middle)) {
      return {
        action: 'SELL',
        confidence: 0.3,
        reason: 'Giá quay lại đường trung bình',
        indicators,
      };
    }

    return { ...HOLD('Giá nằm trong dải Bollinger'), indicators };
  },
};

// ─────────────────────────────────────────────────────────────
// Stochastic oscillator
// ─────────────────────────────────────────────────────────────
const stochasticCross: StrategyDefinition = {
  key: 'stochastic-cross',
  name: 'Stochastic Oscillator',
  description:
    'Vào lệnh khi %K cắt %D trong vùng quá mua/quá bán. Nhạy hơn RSI, hợp khung thời gian ngắn.',
  category: 'momentum',
  minCandles: 40,
  requiredCandles: (p) => num(p, 'period') + num(p, 'smoothing') * 3,
  params: [
    { key: 'period', label: 'Chu kỳ %K', type: 'number', default: 14, min: 2, max: 100, unit: 'bars' },
    { key: 'smoothing', label: 'Làm mượt %D', type: 'number', default: 3, min: 1, max: 20, unit: 'bars' },
    { key: 'oversold', label: 'Ngưỡng quá bán', type: 'number', default: 20, min: 1, max: 49 },
    { key: 'overbought', label: 'Ngưỡng quá mua', type: 'number', default: 80, min: 51, max: 99 },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params) => {
    const { k, d } = stochastic(
      candles,
      num(params, 'period'),
      num(params, 'smoothing'),
    );

    if (Number.isNaN(last(d))) return HOLD('Chưa đủ dữ liệu để tính Stochastic');

    const indicators = { k: last(k), d: last(d) };
    const oversold = num(params, 'oversold');
    const overbought = num(params, 'overbought');

    if (last(k) < oversold && crossedAbove(k, d)) {
      return {
        action: 'BUY',
        confidence: confidenceFrom(oversold - last(k), oversold),
        reason: `%K cắt lên %D trong vùng quá bán (${last(k).toFixed(1)})`,
        indicators,
      };
    }

    if (last(k) > overbought && crossedBelow(k, d)) {
      return {
        action: 'SELL',
        confidence: confidenceFrom(last(k) - overbought, 100 - overbought),
        reason: `%K cắt xuống %D trong vùng quá mua (${last(k).toFixed(1)})`,
        indicators,
      };
    }

    return { ...HOLD('Stochastic chưa cho tín hiệu'), indicators };
  },
};

// ─────────────────────────────────────────────────────────────
// Donchian breakout
// ─────────────────────────────────────────────────────────────
const donchianBreakout: StrategyDefinition = {
  key: 'donchian-breakout',
  name: 'Donchian Breakout',
  description:
    'Mua khi giá phá đỉnh N nến gần nhất, bán khi thủng đáy. Chiến lược turtle trading cổ điển.',
  category: 'breakout',
  minCandles: 60,
  requiredCandles: (p) => Math.max(num(p, 'period'), num(p, 'atrPeriod')) + 5,
  params: [
    {
      key: 'period',
      label: 'Số nến tham chiếu',
      type: 'number',
      default: 20,
      min: 3,
      max: 200,
      unit: 'bars',
      help: 'Đỉnh/đáy được lấy trong khoảng này.',
    },
    {
      key: 'atrFilter',
      label: 'Lọc theo biến động (ATR)',
      type: 'boolean',
      default: true,
      help: 'Bỏ qua khi biên độ quá hẹp — phá vỡ trong thị trường im lìm thường là tín hiệu giả.',
    },
    { key: 'atrPeriod', label: 'Chu kỳ ATR', type: 'number', default: 14, min: 2, max: 100, unit: 'bars' },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params) => {
    const period = num(params, 'period');
    if (candles.length < period + 2) return HOLD('Chưa đủ nến để xác định kênh giá');

    // The breakout must be measured against the window *before* the current bar,
    // otherwise the current high defines the level it is supposed to break.
    const window = candles.slice(-period - 1, -1);
    const upper = Math.max(...highs(window));
    const lower = Math.min(...lows(window));
    const price = Number(last(candles).close);
    const indicators = { upper, lower, price };

    if (bool(params, 'atrFilter')) {
      const range = last(atr(candles, num(params, 'atrPeriod')));
      if (!Number.isNaN(range) && upper - lower < range) {
        return { ...HOLD('Biên độ kênh giá quá hẹp so với ATR'), indicators };
      }
    }

    if (price > upper) {
      return {
        action: 'BUY',
        confidence: confidenceFrom((price - upper) / upper, 0.01),
        reason: `Giá phá đỉnh ${period} nến (${upper.toFixed(2)})`,
        indicators,
      };
    }
    if (price < lower) {
      return {
        action: 'SELL',
        confidence: confidenceFrom((lower - price) / lower, 0.01),
        reason: `Giá thủng đáy ${period} nến (${lower.toFixed(2)})`,
        indicators,
      };
    }

    return { ...HOLD('Giá vẫn trong kênh'), indicators };
  },
};

// ─────────────────────────────────────────────────────────────
// Supertrend
// ─────────────────────────────────────────────────────────────
const supertrend: StrategyDefinition = {
  key: 'supertrend',
  name: 'Supertrend (ATR)',
  description:
    'Đường xu hướng bám theo biến động ATR. Đảo chiều tín hiệu khi giá cắt qua đường này.',
  category: 'trend',
  minCandles: 60,
  requiredCandles: (p) => num(p, 'atrPeriod') * 3,
  params: [
    { key: 'atrPeriod', label: 'Chu kỳ ATR', type: 'number', default: 10, min: 2, max: 100, unit: 'bars' },
    {
      key: 'multiplier',
      label: 'Hệ số ATR',
      type: 'number',
      default: 3,
      min: 0.5,
      max: 10,
      step: 0.1,
      unit: 'x',
      help: 'Hệ số càng lớn thì đường càng xa giá, ít tín hiệu giả nhưng vào lệnh muộn.',
    },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params) => {
    const range = atr(candles, num(params, 'atrPeriod'));
    if (Number.isNaN(last(range))) return HOLD('Chưa đủ dữ liệu để tính ATR');

    const multiplier = num(params, 'multiplier');
    const bandFor = (i: number) => {
      const mid = (Number(candles[i].high) + Number(candles[i].low)) / 2;
      return { upper: mid + multiplier * range[i], lower: mid - multiplier * range[i] };
    };

    const currentIndex = candles.length - 1;
    const current = bandFor(currentIndex);
    const previous = bandFor(currentIndex - 1);
    const price = Number(candles[currentIndex].close);
    const priorPrice = Number(candles[currentIndex - 1].close);
    const indicators = { upper: current.upper, lower: current.lower, price };

    if (priorPrice <= previous.upper && price > current.upper) {
      return {
        action: 'BUY',
        confidence: 0.7,
        reason: 'Giá vượt lên trên dải Supertrend',
        indicators,
      };
    }
    if (priorPrice >= previous.lower && price < current.lower) {
      return {
        action: 'SELL',
        confidence: 0.7,
        reason: 'Giá xuyên xuống dưới dải Supertrend',
        indicators,
      };
    }

    return { ...HOLD('Xu hướng chưa đảo chiều'), indicators };
  },
};

// ─────────────────────────────────────────────────────────────
// Grid DCA
// ─────────────────────────────────────────────────────────────
const gridDca: StrategyDefinition = {
  key: 'grid-dca',
  name: 'Grid / DCA',
  description:
    'Mua thêm mỗi khi giá giảm một mức nhất định so với đỉnh gần nhất, chốt lời khi hồi. Không dự đoán hướng.',
  category: 'mean-reversion',
  minCandles: 30,
  requiredCandles: (p) => num(p, 'lookback') + 5,
  params: [
    {
      key: 'stepPercent',
      label: 'Bước lưới',
      type: 'number',
      default: 2,
      min: 0.1,
      max: 50,
      step: 0.1,
      unit: '%',
      help: 'Giá giảm bao nhiêu phần trăm thì mua thêm một lần.',
    },
    {
      key: 'maxLevels',
      label: 'Số lần mua tối đa',
      type: 'number',
      default: 5,
      min: 1,
      max: 50,
      help: 'Giới hạn số lần DCA để vốn không cạn khi giá giảm sâu.',
    },
    {
      key: 'lookback',
      label: 'Cửa sổ tìm đỉnh',
      type: 'number',
      default: 20,
      min: 3,
      max: 200,
      unit: 'bars',
    },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params) => {
    const lookback = num(params, 'lookback');
    if (candles.length < lookback) return HOLD('Chưa đủ nến để xác định đỉnh gần nhất');

    const window = candles.slice(-lookback);
    const peak = Math.max(...highs(window));
    const price = Number(last(candles).close);
    const dropPercent = ((peak - price) / peak) * 100;
    const step = num(params, 'stepPercent');
    const indicators = { peak, price, dropPercent };

    if (dropPercent >= step) {
      const level = Math.min(
        Math.floor(dropPercent / step),
        num(params, 'maxLevels'),
      );
      return {
        action: 'BUY',
        confidence: confidenceFrom(level, num(params, 'maxLevels')),
        reason: `Giá giảm ${dropPercent.toFixed(2)}% từ đỉnh — mua mức ${level}`,
        indicators: { ...indicators, level },
      };
    }

    return { ...HOLD(`Giá mới giảm ${dropPercent.toFixed(2)}% từ đỉnh`), indicators };
  },
};

export const STRATEGY_LIBRARY: StrategyDefinition[] = [
  rsiReversal,
  macdCross,
  emaCross,
  bollingerReversion,
  stochasticCross,
  donchianBreakout,
  supertrend,
  gridDca,
];

export type { Candle, Signal };
