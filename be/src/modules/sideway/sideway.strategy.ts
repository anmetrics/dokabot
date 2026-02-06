import { Injectable, Logger } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { TelegramService } from '../telegram/telegram.service';
import { SidewayService } from './sideway.service';
import { adjustToStepSize } from '../strategy/helpers/crypto';
import { SidewayScenario } from '../../../generated/prisma';

interface ScenarioStep {
  action: 'BUY' | 'SELL';
  price: number;
}

@Injectable()
export class SidewayStrategy {
  private logger = new Logger('SidewayStrategy');
  private subscriptions = new Map<string, () => void>(); // symbol -> unsubscribe
  private cooldownMap = new Map<string, number>(); // scenarioId -> lastExecutedTimestamp
  private readonly COOLDOWN_MS = 5000; // 5 second cooldown

  constructor(
    private readonly binanceService: BinanceService,
    private readonly sidewayService: SidewayService,
    private readonly telegramService: TelegramService,
  ) {}

  async start() {
    this.logger.log('Starting Sideway Strategy...');
    await this.refreshSubscriptions();

    // Periodically refresh subscriptions every 30 seconds
    setInterval(() => this.refreshSubscriptions(), 30_000);
  }

  async refreshSubscriptions() {
    try {
      const activeScenarios = await this.sidewayService.getActiveScenarios();
      const activeSymbols = new Set(activeScenarios.map((s) => s.symbol));

      // Unsubscribe symbols that no longer have active scenarios
      for (const [symbol, unsub] of this.subscriptions.entries()) {
        if (!activeSymbols.has(symbol)) {
          this.logger.log(`Unsubscribing from ${symbol} (no active scenarios)`);
          unsub();
          this.subscriptions.delete(symbol);
        }
      }

      // Subscribe to new symbols
      for (const symbol of activeSymbols) {
        if (!this.subscriptions.has(symbol)) {
          this.logger.log(`Subscribing to ${symbol} aggTrades`);
          const unsub = this.binanceService.subscribeAggTrades(
            symbol,
            (trade) => this.onTrade(symbol, parseFloat(trade.price)),
          );
          this.subscriptions.set(symbol, unsub);
        }
      }

      if (activeScenarios.length > 0) {
        this.logger.log(
          `Active scenarios: ${activeScenarios.length} | Symbols: ${[...activeSymbols].join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error(`refreshSubscriptions error: ${err}`);
    }
  }

  private async onTrade(symbol: string, price: number) {
    try {
      const scenarios = await this.sidewayService.getActiveScenarios();
      const symbolScenarios = scenarios.filter(
        (s) => s.symbol === symbol && s.enabled,
      );

      for (const scenario of symbolScenarios) {
        await this.checkAndExecute(scenario, price);
      }
    } catch (err) {
      this.logger.error(`onTrade error for ${symbol}: ${err}`);
    }
  }

  private async checkAndExecute(scenario: SidewayScenario, currentPrice: number) {
    const steps = scenario.steps as unknown as ScenarioStep[];
    if (!steps || steps.length === 0) return;

    const stepIndex = scenario.currentStepIndex;
    if (stepIndex >= steps.length) return;

    const step = steps[stepIndex];

    // Check cooldown
    const lastExec = this.cooldownMap.get(scenario.id) || 0;
    if (Date.now() - lastExec < this.COOLDOWN_MS) return;

    // Check if trigger condition is met
    let triggered = false;
    if (step.action === 'SELL' && currentPrice >= step.price) {
      triggered = true;
    } else if (step.action === 'BUY' && currentPrice <= step.price) {
      triggered = true;
    }

    if (!triggered) return;

    // Set cooldown immediately
    this.cooldownMap.set(scenario.id, Date.now());

    this.logger.log(
      `[${scenario.name}] Step ${stepIndex + 1}/${steps.length}: ${step.action} at ${currentPrice} (target: ${step.price})`,
    );

    try {
      const qty = adjustToStepSize(scenario.qty, scenario.symbol);
      const side = step.action as 'BUY' | 'SELL';

      const order = await this.binanceService.placeMarketOrder(
        scenario.symbol,
        side,
        qty,
      );

      this.logger.log(
        `[${scenario.name}] Order executed: ${side} ${qty} ${scenario.symbol} @ ~${currentPrice}`,
      );

      // Send Telegram notification
      const msg = `📊 Sideway: ${scenario.name}\n${side === 'BUY' ? '🟢 MUA' : '🔴 BÁN'} ${qty} ${scenario.symbol} @ ${currentPrice}\nBước ${stepIndex + 1}/${steps.length}`;
      this.telegramService.sendMessage(msg).catch(() => {});

      // Advance to next step
      const nextIndex = stepIndex + 1;

      if (nextIndex >= steps.length) {
        // All steps completed
        if (scenario.isLoop) {
          // Reset to beginning
          await this.sidewayService.advanceStep(scenario.id, 0);
          this.logger.log(
            `[${scenario.name}] Loop completed, resetting to step 1`,
          );
          const loopMsg = `🔄 Sideway: ${scenario.name}\nĐã hoàn thành 1 vòng, bắt đầu lại từ đầu.`;
          this.telegramService.sendMessage(loopMsg).catch(() => {});
        } else {
          // Complete scenario
          await this.sidewayService.completeScenario(scenario.id);
          this.logger.log(`[${scenario.name}] Scenario completed`);
          const doneMsg = `✅ Sideway: ${scenario.name}\nĐã hoàn thành tất cả các bước.`;
          this.telegramService.sendMessage(doneMsg).catch(() => {});
          // Refresh subscriptions to remove if no more active
          await this.refreshSubscriptions();
        }
      } else {
        await this.sidewayService.advanceStep(scenario.id, nextIndex);
        const nextStep = steps[nextIndex];
        this.logger.log(
          `[${scenario.name}] Next: ${nextStep.action} at ${nextStep.price}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[${scenario.name}] Execution error: ${JSON.stringify(err)}`,
      );
      await this.sidewayService.setError(scenario.id, String(err));
      const errMsg = `❌ Sideway: ${scenario.name}\nLỗi: ${String(err)}`;
      this.telegramService.sendMessage(errMsg).catch(() => {});
      await this.refreshSubscriptions();
    }
  }
}
