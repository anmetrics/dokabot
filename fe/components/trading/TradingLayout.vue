<template>
  <div class="trading-layout" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Left Sidebar - Trading Pairs -->
    <aside class="sidebar" v-show="!sidebarCollapsed">
      <TradingPairsList
        :current-symbol="currentSymbol"
        @select="handlePairSelect"
        @collapse="sidebarCollapsed = true"
      />
    </aside>

    <!-- Collapsed sidebar toggle -->
    <button
      v-if="sidebarCollapsed"
      class="expand-sidebar-btn"
      @click="sidebarCollapsed = false"
    >
      <v-icon size="18">mdi-chevron-right</v-icon>
    </button>

    <!-- Main content area -->
    <main class="main-content">
      <!-- Top row: Chart + OrderBook -->
      <div class="top-row">
        <!-- Chart section -->
        <section class="chart-section">
          <TradingChart :symbol="currentSymbol" @price-click="handlePriceClick" />
        </section>

        <!-- Right sidebar: OrderBook + RecentTrades -->
        <aside class="right-sidebar">
          <div class="order-book-wrapper">
            <OrderBook :symbol="currentSymbol" @price-click="handlePriceClick" />
          </div>
          <div class="recent-trades-wrapper">
            <RecentTrades :symbol="currentSymbol" />
          </div>
        </aside>
      </div>

      <!-- Bottom row: OrderForm + TradingTabs -->
      <div class="bottom-row">
        <section class="order-form-section">
          <OrderForm :symbol="currentSymbol" />
        </section>
        <section class="tabs-section">
          <TradingTabs />
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import TradingPairsList from "./TradingPairsList.vue";
import TradingChart from "./TradingChart.vue";
import OrderBook from "./OrderBook.vue";
import RecentTrades from "./RecentTrades.vue";
import OrderForm from "./OrderForm.vue";
import TradingTabs from "./TradingTabs.vue";
import { useTradingState } from "~/composables/useTradingState";

const {
  currentSymbol,
  sidebarCollapsed,
  setSymbol,
  setSelectedPrice,
} = useTradingState();

function handlePairSelect(symbol: string) {
  setSymbol(symbol);
}

function handlePriceClick(price: number) {
  setSelectedPrice(price);
}

// Set default symbol
watch(
  currentSymbol,
  (symbol) => {
    if (!symbol) {
      setSymbol("BTCUSDT");
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.trading-layout {
  display: flex;
  height: 100vh;
  background: #0f172a;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid rgba(167, 139, 250, 0.1);
}

.trading-layout.sidebar-collapsed .sidebar {
  display: none;
}

.expand-sidebar-btn {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  padding: 8px 4px;
  color: #94a3b8;
  background: #1e293b;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-left: none;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  z-index: 100;
  transition: all 0.2s ease;
}

.expand-sidebar-btn:hover {
  color: #f1f5f9;
  background: #334155;
}

/* Main content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  gap: 12px;
  overflow: hidden;
}

/* Top row */
.top-row {
  display: flex;
  flex: 1;
  gap: 12px;
  min-height: 0;
}

.chart-section {
  flex: 1;
  min-width: 0;
  min-height: 400px;
}

.right-sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-book-wrapper {
  flex: 1;
  min-height: 0;
}

.recent-trades-wrapper {
  height: 200px;
  flex-shrink: 0;
}

/* Bottom row */
.bottom-row {
  display: flex;
  gap: 12px;
  height: 280px;
  flex-shrink: 0;
}

.order-form-section {
  width: 320px;
  flex-shrink: 0;
}

.tabs-section {
  flex: 1;
  min-width: 0;
}

/* Responsive */
@media (max-width: 1400px) {
  .right-sidebar {
    width: 280px;
  }

  .order-form-section {
    width: 280px;
  }
}

@media (max-width: 1200px) {
  .sidebar {
    width: 220px;
  }

  .right-sidebar {
    width: 260px;
  }

  .order-form-section {
    width: 260px;
  }
}

@media (max-width: 1024px) {
  .trading-layout {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }

  .sidebar {
    width: 100%;
    height: auto;
    max-height: 300px;
    border-right: none;
    border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  }

  .expand-sidebar-btn {
    display: none;
  }

  .main-content {
    padding: 8px;
    gap: 8px;
  }

  .top-row {
    flex-direction: column;
    flex: none;
  }

  .chart-section {
    height: 400px;
    min-height: auto;
  }

  .right-sidebar {
    width: 100%;
    flex-direction: row;
    height: 300px;
  }

  .order-book-wrapper,
  .recent-trades-wrapper {
    flex: 1;
    height: 100%;
  }

  .bottom-row {
    flex-direction: column;
    height: auto;
  }

  .order-form-section {
    width: 100%;
    height: 400px;
  }

  .tabs-section {
    height: 300px;
  }
}

@media (max-width: 640px) {
  .main-content {
    padding: 4px;
    gap: 4px;
  }

  .chart-section {
    height: auto;
    min-height: 280px;
    flex-shrink: 0;
  }

  .right-sidebar {
    flex-direction: column;
    height: auto;
  }

  .order-book-wrapper {
    height: 250px;
  }

  .recent-trades-wrapper {
    height: 200px;
  }

  .order-form-section {
    height: 350px;
  }

  .tabs-section {
    height: 250px;
  }
}

@media (max-width: 480px) {
  .main-content {
    padding: 3px;
    gap: 3px;
  }

  .chart-section {
    min-height: 240px;
  }

  .order-book-wrapper {
    height: 220px;
  }

  .recent-trades-wrapper {
    height: 180px;
  }

  .order-form-section {
    height: 320px;
  }

  .tabs-section {
    height: 220px;
  }
}
</style>
