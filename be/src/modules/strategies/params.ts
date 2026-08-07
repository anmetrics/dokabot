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
];
