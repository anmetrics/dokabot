import { BadRequestException } from '@nestjs/common';
import { ParamSpec, StrategyParams } from './strategy.types';

/**
 * Applies defaults and validates user-supplied settings against a strategy's spec.
 *
 * User config reaches this from an HTTP body, so nothing about it is trusted:
 * unknown keys are rejected rather than ignored, because a silently dropped
 * setting looks to the user like the platform obeyed them when it did not.
 */
export function resolveParams(
  specs: ParamSpec[],
  input: Record<string, unknown> = {},
): StrategyParams {
  const known = new Set(specs.map((s) => s.key));
  const unknown = Object.keys(input).filter((key) => !known.has(key));
  if (unknown.length) {
    throw new BadRequestException(
      `Unknown setting(s) for this strategy: ${unknown.join(', ')}`,
    );
  }

  const resolved: StrategyParams = {};

  for (const spec of specs) {
    const raw = input[spec.key];

    if (raw === undefined || raw === null || raw === '') {
      resolved[spec.key] = spec.default;
      continue;
    }

    switch (spec.type) {
      case 'number': {
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          throw new BadRequestException(`"${spec.label}" must be a number`);
        }
        if (value < spec.min || value > spec.max) {
          throw new BadRequestException(
            `"${spec.label}" must be between ${spec.min} and ${spec.max}`,
          );
        }
        resolved[spec.key] = value;
        break;
      }
      case 'boolean': {
        if (typeof raw !== 'boolean') {
          throw new BadRequestException(`"${spec.label}" must be true or false`);
        }
        resolved[spec.key] = raw;
        break;
      }
      case 'rules': {
        // Structure is validated by the rule engine, which knows the indicators;
        // here we only insist it is the right shape.
        const group = raw as { logic?: unknown; conditions?: unknown };
        if (
          typeof group !== 'object' ||
          group === null ||
          (group.logic !== 'AND' && group.logic !== 'OR') ||
          !Array.isArray(group.conditions)
        ) {
          throw new BadRequestException(
            `"${spec.label}" phải có dạng { logic: "AND" | "OR", conditions: [...] }`,
          );
        }
        resolved[spec.key] = raw as never;
        break;
      }

      case 'enum': {
        const allowed = spec.options.map((o) => o.value);
        if (typeof raw !== 'string' || !allowed.includes(raw)) {
          throw new BadRequestException(
            `"${spec.label}" must be one of: ${allowed.join(', ')}`,
          );
        }
        resolved[spec.key] = raw;
        break;
      }
    }
  }

  return resolved;
}

/**
 * Price guards every strategy obeys.
 *
 * Independent of the strategy's own logic on purpose: "never buy above X" is a
 * statement about the user's view of value, and it must hold even when the
 * indicators are screaming. Zero disables the bound.
 */
export const PRICE_BAND_PARAMS: ParamSpec[] = [
  {
    key: 'minBuyPrice',
    label: 'Chỉ mua khi giá từ',
    type: 'number',
    default: 0,
    min: 0,
    max: 100_000_000,
    unit: 'USD',
    help: '0 = không giới hạn cận dưới.',
  },
  {
    key: 'maxBuyPrice',
    label: 'Chỉ mua khi giá đến',
    type: 'number',
    default: 0,
    min: 0,
    max: 100_000_000,
    unit: 'USD',
    help: 'Không mua đuổi khi giá đã vượt mức này. 0 = không giới hạn.',
  },
  {
    key: 'minSellPrice',
    label: 'Chỉ bán khi giá từ',
    type: 'number',
    default: 0,
    min: 0,
    max: 100_000_000,
    unit: 'USD',
    help: 'Không bán dưới mức này — trừ khi lệnh cắt lỗ kích hoạt. 0 = không giới hạn.',
  },
  {
    key: 'maxSellPrice',
    label: 'Chỉ bán khi giá đến',
    type: 'number',
    default: 0,
    min: 0,
    max: 100_000_000,
    unit: 'USD',
    help: '0 = không giới hạn cận trên.',
  },
];

/** Shared risk controls every strategy gets, so the UI is consistent. */
export const RISK_PARAMS: ParamSpec[] = [
  {
    key: 'takeProfitPercent',
    label: 'Chốt lời',
    type: 'number',
    default: 2,
    min: 0.1,
    max: 100,
    step: 0.1,
    unit: '%',
    help: 'Đóng vị thế khi lãi đạt mức này.',
  },
  {
    key: 'stopLossPercent',
    label: 'Cắt lỗ',
    type: 'number',
    default: 1,
    min: 0.1,
    max: 100,
    step: 0.1,
    unit: '%',
    help: 'Đóng vị thế khi lỗ chạm mức này.',
  },
  {
    key: 'orderSizeUsd',
    label: 'Giá trị mỗi lệnh',
    type: 'number',
    default: 50,
    min: 5,
    max: 1_000_000,
    step: 5,
    unit: 'USD',
    help: 'Số tiền dùng cho mỗi lần vào lệnh.',
  },
  ...PRICE_BAND_PARAMS,
];

/**
 * Applies the price band to a proposed action.
 *
 * Returns null when the action is allowed, or the reason it was blocked.
 * Stop-loss exits are exempt: a floor on the sell price would turn a stop into a
 * position that can never be closed.
 */
export function priceBandBlock(
  params: StrategyParams,
  action: 'BUY' | 'SELL',
  price: number,
): string | null {
  const bound = (key: string): number => {
    const value = Number(params[key]);
    return Number.isFinite(value) ? value : 0;
  };

  if (action === 'BUY') {
    const min = bound('minBuyPrice');
    const max = bound('maxBuyPrice');
    if (min > 0 && price < min) {
      return `Giá ${price} dưới khoảng mua đã đặt (từ ${min})`;
    }
    if (max > 0 && price > max) {
      return `Giá ${price} vượt khoảng mua đã đặt (đến ${max})`;
    }
    return null;
  }

  const min = bound('minSellPrice');
  const max = bound('maxSellPrice');
  if (min > 0 && price < min) {
    return `Giá ${price} dưới khoảng bán đã đặt (từ ${min})`;
  }
  if (max > 0 && price > max) {
    return `Giá ${price} vượt khoảng bán đã đặt (đến ${max})`;
  }
  return null;
}
