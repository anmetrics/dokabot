<template>
  <div class="trading-tabs">
    <!-- Tab headers -->
    <div class="tabs-header">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :class="['tab-btn', { active: activeTab === tab.value }]"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
        <span v-if="tab.count > 0" class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Tab content -->
    <div class="tabs-content">
      <!-- Open Orders -->
      <div v-if="activeTab === 'openOrders'" class="tab-panel">
        <div class="panel-header">
          <span>Symbol</span>
          <span>Type</span>
          <span>Side</span>
          <span>Price</span>
          <span>Amount</span>
          <span>Filled</span>
          <span>Time</span>
          <span>Action</span>
        </div>
        <div class="panel-scroll">
          <div v-if="openOrders.length === 0" class="empty-state">
            <v-icon size="32" color="#475569">mdi-file-document-outline</v-icon>
            <span>No open orders</span>
          </div>
          <div
            v-for="order in openOrders"
            :key="order.id"
            class="panel-row"
          >
            <span class="cell symbol">{{ formatSymbol(order.symbol) }}</span>
            <span class="cell">{{ order.type }}</span>
            <span :class="['cell side', order.side.toLowerCase()]">{{ order.side }}</span>
            <span class="cell price">{{ formatPrice(order.price) }}</span>
            <span class="cell">{{ formatAmount(order.quantity) }}</span>
            <span class="cell">{{ formatPercent(order.filled, order.quantity) }}</span>
            <span class="cell time">{{ formatTime(order.time) }}</span>
            <span class="cell action">
              <button class="cancel-btn" @click="cancelOrder(order.id)">
                Cancel
              </button>
            </span>
          </div>
        </div>
      </div>

      <!-- Order History -->
      <div v-if="activeTab === 'orderHistory'" class="tab-panel">
        <div class="panel-header">
          <span>Symbol</span>
          <span>Type</span>
          <span>Side</span>
          <span>Price</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Time</span>
        </div>
        <div class="panel-scroll">
          <div v-if="orderHistory.length === 0" class="empty-state">
            <v-icon size="32" color="#475569">mdi-history</v-icon>
            <span>No order history</span>
          </div>
          <div
            v-for="order in orderHistory"
            :key="order.id"
            class="panel-row"
          >
            <span class="cell symbol">{{ formatSymbol(order.symbol) }}</span>
            <span class="cell">{{ order.type }}</span>
            <span :class="['cell side', order.side.toLowerCase()]">{{ order.side }}</span>
            <span class="cell price">{{ formatPrice(order.price) }}</span>
            <span class="cell">{{ formatAmount(order.quantity) }}</span>
            <span :class="['cell status', order.status.toLowerCase()]">{{ order.status }}</span>
            <span class="cell time">{{ formatTime(order.time) }}</span>
          </div>
        </div>
      </div>

      <!-- Trade History -->
      <div v-if="activeTab === 'tradeHistory'" class="tab-panel">
        <div class="panel-header">
          <span>Symbol</span>
          <span>Side</span>
          <span>Price</span>
          <span>Amount</span>
          <span>Total</span>
          <span>Fee</span>
          <span>Time</span>
        </div>
        <div class="panel-scroll">
          <div v-if="tradeHistoryData.length === 0" class="empty-state">
            <v-icon size="32" color="#475569">mdi-swap-horizontal</v-icon>
            <span>No trade history</span>
          </div>
          <div
            v-for="trade in tradeHistoryData"
            :key="trade.id"
            class="panel-row"
          >
            <span class="cell symbol">{{ formatSymbol(trade.symbol) }}</span>
            <span :class="['cell side', trade.side.toLowerCase()]">{{ trade.side }}</span>
            <span class="cell price">{{ formatPrice(trade.price) }}</span>
            <span class="cell">{{ formatAmount(trade.quantity) }}</span>
            <span class="cell">{{ formatPrice(trade.total) }}</span>
            <span class="cell fee">{{ formatFee(trade.fee) }}</span>
            <span class="cell time">{{ formatTime(trade.time) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useTradingState } from "~/composables/useTradingState";

const { openOrders, orderHistory, cancelDemoOrder } = useTradingState();

const activeTab = ref("openOrders");

interface TradeHistoryItem {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  total: number;
  fee: number;
  time: number;
}

// Mock trade history from completed orders
const tradeHistoryData = computed((): TradeHistoryItem[] => {
  return orderHistory.value
    .filter((o) => o.status === "FILLED")
    .map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      price: o.price,
      quantity: o.quantity,
      total: o.price * o.quantity,
      fee: o.price * o.quantity * 0.001, // 0.1% fee
      time: o.time,
    }));
});

const tabs = computed(() => [
  { label: "Open Orders", value: "openOrders", count: openOrders.value.length },
  { label: "Order History", value: "orderHistory", count: 0 },
  { label: "Trade History", value: "tradeHistory", count: 0 },
]);

function formatSymbol(symbol: string): string {
  if (symbol.endsWith("USDT")) {
    return symbol.slice(0, -4) + "/USDT";
  }
  return symbol;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

function formatAmount(amount: number): string {
  return amount.toFixed(6);
}

function formatPercent(filled: number, total: number): string {
  if (total === 0) return "0%";
  return ((filled / total) * 100).toFixed(1) + "%";
}

function formatFee(fee: number): string {
  return fee.toFixed(6);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function cancelOrder(orderId: string) {
  cancelDemoOrder(orderId);
}
</script>

<style scoped>
.trading-tabs {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 12px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
}

.tabs-header {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-btn:hover {
  color: #94a3b8;
  background: rgba(167, 139, 250, 0.05);
}

.tab-btn.active {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.2);
}

.tab-count {
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 10px;
}

.tabs-content {
  flex: 1;
  overflow: hidden;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  padding: 8px 16px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.05);
}

.panel-header span {
  flex: 1;
  min-width: 80px;
}

.panel-header span:first-child {
  flex: 1.2;
}

.panel-header span:last-child {
  flex: 0.8;
  text-align: right;
}

.panel-scroll {
  flex: 1;
  overflow-y: auto;
}

.panel-row {
  display: flex;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.03);
  transition: background 0.15s ease;
}

.panel-row:hover {
  background: rgba(167, 139, 250, 0.05);
}

.cell {
  flex: 1;
  min-width: 80px;
  font-size: 12px;
  color: #94a3b8;
}

.cell:first-child {
  flex: 1.2;
}

.cell:last-child {
  flex: 0.8;
  text-align: right;
}

.cell.symbol {
  font-weight: 600;
  color: #f1f5f9;
}

.cell.price {
  font-family: monospace;
}

.cell.side.buy {
  color: #10b981;
}

.cell.side.sell {
  color: #ef4444;
}

.cell.status.filled {
  color: #10b981;
}

.cell.status.canceled {
  color: #f59e0b;
}

.cell.status.new {
  color: #3b82f6;
}

.cell.fee {
  color: #64748b;
  font-size: 11px;
}

.cell.time {
  font-size: 11px;
  color: #64748b;
}

.cancel-btn {
  padding: 4px 10px;
  font-size: 11px;
  font-weight: 500;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cancel-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 12px;
  color: #475569;
  font-size: 13px;
}

/* Scrollbar */
.panel-scroll::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.panel-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.panel-scroll::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.2);
  border-radius: 2px;
}

@media (max-width: 768px) {
  .panel-header,
  .panel-row {
    padding: 8px 12px;
  }

  .cell {
    min-width: 60px;
    font-size: 11px;
  }
}
</style>
