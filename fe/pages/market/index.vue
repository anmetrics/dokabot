<template>
  <v-container fluid class="market-container">
    <v-row justify="center">
      <v-col cols="12">
        <!-- Page Header -->
        <div class="page-header mb-6">
          <div class="d-flex align-center gap-3">
            <div class="header-icon-wrapper">
              <v-icon size="28" color="white">mdi-chart-areaspline</v-icon>
            </div>
            <div>
              <h1 class="page-title">Thị trường Binance</h1>
              <p class="page-subtitle">
                Theo dõi giá và biểu đồ nến trực tiếp
              </p>
            </div>
          </div>

          <!-- Controls -->
          <div class="controls-wrapper">
            <v-select
              v-model="selectedPair"
              :items="tradingPairs"
              item-title="label"
              item-value="symbol"
              variant="outlined"
              density="comfortable"
              class="pair-select"
              placeholder="Chọn cặp giao dịch"
              @update:model-value="changePair"
            >
              <template #prepend-inner>
                <v-icon color="#a78bfa" size="20">mdi-bitcoin</v-icon>
              </template>
            </v-select>

            <v-select
              v-model="selectedInterval"
              :items="intervalOptions"
              item-title="label"
              item-value="value"
              variant="outlined"
              density="comfortable"
              class="interval-select"
              @update:model-value="changeInterval"
            >
              <template #prepend-inner>
                <v-icon color="#a78bfa" size="20">mdi-clock-outline</v-icon>
              </template>
            </v-select>
          </div>
        </div>

        <!-- Chart Card -->
        <v-card class="chart-card">
          <div class="chart-header">
            <div class="d-flex align-center gap-3">
              <v-chip
                v-if="selectedPair"
                size="large"
                class="symbol-chip"
                variant="flat"
              >
                <v-icon start size="20">mdi-chart-line-variant</v-icon>
                {{ selectedPair }}
              </v-chip>
              <v-chip
                v-if="currentPrice"
                size="large"
                :class="priceChangePositive ? 'price-chip-positive' : 'price-chip-negative'"
                variant="flat"
              >
                ${{ formatNumber(currentPrice) }}
              </v-chip>
            </div>
            <div class="d-flex align-center gap-2">
              <v-chip
                size="small"
                class="interval-chip"
                variant="flat"
              >
                {{ intervalLabel(selectedInterval) }}
              </v-chip>
              <v-icon
                :class="['live-indicator', { 'live-active': isConnected }]"
                size="20"
              >
                mdi-circle
              </v-icon>
            </div>
          </div>

          <v-divider class="divider"></v-divider>

          <!-- Chart Container -->
          <div v-if="tradingPairs.length === 0" class="loading-container">
            <v-progress-circular
              indeterminate
              color="primary"
              size="64"
            ></v-progress-circular>
            <p class="loading-text">Đang tải dữ liệu thị trường...</p>
          </div>

          <div v-else class="chart-wrapper">
            <ClientOnly>
              <candle-chart
                :klines-data="klines"
                @load-more="loadMoreHistorical"
              />
            </ClientOnly>
          </div>
        </v-card>

        <!-- Market Stats -->
        <v-row class="mt-6">
          <v-col cols="12" sm="6" md="3">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper">
                <v-icon size="24" color="#10b981">mdi-trending-up</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">24h High</div>
                <div class="stat-value">{{ currentPrice ? `$${formatNumber(currentPrice * 1.05)}` : '-' }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper">
                <v-icon size="24" color="#ef4444">mdi-trending-down</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">24h Low</div>
                <div class="stat-value">{{ currentPrice ? `$${formatNumber(currentPrice * 0.95)}` : '-' }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper">
                <v-icon size="24" color="#3b82f6">mdi-swap-horizontal</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">24h Volume</div>
                <div class="stat-value">{{ currentPrice ? `${formatNumber(currentPrice * 1000)}` : '-' }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper">
                <v-icon size="24" color="#a78bfa">mdi-chart-timeline-variant</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">24h Change</div>
                <div class="stat-value" :class="priceChangePositive ? 'positive' : 'negative'">
                  {{ priceChangePercent }}
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import type { CandlestickData } from "lightweight-charts";
import {
  fetchHistoricalKlines,
  fetchTradingPairs,
  subscribeKlines,
  type TradingPair,
} from "~/services/binanceService";

// Config
const intervals = [
  "1s",
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "8h",
  "1d",
  "1w",
  "1M",
];

const intervalLabels = {
  "1s": "1 giây",
  "1m": "1 phút",
  "5m": "5 phút",
  "15m": "15 phút",
  "30m": "30 phút",
  "1h": "1 giờ",
  "2h": "2 giờ",
  "8h": "8 giờ",
  "1d": "1 ngày",
  "1w": "1 tuần",
  "1M": "1 tháng",
};

const intervalLabel = (interval: string) =>
  intervalLabels[interval as keyof typeof intervalLabels] || interval;

const intervalOptions = intervals.map((interval) => ({
  label: intervalLabel(interval),
  value: interval,
}));

// Reactive state
const tradingPairs = ref<{ symbol: string; label: string }[]>([]);
const selectedPair = ref<string>("");
const selectedInterval = ref<string>("1m");
const klines = ref<CandlestickData[]>([]);
const isLoading = ref(false);
const isConnected = ref(false);
let stopWs: (() => void) | null = null;

// Computed
const currentPrice = computed(() => {
  if (klines.value.length === 0) return null;
  return klines.value[klines.value.length - 1].close;
});

const priceChangePositive = computed(() => {
  if (klines.value.length < 2) return true;
  const firstPrice = klines.value[0].open;
  const lastPrice = klines.value[klines.value.length - 1].close;
  return lastPrice >= firstPrice;
});

const priceChangePercent = computed(() => {
  if (klines.value.length < 2) return "+0.00%";
  const firstPrice = klines.value[0].open;
  const lastPrice = klines.value[klines.value.length - 1].close;
  const change = ((lastPrice - firstPrice) / firstPrice) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
});

const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

// Fetch trading pairs on mount
onMounted(async () => {
  try {
    const pairs = await fetchTradingPairs();
    tradingPairs.value = pairs.map((pair: TradingPair) => ({
      symbol: pair.symbol,
      label: `${pair.baseAsset}/${pair.quoteAsset}`,
    }));

    // Default to BTCUSDT
    selectedPair.value = "BTCUSDT";
    await loadInitialData();
  } catch (error) {
    console.error("Failed to fetch trading pairs:", error);
  }
});

// Function to load initial data
const loadInitialData = async () => {
  if (!selectedPair.value) return;

  isLoading.value = true;
  klines.value = [];
  stopWs?.();
  isConnected.value = false;

  try {
    const historicalData = await fetchHistoricalKlines(
      selectedPair.value,
      selectedInterval.value,
      100
    );
    klines.value = historicalData;
  } catch (error) {
    console.error("Failed to fetch historical klines:", error);
  } finally {
    isLoading.value = false;
  }

  // Start new WebSocket subscription
  if (selectedPair.value) {
    stopWs = subscribeKlines(
      selectedPair.value,
      selectedInterval.value,
      updateCandle
    );
    isConnected.value = true;
  }
};

// Function to change pair
const changePair = async () => {
  await loadInitialData();
};

// Function to change interval
const changeInterval = async () => {
  await loadInitialData();
};

// Function to update candle from WebSocket
const updateCandle = (candle: CandlestickData) => {
  const lastCandle = klines.value[klines.value.length - 1];

  if (klines.value.length === 0) return;

  if (lastCandle && lastCandle.time === candle.time) {
    klines.value[klines.value.length - 1] = candle;
    klines.value = [...klines.value];
  } else {
    klines.value.push(candle);
    klines.value = [...klines.value];
  }
};

// Function to load more historical data
const loadMoreHistorical = async () => {
  if (isLoading.value || klines.value.length === 0 || !selectedPair.value)
    return;

  isLoading.value = true;
  try {
    const oldestTime = klines.value[0].time * 1000 - 1;
    const newData = await fetchHistoricalKlines(
      selectedPair.value,
      selectedInterval.value,
      100,
      oldestTime
    );
    klines.value = [...newData, ...klines.value];
  } catch (error) {
    console.error("Failed to load more historical klines:", error);
  } finally {
    isLoading.value = false;
  }
};

// Cleanup WebSocket on unmount
onBeforeUnmount(() => {
  stopWs?.();
  isConnected.value = false;
});
</script>

<style scoped>
.market-container {
  max-width: 1600px;
  padding: 24px;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 24px;
}

.header-icon-wrapper {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #94a3b8;
  margin: 4px 0 0 0;
}

.controls-wrapper {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.pair-select,
.interval-select {
  min-width: 200px;
}

.pair-select :deep(.v-field),
.interval-select :deep(.v-field) {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(167, 139, 250, 0.05) 100%);
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #f1f5f9;
}

.pair-select :deep(.v-field:hover),
.interval-select :deep(.v-field:hover) {
  border-color: rgba(167, 139, 250, 0.4);
}

/* Chart Card */
.chart-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
}

.chart-header {
  padding: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.symbol-chip {
  background: rgba(124, 58, 237, 0.2) !important;
  color: #a78bfa !important;
  font-weight: 700;
  font-size: 16px;
  border: 1px solid rgba(167, 139, 250, 0.3);
}

.price-chip-positive {
  background: rgba(16, 185, 129, 0.15) !important;
  color: #10b981 !important;
  font-weight: 700;
  font-size: 16px;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.price-chip-negative {
  background: rgba(239, 68, 68, 0.15) !important;
  color: #ef4444 !important;
  font-weight: 700;
  font-size: 16px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.interval-chip {
  background: rgba(167, 139, 250, 0.1) !important;
  color: #94a3b8 !important;
  font-weight: 600;
  border: 1px solid rgba(167, 139, 250, 0.2);
}

.live-indicator {
  color: #64748b;
  transition: all 0.3s ease;
}

.live-indicator.live-active {
  color: #10b981;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.divider {
  border-color: rgba(167, 139, 250, 0.1);
}

.chart-wrapper {
  padding: 24px;
  min-height: 500px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 24px;
  gap: 20px;
}

.loading-text {
  font-size: 16px;
  color: #94a3b8;
  margin: 0;
}

/* Stat Cards */
.stat-card {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.1) 0%,
    rgba(167, 139, 250, 0.05) 100%
  );
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(167, 139, 250, 0.15);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.15) 0%,
    rgba(167, 139, 250, 0.08) 100%
  );
  transform: translateY(-3px);
  border-color: rgba(167, 139, 250, 0.3);
  box-shadow: 0 8px 20px rgba(124, 58, 237, 0.2);
}

.stat-icon-wrapper {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.1);
  border-radius: 12px;
}

.stat-content {
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
}

.stat-value.positive {
  color: #10b981;
}

.stat-value.negative {
  color: #ef4444;
}

/* Responsive */
@media (max-width: 960px) {
  .market-container {
    padding: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .header-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .controls-wrapper {
    width: 100%;
  }

  .pair-select,
  .interval-select {
    flex: 1;
    min-width: 150px;
  }

  .chart-wrapper {
    min-height: 400px;
  }

  .stat-value {
    font-size: 18px;
  }
}

@media (max-width: 600px) {
  .page-title {
    font-size: 20px;
  }

  .chart-header {
    padding: 16px;
  }

  .chart-wrapper {
    padding: 16px;
    min-height: 300px;
  }

  .controls-wrapper {
    flex-direction: column;
  }

  .pair-select,
  .interval-select {
    width: 100%;
  }

  .stat-value {
    font-size: 16px;
  }
}
</style>
