import { Injectable } from '@nestjs/common';
import { Exchange } from 'generated/prisma';
import { BinanceAdapter } from './adapters/binance.adapter';
import { BybitAdapter } from './adapters/bybit.adapter';
import { IExchangeAdapter } from './exchange.types';

/** Single lookup point so adding an exchange never touches business logic. */
@Injectable()
export class ExchangeRegistry {
  private readonly adapters: Record<Exchange, IExchangeAdapter>;

  constructor(binance: BinanceAdapter, bybit: BybitAdapter) {
    this.adapters = {
      BINANCE: binance,
      BYBIT: bybit,
    };
  }

  get(exchange: Exchange): IExchangeAdapter {
    return this.adapters[exchange];
  }

  supported(): Exchange[] {
    return Object.keys(this.adapters) as Exchange[];
  }
}
