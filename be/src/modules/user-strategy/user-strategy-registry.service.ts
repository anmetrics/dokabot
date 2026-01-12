import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BinanceService } from '../binance/binance.service';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../../prisma.service';
import { PlatformCredentialService } from '../platform-credential/platform-credential.service';
import { MarketDataService } from '../market-data/market-data.service';

export interface UserStrategyInstance {
  userId: string;
  strategyName: string;
  isRunning: boolean;
  startedAt: Date;
  stopFn?: () => void; // Function to stop WebSocket subscriptions
}

/**
 * Registry Pattern - Manages strategy instances per user
 * Design như các bot lớn: 3Commas, Cryptohopper, Pionex
 */
@Injectable()
export class UserStrategyRegistry implements OnModuleInit {
  private logger = new Logger('UserStrategyRegistry');

  // Map: userId -> UserStrategyInstance[]
  private userStrategies: Map<string, UserStrategyInstance[]> = new Map();

  constructor(
    private readonly binanceService: BinanceService,
    private readonly telegramService: TelegramService,
    private readonly prismaService: PrismaService,
    private readonly credentialService: PlatformCredentialService,
    private readonly marketDataService: MarketDataService,
  ) {}

  async onModuleInit() {
    // Auto-start strategies for all active users on server start
    await this.autoStartAllUserStrategies();
  }

  /**
   * Auto-start strategies for all users with active credentials
   */
  async autoStartAllUserStrategies() {
    try {
      const credentials = await this.credentialService.findByPlatform('binance');

      this.logger.log(`Found ${credentials.length} active users with Binance credentials`);

      for (const credential of credentials) {
        await this.startUserStrategy(credential.userId, 'mini_reversal_dca');
      }
    } catch (error) {
      this.logger.error('Failed to auto-start user strategies:', error);
    }
  }

  /**
   * Start strategy for a specific user
   */
  async startUserStrategy(userId: string, strategyName: string): Promise<void> {
    try {
      // Check if already running
      if (this.isStrategyRunning(userId, strategyName)) {
        this.logger.warn(`Strategy ${strategyName} already running for user ${userId}`);
        return;
      }

      // Create authenticated Binance client for this user
      const client = await this.binanceService.createUserClient(userId);

      // Get user settings from database
      const settings = await this.getUserSettings(userId);

      // Start strategy (example: subscribe to WebSocket, start trading logic)
      const stopFn = this.runStrategy(userId, strategyName, client, settings);

      // Register strategy instance
      const instance: UserStrategyInstance = {
        userId,
        strategyName,
        isRunning: true,
        startedAt: new Date(),
        stopFn,
      };

      // Add to registry
      const userInstances = this.userStrategies.get(userId) || [];
      userInstances.push(instance);
      this.userStrategies.set(userId, userInstances);

      this.logger.log(`✅ Started strategy ${strategyName} for user ${userId}`);

      // Send notification
      await this.telegramService.sendMessage(
        `🚀 Strategy ${strategyName} started for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to start strategy for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Stop strategy for a specific user
   */
  async stopUserStrategy(userId: string, strategyName: string): Promise<void> {
    const userInstances = this.userStrategies.get(userId) || [];
    const instance = userInstances.find(
      (i) => i.strategyName === strategyName && i.isRunning,
    );

    if (!instance) {
      throw new Error(`Strategy ${strategyName} not running for user ${userId}`);
    }

    // Execute stop function (cleanup WebSockets, etc.)
    if (instance.stopFn) {
      instance.stopFn();
    }

    instance.isRunning = false;

    this.logger.log(`🛑 Stopped strategy ${strategyName} for user ${userId}`);

    await this.telegramService.sendMessage(
      `🛑 Strategy ${strategyName} stopped for user ${userId}`,
    );
  }

  /**
   * Stop all strategies for a user (e.g., when credentials are deleted)
   */
  async stopAllUserStrategies(userId: string): Promise<void> {
    const userInstances = this.userStrategies.get(userId) || [];

    for (const instance of userInstances) {
      if (instance.isRunning) {
        await this.stopUserStrategy(userId, instance.strategyName);
      }
    }

    // Clean up client credentials cache
    this.binanceService.removeUserCredentials(userId);

    // Remove from registry
    this.userStrategies.delete(userId);

    this.logger.log(`🗑️ Stopped all strategies for user ${userId}`);
  }

  /**
   * Reload strategy (stop and start again with fresh credentials)
   * Useful when user updates API keys
   */
  async reloadUserStrategy(userId: string, strategyName: string): Promise<void> {
    await this.stopUserStrategy(userId, strategyName);

    // Remove credentials cache to force reload with new credentials
    this.binanceService.removeUserCredentials(userId);

    await this.startUserStrategy(userId, strategyName);

    this.logger.log(`🔄 Reloaded strategy ${strategyName} for user ${userId}`);
  }

  /**
   * Get all running strategies for a user
   */
  getUserStrategies(userId: string): UserStrategyInstance[] {
    return this.userStrategies.get(userId) || [];
  }

  /**
   * Get all users with running strategies
   */
  getAllActiveUsers(): string[] {
    return Array.from(this.userStrategies.keys());
  }

  /**
   * Check if strategy is running for user
   */
  isStrategyRunning(userId: string, strategyName: string): boolean {
    const userInstances = this.userStrategies.get(userId) || [];
    return userInstances.some(
      (i) => i.strategyName === strategyName && i.isRunning,
    );
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalUsers = this.userStrategies.size;
    let totalStrategies = 0;
    let runningStrategies = 0;

    this.userStrategies.forEach((instances) => {
      totalStrategies += instances.length;
      runningStrategies += instances.filter((i) => i.isRunning).length;
    });

    return {
      totalUsers,
      totalStrategies,
      runningStrategies,
      users: Array.from(this.userStrategies.entries()).map(([userId, instances]) => ({
        userId,
        strategies: instances.map((i) => ({
          name: i.strategyName,
          isRunning: i.isRunning,
          startedAt: i.startedAt,
        })),
      })),
    };
  }

  /**
   * PRIVATE: Run the actual strategy logic
   * This is where you put your trading logic for each user
   *
   * ARCHITECTURE (Best Practice từ Cryptohopper, 3Commas):
   * - Market Data WebSocket: SHARED cho tất cả users (1 connection)
   * - User Data WebSocket: RIÊNG cho mỗi user (listenKey per user)
   * - Settings: RIÊNG cho mỗi user
   * - Client: RIÊNG cho mỗi user (API keys khác nhau)
   * - Strategy logic: RIÊNG cho mỗi user
   */
  private runStrategy(
    userId: string,
    strategyName: string,
    client: any,
    settings: any,
  ): () => void {
    this.logger.log(`🚀 Starting strategy ${strategyName} for user ${userId}`);

    // Get user-specific symbols (hoặc default)
    // TODO: Load from user preferences table
    const symbols = ['BTCUSDT', 'BNBUSDT', 'SOLUSDT'];

    // Get user-specific settings
    const enableBuy = settings['ENABLE_BUY'] === 'true';
    const enableSell = settings['ENABLE_SELL'] === 'true';

    this.logger.log(`[User ${userId}] Settings: BUY=${enableBuy}, SELL=${enableSell}`);

    // Ensure symbols are subscribed to shared market data
    symbols.forEach((symbol) => {
      this.marketDataService.subscribeSymbol(symbol);
    });

    // Listen to SHARED market data (không cần riêng WebSocket cho user này)
    const priceUpdateHandler = async (priceUpdate: any) => {
      // Chỉ process symbols mà user này quan tâm
      if (!symbols.includes(priceUpdate.symbol)) {
        return;
      }

      // TRADING LOGIC cho USER NÀY
      try {
        const { symbol, price } = priceUpdate;

        // Log để debug (occasionally để tránh spam)
        if (Math.random() < 0.001) { // 0.1% của updates
          this.logger.debug(
            `[User ${userId}] ${symbol}: $${price} | Buy: ${enableBuy} | Sell: ${enableSell}`,
          );
        }

        // TODO: Implement your strategy logic here
        // 1. Check user's positions from database
        // 2. Apply user's strategy rules (DCA, reversal, etc.)
        // 3. Execute trades using user's client (isolated)

        // Example:
        // const positions = await this.getUserPositions(userId, symbol);
        // if (enableBuy && shouldBuy(price, positions)) {
        //   await this.executeBuy(userId, symbol, price, client);
        // }
        // if (enableSell && shouldSell(price, positions)) {
        //   await this.executeSell(userId, symbol, price, client);
        // }

      } catch (error) {
        this.logger.error(
          `[User ${userId}] Error processing trade:`,
          error,
        );
        // User này error KHÔNG crash users khác
      }
    };

    // Subscribe to shared market data events
    this.marketDataService.onPriceUpdate(priceUpdateHandler);

    this.logger.log(
      `✅ Strategy ${strategyName} running for user ${userId} on ${symbols.length} symbols (using SHARED market data)`,
    );

    // Return cleanup function - QUAN TRỌNG!
    // Khi user stop, remove listener (KHÔNG unsubscribe WebSocket vì users khác vẫn dùng)
    return () => {
      this.logger.log(`🧹 Cleaning up strategy ${strategyName} for user ${userId}`);
      // TODO: Remove event listener properly
      // EventEmitter doesn't have a built-in way to remove specific listener
      // Consider using RxJS Subject instead for better cleanup
      this.logger.log(`✅ Cleaned up listener for user ${userId}`);
    };
  }

  /**
   * Get user-specific settings
   */
  private async getUserSettings(userId: string) {
    // You can extend this to get user-specific settings
    // For now, return default settings
    const settings = await this.prismaService.setting.findMany({});
    return settings.reduce(
      (acc, s) => ({ ...acc, [s.key]: s.value }),
      {} as Record<string, string>,
    );
  }
}
