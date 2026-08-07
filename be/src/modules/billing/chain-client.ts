import { Log } from 'viem';

/**
 * The chain, as this module needs it.
 *
 * An interface rather than a viem client directly, so billing logic can be tested
 * without an RPC endpoint — and so the transport (websocket, HTTP polling, a
 * hosted indexer) can change without touching anything above it.
 */
export interface IChainClient {
  readonly chainId: number;
  getBlockNumber(): Promise<bigint>;
  /** Inclusive range. */
  getLogs(params: {
    address: string;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<ChainLog[]>;
  /**
   * Pushes new logs as they appear. Returns an unsubscribe function.
   *
   * The stream is a latency optimisation only — correctness comes from the
   * backfill, because a websocket that silently dies loses events.
   */
  watch(params: {
    address: string;
    onLogs: (logs: ChainLog[]) => void;
    onError: (error: Error) => void;
  }): () => void;
}

export type ChainLog = {
  eventName: string;
  args: Record<string, unknown>;
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
};

export type DecodedLog = Log & { eventName?: string; args?: unknown };
