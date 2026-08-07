import { Candle } from '../../exchange/exchange.types';
import {
  adx,
  atr,
  bollinger,
  cci,
  closes,
  ema,
  ichimoku,
  keltner,
  macd,
  mfi,
  obv,
  psar,
  roc,
  rsi,
  sma,
  stochastic,
  vwap,
  williamsR,
} from './indicators';

/**
 * Every indicator a rule can reference, with the periods it accepts.
 *
 * `outputs` matters: an indicator like MACD or Bollinger is several series, and a
 * rule has to say which one it means.
 */
export type IndicatorName =
  | 'RSI'
  | 'MACD'
  | 'EMA'
  | 'SMA'
  | 'BOLLINGER'
  | 'STOCHASTIC'
  | 'ATR'
  | 'ADX'
  | 'CCI'
  | 'WILLIAMS_R'
  | 'MFI'
  | 'ROC'
  | 'OBV'
  | 'VWAP'
  | 'KELTNER'
  | 'PSAR'
  | 'ICHIMOKU'
  | 'VOLUME';

export type IndicatorMeta = {
  name: IndicatorName;
  label: string;
  /** What the numbers mean, so the UI can explain rather than just list. */
  description: string;
  /** Bounded oscillators can offer sensible thresholds in the UI. */
  range?: [number, number];
  outputs: { key: string; label: string }[];
  params: { key: string; label: string; default: number; min: number; max: number }[];
};

export const INDICATORS: IndicatorMeta[] = [
  {
    name: 'RSI',
    label: 'RSI',
    description:
      'Tốc độ và độ lớn của biến động giá, 0–100. Dưới 30 thường coi là quá bán, trên 70 là quá mua.',
    range: [0, 100],
    outputs: [{ key: 'value', label: 'RSI' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 14, min: 2, max: 200 }],
  },
  {
    name: 'MACD',
    label: 'MACD',
    description:
      'Hiệu hai đường EMA, so với đường tín hiệu. Histogram đổi dấu là tín hiệu động lượng đảo chiều.',
    outputs: [
      { key: 'macd', label: 'Đường MACD' },
      { key: 'signal', label: 'Đường tín hiệu' },
      { key: 'histogram', label: 'Histogram' },
    ],
    params: [
      { key: 'fastPeriod', label: 'EMA nhanh', default: 12, min: 2, max: 100 },
      { key: 'slowPeriod', label: 'EMA chậm', default: 26, min: 3, max: 200 },
      { key: 'signalPeriod', label: 'Tín hiệu', default: 9, min: 2, max: 50 },
    ],
  },
  {
    name: 'EMA',
    label: 'EMA',
    description: 'Trung bình động hàm mũ — phản ứng nhanh hơn SMA với giá mới.',
    outputs: [{ key: 'value', label: 'EMA' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 20, min: 2, max: 500 }],
  },
  {
    name: 'SMA',
    label: 'SMA',
    description: 'Trung bình động đơn giản.',
    outputs: [{ key: 'value', label: 'SMA' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 20, min: 2, max: 500 }],
  },
  {
    name: 'BOLLINGER',
    label: 'Bollinger Bands',
    description:
      'Dải độ lệch chuẩn quanh SMA. Dải thắt lại báo hiệu biến động sắp tăng.',
    outputs: [
      { key: 'upper', label: 'Dải trên' },
      { key: 'middle', label: 'Đường giữa' },
      { key: 'lower', label: 'Dải dưới' },
      { key: 'width', label: 'Độ rộng dải (%)' },
    ],
    params: [
      { key: 'period', label: 'Chu kỳ', default: 20, min: 5, max: 200 },
      { key: 'multiplier', label: 'Hệ số', default: 2, min: 0.5, max: 5 },
    ],
  },
  {
    name: 'STOCHASTIC',
    label: 'Stochastic',
    description: 'Vị trí giá đóng cửa trong biên độ N nến, 0–100.',
    range: [0, 100],
    outputs: [
      { key: 'k', label: '%K' },
      { key: 'd', label: '%D' },
    ],
    params: [
      { key: 'period', label: 'Chu kỳ %K', default: 14, min: 2, max: 200 },
      { key: 'smoothing', label: 'Làm mượt %D', default: 3, min: 1, max: 50 },
    ],
  },
  {
    name: 'ATR',
    label: 'ATR',
    description:
      'Biên độ thật trung bình — thước đo biến động tuyệt đối, dùng để đặt stop theo độ biến động.',
    outputs: [{ key: 'value', label: 'ATR' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 14, min: 2, max: 200 }],
  },
  {
    name: 'ADX',
    label: 'ADX / DMI',
    description:
      'ADX đo ĐỘ MẠNH của xu hướng chứ không đo hướng. Trên 25 là có xu hướng rõ. Hướng đọc từ +DI và −DI.',
    range: [0, 100],
    outputs: [
      { key: 'adx', label: 'ADX' },
      { key: 'plusDI', label: '+DI' },
      { key: 'minusDI', label: '−DI' },
    ],
    params: [{ key: 'period', label: 'Chu kỳ', default: 14, min: 2, max: 100 }],
  },
  {
    name: 'CCI',
    label: 'CCI',
    description: 'Độ lệch của giá so với trung bình. Ngoài ±100 thường coi là cực đoan.',
    outputs: [{ key: 'value', label: 'CCI' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 20, min: 2, max: 200 }],
  },
  {
    name: 'WILLIAMS_R',
    label: 'Williams %R',
    description: 'Như Stochastic nhưng thang −100…0. Dưới −80 là quá bán.',
    range: [-100, 0],
    outputs: [{ key: 'value', label: '%R' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 14, min: 2, max: 200 }],
  },
  {
    name: 'MFI',
    label: 'Money Flow Index',
    description:
      'RSI có trọng số khối lượng. Giá tạo đỉnh mới mà MFI không theo là phân kỳ đáng ngờ.',
    range: [0, 100],
    outputs: [{ key: 'value', label: 'MFI' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 14, min: 2, max: 200 }],
  },
  {
    name: 'ROC',
    label: 'Rate of Change',
    description: 'Phần trăm thay đổi giá so với N nến trước.',
    outputs: [{ key: 'value', label: 'ROC (%)' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 10, min: 1, max: 200 }],
  },
  {
    name: 'OBV',
    label: 'On-Balance Volume',
    description: 'Cộng dồn khối lượng theo hướng giá. Chỉ đọc độ dốc, không đọc giá trị tuyệt đối.',
    outputs: [{ key: 'value', label: 'OBV' }],
    params: [],
  },
  {
    name: 'VWAP',
    label: 'VWAP (rolling)',
    description:
      'Giá trung bình theo khối lượng trong N nến. Giá trên VWAP thường được coi là phe mua kiểm soát.',
    outputs: [{ key: 'value', label: 'VWAP' }],
    params: [{ key: 'period', label: 'Chu kỳ', default: 20, min: 2, max: 500 }],
  },
  {
    name: 'KELTNER',
    label: 'Keltner Channels',
    description: 'Kênh quanh EMA, độ rộng theo ATR. Ít nhiễu hơn Bollinger khi thị trường có xu hướng.',
    outputs: [
      { key: 'upper', label: 'Kênh trên' },
      { key: 'middle', label: 'Đường giữa' },
      { key: 'lower', label: 'Kênh dưới' },
    ],
    params: [
      { key: 'period', label: 'Chu kỳ', default: 20, min: 2, max: 200 },
      { key: 'multiplier', label: 'Hệ số ATR', default: 2, min: 0.5, max: 10 },
    ],
  },
  {
    name: 'PSAR',
    label: 'Parabolic SAR',
    description: 'Điểm dừng và đảo chiều. Giá cắt qua SAR là tín hiệu đổi hướng.',
    outputs: [{ key: 'value', label: 'SAR' }],
    params: [],
  },
  {
    name: 'ICHIMOKU',
    label: 'Ichimoku',
    description:
      'Tenkan cắt Kijun là tín hiệu kinh điển; giá so với mây (Span A/B) cho bối cảnh xu hướng.',
    outputs: [
      { key: 'conversion', label: 'Tenkan-sen' },
      { key: 'base', label: 'Kijun-sen' },
      { key: 'spanA', label: 'Senkou Span A' },
      { key: 'spanB', label: 'Senkou Span B' },
    ],
    params: [
      { key: 'conversionPeriod', label: 'Tenkan', default: 9, min: 2, max: 100 },
      { key: 'basePeriod', label: 'Kijun', default: 26, min: 2, max: 200 },
      { key: 'spanPeriod', label: 'Senkou B', default: 52, min: 2, max: 400 },
    ],
  },
  {
    name: 'VOLUME',
    label: 'Khối lượng',
    description: 'Khối lượng nến hiện tại, hoặc trung bình N nến.',
    outputs: [
      { key: 'value', label: 'Khối lượng' },
      { key: 'average', label: 'Trung bình' },
    ],
    params: [{ key: 'period', label: 'Chu kỳ trung bình', default: 20, min: 1, max: 500 }],
  },
];

export const INDICATOR_BY_NAME = new Map(INDICATORS.map((i) => [i.name, i]));

// ── Rule shapes ──

export type Operand =
  | {
      type: 'indicator';
      name: IndicatorName;
      output?: string;
      params?: Record<string, number>;
    }
  | { type: 'price'; source?: 'open' | 'high' | 'low' | 'close' }
  | { type: 'constant'; value: number };

export type ComparisonOperator =
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'crossesAbove'
  | 'crossesBelow'
  | 'between'
  | 'outside';

export type Condition = {
  left: Operand;
  operator: ComparisonOperator;
  right: Operand;
  /** Upper bound for `between` / `outside`. */
  right2?: Operand;
};

export type RuleGroup = {
  logic: 'AND' | 'OR';
  conditions: Condition[];
};

export type ConditionResult = {
  passed: boolean;
  /** Readable rendering of what was compared, for the signal's reason string. */
  detail: string;
};

const NUMERIC_TOLERANCE = 1e-12;

/** Resolves an operand to its full series, so cross operators have history. */
function resolveSeries(operand: Operand, candles: Candle[]): number[] {
  switch (operand.type) {
    case 'constant':
      return new Array<number>(candles.length).fill(operand.value);

    case 'price': {
      const source = operand.source ?? 'close';
      return candles.map((c) => Number(c[source]));
    }

    case 'indicator':
      return resolveIndicator(operand, candles);
  }
}

function resolveIndicator(
  operand: Extract<Operand, { type: 'indicator' }>,
  candles: Candle[],
): number[] {
  const meta = INDICATOR_BY_NAME.get(operand.name);
  if (!meta) throw new Error(`Chỉ báo không tồn tại: ${operand.name}`);

  // Defaults fill any parameter the rule did not pin down.
  const params: Record<string, number> = {};
  for (const spec of meta.params) {
    const raw = operand.params?.[spec.key];
    const value = raw === undefined ? spec.default : Number(raw);
    if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
      throw new Error(
        `${meta.label}: "${spec.label}" phải trong khoảng ${spec.min}–${spec.max}`,
      );
    }
    params[spec.key] = value;
  }

  const output = operand.output ?? meta.outputs[0].key;
  if (!meta.outputs.some((o) => o.key === output)) {
    throw new Error(`${meta.label} không có giá trị "${output}"`);
  }

  const price = closes(candles);

  switch (operand.name) {
    case 'RSI':
      return rsi(price, params.period);
    case 'EMA':
      return ema(price, params.period);
    case 'SMA':
      return sma(price, params.period);
    case 'ATR':
      return atr(candles, params.period);
    case 'CCI':
      return cci(candles, params.period);
    case 'WILLIAMS_R':
      return williamsR(candles, params.period);
    case 'MFI':
      return mfi(candles, params.period);
    case 'ROC':
      return roc(price, params.period);
    case 'OBV':
      return obv(candles);
    case 'VWAP':
      return vwap(candles, params.period);
    case 'PSAR':
      return psar(candles);

    case 'MACD': {
      const result = macd(
        price,
        params.fastPeriod,
        params.slowPeriod,
        params.signalPeriod,
      );
      return result[output as 'macd' | 'signal' | 'histogram'];
    }

    case 'BOLLINGER': {
      const bands = bollinger(price, params.period, params.multiplier);
      if (output === 'width') {
        // Expressed as a percentage of the centre line so it is comparable across
        // assets priced in completely different magnitudes.
        return bands.middle.map((mid, i) =>
          mid === 0 || Number.isNaN(mid)
            ? NaN
            : ((bands.upper[i] - bands.lower[i]) / mid) * 100,
        );
      }
      return bands[output as 'upper' | 'middle' | 'lower'];
    }

    case 'STOCHASTIC': {
      const result = stochastic(candles, params.period, params.smoothing);
      return result[output as 'k' | 'd'];
    }

    case 'ADX': {
      const result = adx(candles, params.period);
      return result[output as 'adx' | 'plusDI' | 'minusDI'];
    }

    case 'KELTNER': {
      const channels = keltner(candles, params.period, params.multiplier);
      return channels[output as 'upper' | 'middle' | 'lower'];
    }

    case 'ICHIMOKU': {
      const lines = ichimoku(
        candles,
        params.conversionPeriod,
        params.basePeriod,
        params.spanPeriod,
      );
      return lines[output as 'conversion' | 'base' | 'spanA' | 'spanB'];
    }

    case 'VOLUME': {
      const volumes = candles.map((c) => Number(c.volume));
      return output === 'average' ? sma(volumes, params.period) : volumes;
    }
  }
}

function describe(operand: Operand): string {
  switch (operand.type) {
    case 'constant':
      return String(operand.value);
    case 'price':
      return `giá ${operand.source ?? 'close'}`;
    case 'indicator': {
      const meta = INDICATOR_BY_NAME.get(operand.name);
      const output = operand.output ?? meta?.outputs[0].key;
      const suffix =
        meta && meta.outputs.length > 1 && output ? `.${output}` : '';
      return `${meta?.label ?? operand.name}${suffix}`;
    }
  }
}

export function evaluateCondition(
  condition: Condition,
  candles: Candle[],
): ConditionResult {
  const left = resolveSeries(condition.left, candles);
  const right = resolveSeries(condition.right, candles);
  const i = candles.length - 1;

  const a = left[i];
  const b = right[i];
  const label = `${describe(condition.left)} ${a?.toFixed?.(2) ?? a}`;

  // An indicator still in its warm-up has no value; treating NaN as false keeps a
  // half-computed series from firing a trade.
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { passed: false, detail: `${describe(condition.left)} chưa đủ dữ liệu` };
  }

  switch (condition.operator) {
    case 'gt':
      return { passed: a > b, detail: `${label} > ${b.toFixed(2)}` };
    case 'gte':
      return { passed: a >= b, detail: `${label} ≥ ${b.toFixed(2)}` };
    case 'lt':
      return { passed: a < b, detail: `${label} < ${b.toFixed(2)}` };
    case 'lte':
      return { passed: a <= b, detail: `${label} ≤ ${b.toFixed(2)}` };

    case 'crossesAbove':
    case 'crossesBelow': {
      if (i < 1) return { passed: false, detail: 'chưa đủ nến để xét cắt nhau' };
      const prevA = left[i - 1];
      const prevB = right[i - 1];
      if (Number.isNaN(prevA) || Number.isNaN(prevB)) {
        return { passed: false, detail: `${describe(condition.left)} chưa đủ dữ liệu` };
      }
      const up = prevA <= prevB + NUMERIC_TOLERANCE && a > b;
      const down = prevA >= prevB - NUMERIC_TOLERANCE && a < b;
      const passed = condition.operator === 'crossesAbove' ? up : down;
      const word = condition.operator === 'crossesAbove' ? 'cắt lên' : 'cắt xuống';
      return {
        passed,
        detail: `${describe(condition.left)} ${word} ${describe(condition.right)}`,
      };
    }

    case 'between':
    case 'outside': {
      if (!condition.right2) {
        throw new Error('Điều kiện khoảng cần đủ hai cận');
      }
      const upper = resolveSeries(condition.right2, candles)[i];
      if (Number.isNaN(upper)) {
        return { passed: false, detail: 'cận trên chưa đủ dữ liệu' };
      }
      // Bounds given the wrong way round are a user slip, not a reason to never fire.
      const low = Math.min(b, upper);
      const high = Math.max(b, upper);
      const inside = a >= low && a <= high;
      const passed = condition.operator === 'between' ? inside : !inside;
      const word = condition.operator === 'between' ? 'trong' : 'ngoài';
      return {
        passed,
        detail: `${label} ${word} [${low.toFixed(2)}, ${high.toFixed(2)}]`,
      };
    }
  }
}

export type RuleGroupResult = {
  passed: boolean;
  /** How many conditions held — used to scale the signal's confidence. */
  matched: number;
  total: number;
  details: string[];
};

export function evaluateGroup(
  group: RuleGroup,
  candles: Candle[],
): RuleGroupResult {
  if (!group.conditions.length) {
    return { passed: false, matched: 0, total: 0, details: ['Chưa có điều kiện nào'] };
  }

  const results = group.conditions.map((condition) =>
    evaluateCondition(condition, candles),
  );
  const matched = results.filter((r) => r.passed).length;

  return {
    passed:
      group.logic === 'AND' ? matched === results.length : matched > 0,
    matched,
    total: results.length,
    details: results.map((r) => r.detail),
  };
}

/** How much history a rule group needs before any of it can be true. */
export function requiredCandlesForGroup(group: RuleGroup): number {
  let required = 5;

  const consider = (operand: Operand) => {
    if (operand.type !== 'indicator') return;
    const meta = INDICATOR_BY_NAME.get(operand.name);
    if (!meta) return;
    for (const spec of meta.params) {
      const value = Number(operand.params?.[spec.key] ?? spec.default);
      // ADX needs two full smoothing passes; the ×3 headroom covers it and every
      // other Wilder-smoothed indicator.
      required = Math.max(required, value * 3);
    }
  };

  for (const condition of group.conditions ?? []) {
    consider(condition.left);
    consider(condition.right);
    if (condition.right2) consider(condition.right2);
  }

  return Math.ceil(required);
}
