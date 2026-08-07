import { ref } from "vue";
import { useApi } from "~/apis";
import type { Exchange } from "~/composables/useExchangeAccounts";

export type BotStatus = "DRAFT" | "RUNNING" | "PAUSED" | "STOPPED" | "ERROR";

export type Bot = {
  id: string;
  exchangeAccountId: string;
  strategyKey: string;
  symbol: string;
  timeframe: string;
  config: Record<string, unknown>;
  status: BotStatus;
  shardId: number;
  isPaper: boolean;
  maxLossUsd: string | null;
  lastError: string | null;
  createdAt: string;
};

export type OrderState =
  | "PENDING"
  | "NEW"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELED"
  | "REJECTED"
  | "EXPIRED";

export type Order = {
  id: string;
  botId: string | null;
  exchange: Exchange;
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  clientOrderId: string;
  exchangeOrderId: string | null;
  price: string;
  quantity: string;
  filledQuantity: string;
  averagePrice: string;
  state: OrderState;
  isPaper: boolean;
  lastError: string | null;
  createdAt: string;
};

export type ParamSpec = {
  key: string;
  label: string;
  type: "number" | "boolean" | "enum";
  default: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: "%" | "x" | "bars" | "USD";
  options?: { value: string; label: string }[];
  help?: string;
};

export type StrategyInfo = {
  key: string;
  name: string;
  description: string;
  category: "momentum" | "mean-reversion" | "trend" | "volatility" | "breakout";
  minCandles: number;
  params: ParamSpec[];
};

export type CreateBotPayload = {
  exchangeAccountId: string;
  strategyKey: string;
  symbol: string;
  timeframe: string;
  isPaper: boolean;
  maxLossUsd?: string;
  config?: Record<string, unknown>;
};

const readError = async (err: any): Promise<string> => {
  const body = await err?.response?.json?.().catch(() => null);
  const message = body?.message;
  if (Array.isArray(message)) return message.join(", ");
  return message || err?.message || "Đã có lỗi xảy ra, vui lòng thử lại.";
};

export function useBots() {
  const api = useApi();
  const bots = ref<Bot[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchBots = async () => {
    loading.value = true;
    error.value = null;
    try {
      bots.value = await api.get<Bot[]>("bots");
    } catch (err) {
      error.value = await readError(err);
    } finally {
      loading.value = false;
    }
  };

  const createBot = async (payload: CreateBotPayload) => {
    const created = await api.post<Bot>("bots", payload);
    bots.value = [created, ...bots.value];
    return created;
  };

  const setStatus = async (id: string, action: "start" | "pause" | "stop") => {
    const updated = await api.post<Bot>(`bots/${id}/${action}`);
    bots.value = bots.value.map((b) => (b.id === id ? updated : b));
    return updated;
  };

  const deleteBot = async (id: string) => {
    await api.delete(`bots/${id}`);
    bots.value = bots.value.filter((b) => b.id !== id);
  };

  return { bots, loading, error, fetchBots, createBot, setStatus, deleteBot, readError };
}

export function useStrategies() {
  const api = useApi();
  const strategies = ref<StrategyInfo[]>([]);
  const loading = ref(false);

  const fetchStrategies = async () => {
    loading.value = true;
    try {
      strategies.value = await api.get<StrategyInfo[]>("strategies");
    } finally {
      loading.value = false;
    }
  };

  /** Builds the default settings object for a strategy's form. */
  const defaultsFor = (strategy: StrategyInfo): Record<string, unknown> =>
    Object.fromEntries(strategy.params.map((p) => [p.key, p.default]));

  return { strategies, loading, fetchStrategies, defaultsFor };
}

export function useOrders() {
  const api = useApi();
  const orders = ref<Order[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchOrders = async (botId?: string) => {
    loading.value = true;
    error.value = null;
    try {
      orders.value = await api.get<Order[]>("orders", botId ? { botId } : undefined);
    } catch (err) {
      error.value = await readError(err);
    } finally {
      loading.value = false;
    }
  };

  const syncOrder = async (id: string) => {
    const updated = await api.post<Order>(`orders/${id}/sync`);
    orders.value = orders.value.map((o) => (o.id === id ? updated : o));
    return updated;
  };

  const cancelOrder = async (id: string) => {
    const updated = await api.delete<Order>(`orders/${id}`);
    orders.value = orders.value.map((o) => (o.id === id ? updated : o));
    return updated;
  };

  return { orders, loading, error, fetchOrders, syncOrder, cancelOrder, readError };
}
