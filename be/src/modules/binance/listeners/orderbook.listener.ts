import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';
import { OrderbookEvent } from '../events/orderbook.event';

@Injectable()
export class OrderBookListener {
  private logger = new Logger('OrderBookListener');

  @OnEvent(OrderbookEvent.UPDATE)
  handleOrderBookUpdate(payload: any) {
    console.log(payload);
  }
}
