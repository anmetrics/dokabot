import { Injectable, OnModuleInit } from '@nestjs/common';
import { MempoolListener } from './listeners/mempool.listener';

@Injectable()
export class ArbitrageService implements OnModuleInit {
  constructor(private listener: MempoolListener) {}
  onModuleInit() {
    this.listener.start();
  }
}
