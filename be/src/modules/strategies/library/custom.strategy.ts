import { RISK_PARAMS } from '../params';
import {
  HOLD,
  RuleGroupValue,
  Signal,
  StrategyDefinition,
  StrategyParams,
} from '../strategy.types';
import { closes, last } from './indicators';
import {
  evaluateGroup,
  RuleGroup,
  requiredCandlesForGroup,
} from './rules';

const asGroup = (value: unknown): RuleGroup => {
  const group = value as RuleGroup | undefined;
  return {
    logic: group?.logic === 'OR' ? 'OR' : 'AND',
    conditions: Array.isArray(group?.conditions) ? group.conditions : [],
  };
};

const DEFAULT_ENTRY: RuleGroupValue = {
  logic: 'AND',
  conditions: [
    {
      left: { type: 'indicator', name: 'RSI', params: { period: 14 } },
      operator: 'lt',
      right: { type: 'constant', value: 30 },
    },
  ],
};

const DEFAULT_EXIT: RuleGroupValue = {
  logic: 'OR',
  conditions: [
    {
      left: { type: 'indicator', name: 'RSI', params: { period: 14 } },
      operator: 'gt',
      right: { type: 'constant', value: 70 },
    },
  ],
};

/**
 * A strategy the user composes themselves.
 *
 * Entry and exit are independent condition groups, so "buy when RSI is oversold
 * AND ADX confirms a trend" and "sell when either MACD turns down OR price hits
 * the upper band" are both expressible. Everything the built-in strategies do can
 * be rebuilt here — they exist as presets, not as a privileged path.
 */
export const customRules: StrategyDefinition = {
  key: 'custom-rules',
  name: 'Tự thiết kế (Rule Builder)',
  description:
    'Bạn tự chọn chỉ báo và điều kiện vào/ra lệnh. Ghép nhiều điều kiện bằng AND hoặc OR, kèm khoảng giá mua bán riêng.',
  category: 'momentum',
  minCandles: 60,
  requiredCandles: (params: StrategyParams) =>
    Math.max(
      requiredCandlesForGroup(asGroup(params.entryRules)),
      requiredCandlesForGroup(asGroup(params.exitRules)),
    ),
  params: [
    {
      key: 'entryRules',
      label: 'Điều kiện MUA',
      type: 'rules',
      default: DEFAULT_ENTRY,
      help: 'Tất cả (AND) hoặc bất kỳ (OR) điều kiện đúng thì vào lệnh.',
    },
    {
      key: 'exitRules',
      label: 'Điều kiện BÁN',
      type: 'rules',
      default: DEFAULT_EXIT,
      help: 'Ngoài chốt lời / cắt lỗ, đây là điều kiện thoát theo chỉ báo.',
    },
    ...RISK_PARAMS,
  ],
  evaluate: (candles, params): Signal => {
    const entry = asGroup(params.entryRules);
    const exit = asGroup(params.exitRules);
    const price = last(closes(candles));

    // Exit is checked first: a rule the user wrote to get out must not be shadowed
    // by an entry rule that happens to be true at the same moment.
    if (exit.conditions.length) {
      const result = evaluateGroup(exit, candles);
      if (result.passed) {
        return {
          action: 'SELL',
          confidence: result.total ? result.matched / result.total : 0.5,
          reason: `Điều kiện bán khớp: ${result.details.join(' · ')}`,
          indicators: { price },
        };
      }
    }

    if (entry.conditions.length) {
      const result = evaluateGroup(entry, candles);
      if (result.passed) {
        return {
          action: 'BUY',
          confidence: result.total ? result.matched / result.total : 0.5,
          reason: `Điều kiện mua khớp: ${result.details.join(' · ')}`,
          indicators: { price },
        };
      }
      return {
        ...HOLD(`Chưa khớp (${result.matched}/${result.total}): ${result.details.join(' · ')}`),
        indicators: { price },
      };
    }

    return HOLD('Chưa cấu hình điều kiện nào');
  },
};
