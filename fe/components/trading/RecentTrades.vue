<template>
  <div class="recent-trades">
    <!-- Header -->
    <div class="rt-header">
      <span class="rt-title">Recent Trades</span>
      <button
        :class="['auto-scroll-btn', { active: autoScroll }]"
        @click="autoScroll = !autoScroll"
        title="Auto-scroll"
      >
        <v-icon size="14">mdi-arrow-down-bold</v-icon>
      </button>
    </div>

    <!-- Column headers -->
    <div class="rt-columns">
      <span>Price</span>
      <span>Amount</span>
      <span>Time</span>
    </div>

    <!-- Trades list -->
    <div class="rt-list" ref="listContainer">
      <div
        v-for="trade in displayTrades"
        :key="trade.id"
        :class="['rt-row', trade.isBuyerMaker ? 'sell' : 'buy', { 'flash': trade.isNew }]"
      >
        <span class="rt-price">{{ formatPrice(trade.price) }}</span>
        <span class="rt-amount">{{ formatAmount(trade.quantity) }}</span>
        <span class="rt-time">{{ formatTime(trade.time) }}</span>
      </div>

      <div v-if="isLoading" class="loading-state">
        <v-progress-circular indeterminate size="20" color="primary" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { fetchRecentTrades, subscribeTrades, type TradeData } from "~/services/binanceService";
import { useTradingState } from "~/composables/useTradingState";

const props = defineProps<{
  symbol: string;
}>();

const { recentTrades, addTrade } = useTradingState();

interface TradeWithNew extends TradeData {
  isNew?: boolean;
}

const autoScroll = ref(true);
const isLoading = ref(true);
const listContainer = ref<HTMLElement | null>(null);

let stopTradeWs: (() => void) | null = null;

const displayTrades = computed((): TradeWithNew[] => {
  return recentTrades.value.slice(0, 50);
});

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

function formatAmount(amount: number): string {
  if (amount >= 1e6) return (amount / 1e6).toFixed(2) + "M";
  if (amount >= 1e3) return (amount / 1e3).toFixed(2) + "K";
  return amount.toFixed(4);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function scrollToTop() {
  if (autoScroll.value && listContainer.value) {
    listContainer.value.scrollTop = 0;
  }
}

async function loadRecentTrades() {
  try {
    const trades = await fetchRecentTrades(props.symbol, 50);

    // Clear existing trades and add new ones
    recentTrades.value = trades.map((t) => ({
      id: t.id,
      price: t.price,
      quantity: t.quantity,
      time: t.time,
      isBuyerMaker: t.isBuyerMaker,
    }));

    isLoading.value = false;
  } catch (error) {
    console.error("Failed to load recent trades:", error);
    isLoading.value = false;
  }
}

function subscribeToTrades() {
  stopTradeWs?.();

  stopTradeWs = subscribeTrades(props.symbol, (trade: TradeData) => {
    addTrade({
      id: trade.id,
      price: trade.price,
      quantity: trade.quantity,
      time: trade.time,
      isBuyerMaker: trade.isBuyerMaker,
    });

    nextTick(() => {
      scrollToTop();
    });
  });
}

// Watch symbol changes
watch(
  () => props.symbol,
  async () => {
    isLoading.value = true;
    recentTrades.value = [];
    await loadRecentTrades();
    subscribeToTrades();
  }
);

onMounted(async () => {
  await loadRecentTrades();
  subscribeToTrades();
});

onBeforeUnmount(() => {
  stopTradeWs?.();
});
</script>

<style scoped>
.recent-trades {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 8px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
}

.rt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.rt-title {
  font-size: 11px;
  font-weight: 600;
  color: #f1f5f9;
}

.auto-scroll-btn {
  padding: 3px;
  color: #64748b;
  background: transparent;
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

.auto-scroll-btn .v-icon {
  font-size: 12px !important;
}

.auto-scroll-btn:hover {
  color: #94a3b8;
  border-color: rgba(167, 139, 250, 0.2);
}

.auto-scroll-btn.active {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.3);
}

.rt-columns {
  display: flex;
  padding: 4px 10px;
  font-size: 9px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(167, 139, 250, 0.05);
}

.rt-columns span {
  flex: 1;
}

.rt-columns span:first-child {
  flex: 1.2;
}

.rt-columns span:last-child {
  text-align: right;
}

.rt-list {
  flex: 1;
  overflow-y: auto;
}

.rt-row {
  display: flex;
  padding: 2px 10px;
  transition: background 0.15s ease;
}

.rt-row:hover {
  background: rgba(167, 139, 250, 0.05);
}

.rt-row.flash {
  animation: flash 0.5s ease-out;
}

@keyframes flash {
  0% {
    background: rgba(167, 139, 250, 0.2);
  }
  100% {
    background: transparent;
  }
}

.rt-price {
  flex: 1.2;
  font-size: 10px;
  font-weight: 500;
  font-family: monospace;
}

.rt-row.buy .rt-price {
  color: #10b981;
}

.rt-row.sell .rt-price {
  color: #ef4444;
}

.rt-amount {
  flex: 1;
  font-size: 10px;
  font-weight: 400;
  color: #94a3b8;
  font-family: monospace;
}

.rt-time {
  flex: 1;
  font-size: 9px;
  color: #64748b;
  text-align: right;
  font-family: monospace;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 16px;
}

/* Scrollbar */
.rt-list::-webkit-scrollbar {
  width: 3px;
}

.rt-list::-webkit-scrollbar-track {
  background: transparent;
}

.rt-list::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.2);
  border-radius: 2px;
}

/* Responsive breakpoints */
@media (max-width: 768px) {
  .rt-header {
    padding: 6px 8px;
  }

  .rt-title {
    font-size: 10px;
  }

  .auto-scroll-btn {
    padding: 4px;
    min-width: 28px;
    min-height: 28px;
  }

  .rt-columns {
    padding: 3px 8px;
    font-size: 8px;
  }

  .rt-row {
    padding: 3px 8px;
    min-height: 24px;
  }

  .rt-price,
  .rt-amount {
    font-size: 9px;
  }

  .rt-time {
    font-size: 8px;
  }
}

@media (max-width: 480px) {
  .rt-header {
    padding: 5px 6px;
  }

  .rt-title {
    font-size: 9px;
  }

  .auto-scroll-btn {
    min-width: 32px;
    min-height: 32px;
  }

  .rt-columns span:last-child,
  .rt-time {
    display: none;
  }

  .rt-columns {
    padding: 2px 6px;
  }

  .rt-row {
    padding: 4px 6px;
    min-height: 28px;
  }

  .rt-price,
  .rt-amount {
    font-size: 8px;
  }
}
</style>
