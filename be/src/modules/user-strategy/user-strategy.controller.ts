import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Body,
  Request,
} from '@nestjs/common';
import { UserStrategyRegistry } from './user-strategy-registry.service';
import { AuthenticationGuard } from '../authentication/guards/authentication.guard';

@Controller('user-strategies')
@UseGuards(AuthenticationGuard)
export class UserStrategyController {
  constructor(private readonly strategyRegistry: UserStrategyRegistry) {}

  /**
   * Start a strategy for the authenticated user
   * POST /user-strategies/start
   */
  @Post('start')
  async startStrategy(
    @Body() body: { userId: string; strategyName: string },
  ) {
    await this.strategyRegistry.startUserStrategy(
      body.userId,
      body.strategyName,
    );
    return {
      message: `Strategy ${body.strategyName} started successfully`,
    };
  }

  /**
   * Stop a strategy for the authenticated user
   * POST /user-strategies/stop
   */
  @Post('stop')
  async stopStrategy(
    @Body() body: { userId: string; strategyName: string },
  ) {
    await this.strategyRegistry.stopUserStrategy(
      body.userId,
      body.strategyName,
    );
    return {
      message: `Strategy ${body.strategyName} stopped successfully`,
    };
  }

  /**
   * Reload strategy (useful after updating API keys)
   * POST /user-strategies/reload
   */
  @Post('reload')
  async reloadStrategy(
    @Body() body: { userId: string; strategyName: string },
  ) {
    await this.strategyRegistry.reloadUserStrategy(
      body.userId,
      body.strategyName,
    );
    return {
      message: `Strategy ${body.strategyName} reloaded successfully`,
    };
  }

  /**
   * Stop all strategies for a user
   * DELETE /user-strategies/:userId/all
   */
  @Delete(':userId/all')
  async stopAllStrategies(@Param('userId') userId: string) {
    await this.strategyRegistry.stopAllUserStrategies(userId);
    return {
      message: `All strategies stopped for user ${userId}`,
    };
  }

  /**
   * Get user's running strategies
   * GET /user-strategies/:userId
   */
  @Get(':userId')
  getUserStrategies(@Param('userId') userId: string) {
    const strategies = this.strategyRegistry.getUserStrategies(userId);
    return {
      userId,
      strategies,
    };
  }

  /**
   * Get statistics of all running strategies
   * GET /user-strategies/stats
   */
  @Get('stats/all')
  getStatistics() {
    return this.strategyRegistry.getStatistics();
  }
}
