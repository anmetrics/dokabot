import { ref, computed } from "vue";
import type { CandlestickData } from "lightweight-charts";

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price?: number;
  priceChange?: number;
  priceChangePercent?: number;
  volume?: number;
  high?: number;
  low?: number;
}

export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
}

export interface Trade {
  id: string;
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean;
}

export interface DemoOrder {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET" | "STOP_LIMIT";
  price: number;
  stopPrice?: number;
  quantity: number;
  filled: number;
  status: "NEW" | "FILLED" | "CANCELED";
  time: number;
}

export interface Indicator {
  type: "MA" | "EMA" | "MACD" | "RSI" | "BOLL" | "VOL";
  enabled: boolean;
  params: Record<string, number>;
  color?: string;
}

// Global state
const currentSymbol = ref<string>("BTCUSDT");
const currentPair = ref<TradingPair | null>(null);
const timeframe = ref<string>("1m");
const chartType = ref<"candlestick" | "line" | "area">("candlestick");

// Klines data
const klines = ref<CandlestickData[]>([]);

// Order book
const orderBook = ref<{
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  lastUpdateId: number;
}>({
  bids: [],
  asks: [],
  lastUpdateId: 0,
});
const aggregationLevel = ref<number>(0.01);

// Recent trades
const recentTrades = ref<Trade[]>([]);

// Demo orders
const demoOrders = ref<DemoOrder[]>([]);
const orderHistory = ref<DemoOrder[]>([]);

// Balance (mock)
const mockBalances = ref<Record<string, { free: number; locked: number }>>({
  USDT: { free: 10000, locked: 0 },
  BTC: { free: 0.5, locked: 0 },
  ETH: { free: 5, locked: 0 },
  BNB: { free: 10, locked: 0 },
  SOL: { free: 50, locked: 0 },
});

// Indicators
const indicators = ref<Indicator[]>([
  { type: "MA", enabled: false, params: { period: 7 }, color: "#f59e0b" },
  { type: "MA", enabled: false, params: { period: 25 }, color: "#3b82f6" },
  { type: "MA", enabled: false, params: { period: 99 }, color: "#a855f7" },
  { type: "EMA", enabled: false, params: { period: 7 }, color: "#22c55e" },
  { type: "EMA", enabled: false, params: { period: 25 }, color: "#ef4444" },
  { type: "MACD", enabled: false, params: { fast: 12, slow: 26, signal: 9 } },
  { type: "RSI", enabled: false, params: { period: 14 } },
  { type: "BOLL", enabled: false, params: { period: 20, stdDev: 2 }, color: "#8b5cf6" },
  { type: "VOL", enabled: true, params: {} },
]);

// UI state
const isFullscreen = ref<boolean>(false);
const activeBottomTab = ref<string>("openOrders");
const sidebarCollapsed = ref<boolean>(false);
const selectedPrice = ref<number | null>(null);

// Favorites (persisted)
const favorites = ref<string[]>([]);

// Load favorites from localStorage
if (typeof window !== "undefined") {
  const saved = localStorage.getItem("trading_favorites");
  if (saved) {
    try {
      favorites.value = JSON.parse(saved);
    } catch {
      favorites.value = [];
    }
  }
}

// Computed
const currentPrice = computed(() => {
  if (klines.value.length === 0) return 0;
  return klines.value[klines.value.length - 1].close as number;
});

const priceChange = computed(() => {
  if (klines.value.length < 2) return 0;
  const first = klines.value[0].open as number;
  const last = klines.value[klines.value.length - 1].close as number;
  return last - first;
});

const priceChangePercent = computed(() => {
  if (klines.value.length < 2) return 0;
  const first = klines.value[0].open as number;
  const last = klines.value[klines.value.length - 1].close as number;
  return ((last - first) / first) * 100;
});

const spread = computed(() => {
  if (orderBook.value.asks.length === 0 || orderBook.value.bids.length === 0) return 0;
  const lowestAsk = orderBook.value.asks[0]?.price || 0;
  const highestBid = orderBook.value.bids[0]?.price || 0;
  return lowestAsk - highestBid;
});

const spreadPercent = computed(() => {
  if (orderBook.value.asks.length === 0 || orderBook.value.bids.length === 0) return 0;
  const lowestAsk = orderBook.value.asks[0]?.price || 0;
  const highestBid = orderBook.value.bids[0]?.price || 0;
  if (highestBid === 0) return 0;
  return ((lowestAsk - highestBid) / highestBid) * 100;
});

const openOrders = computed(() => {
  return demoOrders.value.filter((o) => o.status === "NEW");
});

// Actions
function setSymbol(symbol: string) {
  currentSymbol.value = symbol;
  klines.value = [];
  orderBook.value = { bids: [], asks: [], lastUpdateId: 0 };
  recentTrades.value = [];
}

function setTimeframe(tf: string) {
  timeframe.value = tf;
  klines.value = [];
}

function setKlines(data: CandlestickData[]) {
  klines.value = data;
}

function updateKline(candle: CandlestickData) {
  if (klines.value.length === 0) return;

  const lastCandle = klines.value[klines.value.length - 1];
  if (lastCandle && lastCandle.time === candle.time) {
    klines.value[klines.value.length - 1] = candle;
    klines.value = [...klines.value];
  } else {
    klines.value.push(candle);
    klines.value = [...klines.value];
  }
}

function prependKlines(data: CandlestickData[]) {
  klines.value = [...data, ...klines.value];
}

function updateOrderBook(bids: [string, string][], asks: [string, string][], lastUpdateId: number) {
  const processEntries = (entries: [string, string][], isBid: boolean): OrderBookEntry[] => {
    let cumulative = 0;
    const processed = entries
      .map(([price, qty]) => ({
        price: parseFloat(price),
        quantity: parseFloat(qty),
        total: 0,
      }))
      .filter((e) => e.quantity > 0)
      .sort((a, b) => (isBid ? b.price - a.price : a.price - b.price))
      .slice(0, 20);

    for (const entry of processed) {
      cumulative += entry.quantity;
      entry.total = cumulative;
    }
    return processed;
  };

  orderBook.value = {
    bids: processEntries(bids, true),
    asks: processEntries(asks, false),
    lastUpdateId,
  };
}

function addTrade(trade: Trade) {
  recentTrades.value = [trade, ...recentTrades.value].slice(0, 100);
}

function setSelectedPrice(price: number) {
  selectedPrice.value = price;
}

function toggleFavorite(symbol: string) {
  const index = favorites.value.indexOf(symbol);
  if (index === -1) {
    favorites.value.push(symbol);
  } else {
    favorites.value.splice(index, 1);
  }
  if (typeof window !== "undefined") {
    localStorage.setItem("trading_favorites", JSON.stringify(favorites.value));
  }
}

function isFavorite(symbol: string): boolean {
  return favorites.value.includes(symbol);
}

function toggleIndicator(type: string, params?: Record<string, number>) {
  const indicator = indicators.value.find(
    (i) => i.type === type && JSON.stringify(i.params) === JSON.stringify(params || i.params)
  );
  if (indicator) {
    indicator.enabled = !indicator.enabled;
  }
}

function placeDemoOrder(order: Omit<DemoOrder, "id" | "status" | "time" | "filled">): DemoOrder {
  const newOrder: DemoOrder = {
    ...order,
    id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: order.type === "MARKET" ? "FILLED" : "NEW",
    filled: order.type === "MARKET" ? order.quantity : 0,
    time: Date.now(),
  };

  if (order.type === "MARKET") {
    orderHistory.value = [newOrder, ...orderHistory.value];
  } else {
    demoOrders.value.push(newOrder);
  }

  // Persist to localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem("demo_orders", JSON.stringify(demoOrders.value));
    localStorage.setItem("demo_order_history", JSON.stringify(orderHistory.value));
  }

  return newOrder;
}

function cancelDemoOrder(orderId: string) {
  const index = demoOrders.value.findIndex((o) => o.id === orderId);
  if (index !== -1) {
    const order = demoOrders.value[index];
    order.status = "CANCELED";
    orderHistory.value = [order, ...orderHistory.value];
    demoOrders.value.splice(index, 1);

    if (typeof window !== "undefined") {
      localStorage.setItem("demo_orders", JSON.stringify(demoOrders.value));
      localStorage.setItem("demo_order_history", JSON.stringify(orderHistory.value));
    }
  }
}

function getBalance(asset: string): { free: number; locked: number } {
  return mockBalances.value[asset] || { free: 0, locked: 0 };
}

// Load demo orders from localStorage
if (typeof window !== "undefined") {
  const savedOrders = localStorage.getItem("demo_orders");
  const savedHistory = localStorage.getItem("demo_order_history");
  if (savedOrders) {
    try {
      demoOrders.value = JSON.parse(savedOrders);
    } catch {
      demoOrders.value = [];
    }
  }
  if (savedHistory) {
    try {
      orderHistory.value = JSON.parse(savedHistory);
    } catch {
      orderHistory.value = [];
    }
  }
}

export function useTradingState() {
  return {
    // State
    currentSymbol,
    currentPair,
    timeframe,
    chartType,
    klines,
    orderBook,
    aggregationLevel,
    recentTrades,
    demoOrders,
    orderHistory,
    mockBalances,
    indicators,
    isFullscreen,
    activeBottomTab,
    sidebarCollapsed,
    selectedPrice,
    favorites,

    // Computed
    currentPrice,
    priceChange,
    priceChangePercent,
    spread,
    spreadPercent,
    openOrders,

    // Actions
    setSymbol,
    setTimeframe,
    setKlines,
    updateKline,
    prependKlines,
    updateOrderBook,
    addTrade,
    setSelectedPrice,
    toggleFavorite,
    isFavorite,
    toggleIndicator,
    placeDemoOrder,
    cancelDemoOrder,
    getBalance,
  };
}
