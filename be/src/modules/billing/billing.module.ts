import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingController } from './billing.controller';
import { IChainClient } from './chain-client';
import { PaymentListenerService } from './payment-listener.service';
import { SubscriptionService } from './subscription.service';
import { ViemChainClient } from './viem-chain-client';
import { WalletService } from './wallet.service';

export const CHAIN_CLIENT = 'CHAIN_CLIENT';

@Global()
@Module({
  controllers: [BillingController],
  providers: [
    SubscriptionService,
    WalletService,
    {
      provide: CHAIN_CLIENT,
      useFactory: (config: ConfigService): IChainClient | null => {
        const rpcUrl = config.get<string>('BILLING_RPC_URL');
        // No RPC configured means billing runs in read-only mode: the API still
        // reports plans and status, it just never sees a payment.
        if (!rpcUrl) return null;
        return new ViemChainClient({
          rpcUrl,
          wsUrl: config.get<string>('BILLING_WS_URL'),
          testnet: config.get<string>('BILLING_TESTNET') === 'true',
        });
      },
      inject: [ConfigService],
    },
    {
      provide: PaymentListenerService,
      useFactory: (
        prisma: PrismaService,
        subscriptions: SubscriptionService,
        wallets: WalletService,
        chain: IChainClient | null,
        config: ConfigService,
      ) => {
        const listener = new PaymentListenerService(
          prisma,
          subscriptions,
          wallets,
          chain,
          config.get<string>('BILLING_CONTRACT_ADDRESS') ?? null,
          BigInt(config.get<string>('BILLING_START_BLOCK') ?? '0'),
        );
        listener.start();
        return listener;
      },
      inject: [
        PrismaService,
        SubscriptionService,
        WalletService,
        CHAIN_CLIENT,
        ConfigService,
      ],
    },
  ],
  exports: [SubscriptionService, WalletService, PaymentListenerService],
})
export class BillingModule {}
