<template>
  <div class="order-book">
    <!-- Header -->
    <div class="ob-header">
      <span class="ob-title">Order Book</span>
      <div class="ob-controls">
        <v-menu offset-y>
          <template #activator="{ props }">
            <button class="agg-btn" v-bind="props">
              {{ aggregation }}
              <v-icon size="14">mdi-chevron-down</v-icon>
            </button>
          </template>
          <v-list density="compact" class="agg-menu">
            <v-list-item
              v-for="agg in aggregationLevels"
              :key="agg"
              :class="{ active: aggregation === agg }"
              @click="aggregation = agg"
            >
              <v-list-item-title>{{ agg }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </div>

    <!-- Column headers -->
    <div class="ob-columns">
      <span>Price</span>
      <span>Amount</span>
      <span>Total</span>
    </div>

    <!-- Asks (sells) - reversed order -->
    <div class="ob-asks" ref="asksContainer">
      <div
        v-for="(ask, index) in displayAsks"
        :key="'ask-' + index"
        class="ob-row ask"
        @click="handlePriceClick(ask.price)"
      >
        <div class="depth-bar ask" :style="{ width: getDepthWidth(ask.total, maxAskTotal) + '%' }"></div>
        <span class="ob-price">{{ formatPrice(ask.price) }}</span>
        <span class="ob-amount">{{ formatAmount(ask.quantity) }}</span>
        <span class="ob-total">{{ formatAmount(ask.total) }}</span>
      </div>
    </div>

    <!-- Spread -->
    <div class="ob-spread">
      <span class="spread-price" :class="lastPriceDirection">
        {{ formatPrice(lastPrice) }}
        <v-icon size="14">{{ lastPriceDirection === 'up' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}</v-icon>
      </span>
      <span class="spread-value">
        Spread: {{ formatPrice(spread) }} ({{ spreadPercent.toFixed(3) }}%)
      </span>
    </div>

    <!-- Bids (buys) -->
    <div class="ob-bids" ref="bidsContainer">
      <div
        v-for="(bid, index) in displayBids"
        :key="'bid-' + index"
        class="ob-row bid"
        @click="handlePriceClick(bid.price)"
      >
        <div class="depth-bar bid" :style="{ width: getDepthWidth(bid.total, maxBidTotal) + '%' }"></div>
        <span class="ob-price">{{ formatPrice(bid.price) }}</span>
        <span class="ob-amount">{{ formatAmount(bid.quantity) }}</span>
        <span class="ob-total">{{ formatAmount(bid.total) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { fetchOrderBook, subscribeDepth, type DepthData } from "~/services/binanceService";
import { useTradingState } from "~/composables/useTradingState";

const props = defineProps<{
  symbol: string;
}>();

const emit = defineEmits<{
  (e: "priceClick", price: number): void;
}>();

const { orderBook, updateOrderBook, spread, spreadPercent, setSelectedPrice, currentPrice } = useTradingState();

const aggregation = ref(0.01);
const lastPrice = ref(0);
const lastPriceDirection = ref<"up" | "down">("up");
const prevPrice = ref(0);

let stopDepthWs: (() => void) | null = null;

const aggregationLevels = [0.01, 0.1, 1, 10, 50, 100];

const displayAsks = computed(() => {
  return aggregateOrders(orderBook.value.asks, aggregation.value, false).slice(0, 15).reverse();
});

const displayBids = computed(() => {
  return aggregateOrders(orderBook.value.bids, aggregation.value, true).slice(0, 15);
});

const maxAskTotal = computed(() => {
  return Math.max(...displayAsks.value.map((a) => a.total), 1);
});

const maxBidTotal = computed(() => {
  return Math.max(...displayBids.value.map((b) => b.total), 1);
});

function aggregateOrders(
  orders: { price: number; quantity: number; total: number }[],
  level: number,
  isBid: boolean
): { price: number; quantity: number; total: number }[] {
  if (orders.length === 0) return [];

  const aggregated = new Map<number, number>();

  for (const order of orders) {
    const roundedPrice = isBid
      ? Math.floor(order.price / level) * level
      : Math.ceil(order.price / level) * level;
    aggregated.set(roundedPrice, (aggregated.get(roundedPrice) || 0) + order.quantity);
  }

  const result = Array.from(aggregated.entries())
    .map(([price, quantity]) => ({ price, quantity, total: 0 }))
    .sort((a, b) => (isBid ? b.price - a.price : a.price - b.price));

  // Calculate cumulative total
  let cumulative = 0;
  for (const item of result) {
    cumulative += item.quantity;
    item.total = cumulative;
  }

  return result;
}

function getDepthWidth(total: number, maxTotal: number): number {
  return Math.min((total / maxTotal) * 100, 100);
}

function formatPrice(price: number): string {
  if (price === 0) return "-";
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

function formatAmount(amount: number): string {
  if (amount >= 1e6) return (amount / 1e6).toFixed(2) + "M";
  if (amount >= 1e3) return (amount / 1e3).toFixed(2) + "K";
  return amount.toFixed(4);
}

function handlePriceClick(price: number) {
  setSelectedPrice(price);
  emit("priceClick", price);
}

async function loadOrderBook() {
  try {
    const data = await fetchOrderBook(props.symbol, 20);
    updateOrderBook(data.bids, data.asks, data.lastUpdateId);
  } catch (error) {
    console.error("Failed to load order book:", error);
  }
}

function subscribeToDepth() {
  stopDepthWs?.();

  stopDepthWs = subscribeDepth(props.symbol, (data: DepthData) => {
    updateOrderBook(data.bids, data.asks, data.lastUpdateId);
  });
}

// Watch current price for direction indicator
watch(currentPrice, (newPrice) => {
  if (prevPrice.value > 0) {
    lastPriceDirection.value = newPrice >= prevPrice.value ? "up" : "down";
  }
  prevPrice.value = lastPrice.value;
  lastPrice.value = newPrice;
});

// Watch symbol changes
watch(
  () => props.symbol,
  async () => {
    await loadOrderBook();
    subscribeToDepth();
  }
);

onMounted(async () => {
  lastPrice.value = currentPrice.value;
  await loadOrderBook();
  subscribeToDepth();
});

onBeforeUnmount(() => {
  stopDepthWs?.();
});
</script>

<style scoped>
.order-book {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 12px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
}

.ob-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.ob-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.agg-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 11px;
  color: #94a3b8;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.agg-btn:hover {
  border-color: rgba(167, 139, 250, 0.4);
}

.agg-menu {
  background: #1e293b !important;
  border: 1px solid rgba(167, 139, 250, 0.2);
}

.agg-menu :deep(.v-list-item) {
  min-height: 32px;
}

.agg-menu :deep(.v-list-item-title) {
  font-size: 12px;
  color: #f1f5f9;
}

.agg-menu :deep(.v-list-item.active) {
  background: rgba(167, 139, 250, 0.1);
}

.ob-columns {
  display: flex;
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(167, 139, 250, 0.05);
}

.ob-columns span:first-child {
  flex: 1.2;
}

.ob-columns span:nth-child(2) {
  flex: 1;
  text-align: right;
}

.ob-columns span:last-child {
  flex: 1;
  text-align: right;
}

.ob-asks,
.ob-bids {
  flex: 1;
  overflow-y: auto;
}

.ob-row {
  display: flex;
  padding: 3px 12px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease;
}

.ob-row:hover {
  background: rgba(167, 139, 250, 0.08);
}

.depth-bar {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
}

.depth-bar.ask {
  background: rgba(239, 68, 68, 0.15);
}

.depth-bar.bid {
  background: rgba(16, 185, 129, 0.15);
}

.ob-price {
  flex: 1.2;
  font-size: 11px;
  font-weight: 500;
  font-family: monospace;
  position: relative;
  z-index: 1;
}

.ob-row.ask .ob-price {
  color: #ef4444;
}

.ob-row.bid .ob-price {
  color: #10b981;
}

.ob-amount,
.ob-total {
  flex: 1;
  font-size: 11px;
  font-weight: 400;
  color: #94a3b8;
  text-align: right;
  font-family: monospace;
  position: relative;
  z-index: 1;
}

.ob-spread {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(167, 139, 250, 0.05);
  border-top: 1px solid rgba(167, 139, 250, 0.1);
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.spread-price {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 700;
  font-family: monospace;
}

.spread-price.up {
  color: #10b981;
}

.spread-price.down {
  color: #ef4444;
}

.spread-value {
  font-size: 10px;
  color: #64748b;
}

/* Scrollbar */
.ob-asks::-webkit-scrollbar,
.ob-bids::-webkit-scrollbar {
  width: 3px;
}

.ob-asks::-webkit-scrollbar-track,
.ob-bids::-webkit-scrollbar-track {
  background: transparent;
}

.ob-asks::-webkit-scrollbar-thumb,
.ob-bids::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.2);
  border-radius: 2px;
}
</style>
