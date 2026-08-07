/**
 * Auto-invest presets.
 *
 * The product promise is "flip one switch and the platform trades for you", so the
 * user picks a risk appetite, not a strategy. Each profile is a small portfolio of
 * bots chosen so the strategies disagree with each other — a trend follower and a
 * mean-reverter lose in opposite markets, which is the point.
 *
 * Budget is split by weight, never concentrated in one bot.
 */
export type RiskProfile = 'CONSERVATIVE' | 'BALANCED' | 'GROWTH';

export type PresetLeg = {
  symbol: string;
  strategyKey: string;
  timeframe: string;
  /** Share of the total budget, 0–1. Weights within a profile sum to 1. */
  weight: number;
  /** Overrides on top of the strategy's own defaults. */
  config: Record<string, number | boolean | string>;
};

export type Preset = {
  profile: RiskProfile;
  name: string;
  description: string;
  /** Expected drawdown band, shown to set expectations before the switch is flipped. */
  riskNote: string;
  /** Fraction of the budget the platform will stop the whole portfolio at. */
  maxDrawdownPercent: number;
  legs: PresetLeg[];
};

export const PRESETS: Record<RiskProfile, Preset> = {
  CONSERVATIVE: {
    profile: 'CONSERVATIVE',
    name: 'Thận trọng',
    description:
      'Chỉ BTC, khung dài, vào lệnh thưa. Ưu tiên giữ vốn hơn là bắt sóng.',
    riskNote: 'Ít lệnh, biến động thấp. Kỳ vọng lợi nhuận khiêm tốn.',
    maxDrawdownPercent: 10,
    legs: [
      {
        symbol: 'BTCUSDT',
        strategyKey: 'rsi-reversal',
        timeframe: '4h',
        weight: 0.6,
        config: {
          period: 14,
          oversold: 25,
          overbought: 75,
          takeProfitPercent: 3,
          stopLossPercent: 2,
        },
      },
      {
        symbol: 'BTCUSDT',
        strategyKey: 'ema-cross',
        timeframe: '1d',
        weight: 0.4,
        config: {
          fastPeriod: 20,
          slowPeriod: 50,
          takeProfitPercent: 5,
          stopLossPercent: 3,
        },
      },
    ],
  },

  BALANCED: {
    profile: 'BALANCED',
    name: 'Cân bằng',
    description:
      'BTC và BNB, kết hợp bắt xu hướng với hồi quy trung bình để hai chiến lược bù trừ nhau.',
    riskNote: 'Số lệnh vừa phải. Cân bằng giữa tăng trưởng và rủi ro.',
    maxDrawdownPercent: 15,
    legs: [
      {
        symbol: 'BTCUSDT',
        strategyKey: 'macd-cross',
        timeframe: '1h',
        weight: 0.3,
        config: { takeProfitPercent: 3, stopLossPercent: 2 },
      },
      {
        symbol: 'BTCUSDT',
        strategyKey: 'bollinger-reversion',
        timeframe: '1h',
        weight: 0.25,
        config: { period: 20, multiplier: 2, takeProfitPercent: 2.5, stopLossPercent: 2 },
      },
      {
        symbol: 'BNBUSDT',
        strategyKey: 'rsi-reversal',
        timeframe: '1h',
        weight: 0.25,
        config: { oversold: 30, overbought: 70, takeProfitPercent: 3, stopLossPercent: 2 },
      },
      {
        symbol: 'BNBUSDT',
        strategyKey: 'supertrend',
        timeframe: '4h',
        weight: 0.2,
        config: { atrPeriod: 10, multiplier: 3, takeProfitPercent: 4, stopLossPercent: 3 },
      },
    ],
  },

  GROWTH: {
    profile: 'GROWTH',
    name: 'Tăng trưởng',
    description:
      'Khung ngắn, bắt phá vỡ và động lượng. Nhiều lệnh hơn, biến động cao hơn.',
    riskNote: 'Nhiều lệnh, biến động cao. Chỉ dùng phần vốn bạn chấp nhận mất.',
    maxDrawdownPercent: 25,
    legs: [
      {
        symbol: 'BTCUSDT',
        strategyKey: 'donchian-breakout',
        timeframe: '15m',
        weight: 0.3,
        config: { period: 20, atrFilter: true, takeProfitPercent: 2, stopLossPercent: 1.5 },
      },
      {
        symbol: 'BTCUSDT',
        strategyKey: 'stochastic-cross',
        timeframe: '15m',
        weight: 0.2,
        config: { takeProfitPercent: 1.5, stopLossPercent: 1 },
      },
      {
        symbol: 'BNBUSDT',
        strategyKey: 'macd-cross',
        timeframe: '15m',
        weight: 0.25,
        config: { takeProfitPercent: 2, stopLossPercent: 1.5 },
      },
      {
        symbol: 'BNBUSDT',
        strategyKey: 'grid-dca',
        timeframe: '15m',
        weight: 0.25,
        config: { stepPercent: 1.5, maxLevels: 4, takeProfitPercent: 2, stopLossPercent: 8 },
      },
    ],
  },
};

export const PRESET_LIST = Object.values(PRESETS);
