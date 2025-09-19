import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
// import { PrismaService } from 'src/prisma.service';
import { TradeEvent } from '../events/trade.event';

@Injectable()
export class TradeListener {
  constructor() {}

  @OnEvent('trade.executed')
  async handleTradeEvent(payload: TradeEvent) {
    // await this.prisma.order.create({
    //   data: {
    //     symbol: payload.symbol,
    //     side: payload.side,
    //     price: payload.price,
    //     quantity: payload.qty,
    //     executedQty: payload.qty,
    //     status: 'FILLED',
    //     raw: payload,
    //   },
    // });
  }
}
