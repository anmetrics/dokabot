import { Logger } from '@nestjs/common';
import {
  createPublicClient,
  http,
  webSocket,
  type PublicClient,
} from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { SUBSCRIPTION_ABI } from './billing.constants';
import { ChainLog, IChainClient } from './chain-client';

/** Live BSC implementation. Everything above this is transport-agnostic. */
export class ViemChainClient implements IChainClient {
  private readonly logger = new Logger(ViemChainClient.name);
  private readonly client: PublicClient;

  readonly chainId: number;

  constructor(options: { rpcUrl: string; wsUrl?: string; testnet?: boolean }) {
    const chain = options.testnet ? bscTestnet : bsc;
    this.chainId = chain.id;

    // Websocket for latency, HTTP for the backfill: a socket cannot serve a
    // historical range reliably, and the backfill is what makes this correct.
    this.client = createPublicClient({
      chain,
      transport: options.wsUrl ? webSocket(options.wsUrl) : http(options.rpcUrl),
    }) as PublicClient;
  }

  getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber();
  }

  async getLogs(params: {
    address: string;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<ChainLog[]> {
    const logs = await this.client.getLogs({
      address: params.address as `0x${string}`,
      events: SUBSCRIPTION_ABI,
      fromBlock: params.fromBlock,
      toBlock: params.toBlock,
    });
    return logs.map((log) => this.normalise(log));
  }

  watch(params: {
    address: string;
    onLogs: (logs: ChainLog[]) => void;
    onError: (error: Error) => void;
  }): () => void {
    return this.client.watchEvent({
      address: params.address as `0x${string}`,
      events: SUBSCRIPTION_ABI,
      onLogs: (logs) => params.onLogs(logs.map((log) => this.normalise(log))),
      onError: params.onError,
    });
  }

  private normalise(log: {
    eventName?: string;
    args?: unknown;
    blockNumber: bigint | null;
    transactionHash: string | null;
    logIndex: number | null;
  }): ChainLog {
    return {
      eventName: log.eventName ?? 'unknown',
      args: (log.args ?? {}) as Record<string, unknown>,
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? '',
      logIndex: log.logIndex ?? 0,
    };
  }
}
