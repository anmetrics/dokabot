import { BadRequestException, Injectable } from '@nestjs/common';
import { Candle } from '../exchange/exchange.types';
import { STRATEGY_LIBRARY } from './library';
import { resolveParams } from './params';
import { Signal, StrategyDefinition } from './strategy.types';

/** Catalogue entry as exposed to clients — everything the UI needs to render a form. */
export type StrategyCatalogEntry = Omit<StrategyDefinition, 'evaluate'>;

@Injectable()
export class StrategyRegistry {
  private readonly strategies = new Map<string, StrategyDefinition>(
    STRATEGY_LIBRARY.map((strategy) => [strategy.key, strategy]),
  );

  /** Everything a client needs to build the settings form for every strategy. */
  catalog(): StrategyCatalogEntry[] {
    return [...this.strategies.values()].map(({ evaluate, ...rest }) => rest);
  }

  get(key: string): StrategyDefinition {
    const strategy = this.strategies.get(key);
    if (!strategy) {
      throw new BadRequestException(
        `Unknown strategy "${key}". Available: ${[...this.strategies.keys()].join(', ')}`,
      );
    }
    return strategy;
  }

  has(key: string): boolean {
    return this.strategies.has(key);
  }

  /** Validates user settings and fills in defaults. Throws on anything invalid. */
  validateConfig(key: string, config: Record<string, unknown> = {}) {
    return resolveParams(this.get(key).params, config);
  }

  /**
   * Runs a strategy over a candle series.
   *
   * Config is re-validated here rather than trusted from the database: a stored
   * bot may predate a change to the strategy's parameters.
   */
  evaluate(
    key: string,
    candles: Candle[],
    config: Record<string, unknown> = {},
  ): Signal {
    const strategy = this.get(key);
    const params = this.validateConfig(key, config);
    const required = this.requiredCandles(key, config);

    if (candles.length < required) {
      return {
        action: 'HOLD',
        confidence: 0,
        reason: `Cần ít nhất ${required} nến, hiện có ${candles.length}`,
      };
    }

    return strategy.evaluate(candles, params);
  }

  /** How much history this configuration actually needs. */
  requiredCandles(key: string, config: Record<string, unknown> = {}): number {
    const strategy = this.get(key);
    if (!strategy.requiredCandles) return strategy.minCandles;
    return Math.max(10, strategy.requiredCandles(this.validateConfig(key, config)));
  }
}
