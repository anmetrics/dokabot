<template>
  <v-container fluid class="dashboard-container">
    <!-- Header -->
    <div class="welcome-header mb-6">
      <div class="d-flex align-center justify-space-between flex-wrap ga-3">
        <div>
          <h1 class="text-h4 font-weight-bold mb-2">Dashboard</h1>
          <p class="text-subtitle-1 text-secondary">{{ currentDate }}</p>
        </div>
        <div class="d-flex align-center ga-2">
          <v-chip
            v-if="lastUpdated"
            size="small"
            color="success"
            variant="tonal"
          >
            <v-icon start size="12">mdi-clock</v-icon>
            {{ formatTime(lastUpdated) }}
          </v-chip>
          <v-btn
            icon
            size="small"
            @click="fetchDashboardData"
            :loading="loading"
          >
            <v-icon :class="{ rotating: loading }">mdi-refresh</v-icon>
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      closable
      class="mb-4"
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>

    <!-- Stats Cards Row -->
    <v-row class="mb-6">
      <!-- Portfolio Value -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card stat-card-purple">
          <div class="stat-icon-wrapper">
            <v-icon size="32" color="white">mdi-wallet</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">Portfolio Value</div>
            <div class="stat-value">${{ formatNumber(portfolioValue) }}</div>
            <div class="stat-change">{{ positions.length }} open positions</div>
          </div>
        </v-card>
      </v-col>

      <!-- Unrealized P&L -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card stat-card-blue">
          <div class="stat-icon-wrapper">
            <v-icon size="32" color="white">mdi-chart-line</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">Unrealized P&L</div>
            <div
              class="stat-value"
              :class="unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'"
            >
              {{ unrealizedPnL >= 0 ? "+" : "" }}${{
                formatNumber(unrealizedPnL)
              }}
            </div>
            <div
              class="stat-change"
              :class="unrealizedPnLPercent >= 0 ? 'positive' : 'negative'"
            >
              <v-icon size="16">{{
                unrealizedPnLPercent >= 0 ? "mdi-arrow-up" : "mdi-arrow-down"
              }}</v-icon>
              {{ Math.abs(unrealizedPnLPercent).toFixed(2) }}%
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Today's Profit -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card stat-card-green">
          <div class="stat-icon-wrapper">
            <v-icon size="32" color="white">mdi-calendar-today</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">Today's Profit</div>
            <div
              class="stat-value"
              :class="todayProfit >= 0 ? 'text-profit' : 'text-loss'"
            >
              {{ todayProfit >= 0 ? "+" : "" }}${{ formatNumber(todayProfit) }}
            </div>
            <div class="stat-change">
              {{ performance?.periodBreakdown?.today?.trades || 0 }} trades
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Win Rate -->
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card stat-card-cyan">
          <div class="stat-icon-wrapper">
            <v-icon size="32" color="white">mdi-trophy</v-icon>
          </div>
          <div class="stat-content">
            <div class="stat-label">Win Rate</div>
            <div class="stat-value">{{ winRate.toFixed(1) }}%</div>
            <div class="stat-change">
              {{ performance?.summary?.totalTrades || 0 }} total trades
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Chart and Metrics Row -->
    <v-row class="mb-6">
      <!-- Cumulative Profit Chart -->
      <v-col cols="12" lg="8">
        <v-card class="chart-card">
          <div class="chart-header">
            <h3 class="chart-title">Cumulative Profit</h3>
          </div>
          <div class="chart-wrapper">
            <canvas ref="profitChartCanvas"></canvas>
          </div>
        </v-card>
      </v-col>

      <!-- Performance Metrics -->
      <v-col cols="12" lg="4">
        <v-card class="metrics-card">
          <div class="card-header">
            <v-icon color="primary" class="mr-2">mdi-chart-arc</v-icon>
            <h3 class="card-title">Performance Metrics</h3>
          </div>
          <v-divider class="my-3 border-opacity-10"></v-divider>
          <div class="metrics-grid">
            <div class="metric-item">
              <div class="metric-label">Sharpe Ratio</div>
              <div class="metric-value">
                {{ (performance?.riskMetrics?.sharpeRatio || 0).toFixed(2) }}
              </div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Profit Factor</div>
              <div
                class="metric-value"
                :class="
                  (performance?.riskMetrics?.profitFactor || 0) >= 1
                    ? 'text-green'
                    : 'text-red'
                "
              >
                {{ (performance?.riskMetrics?.profitFactor || 0).toFixed(2) }}
              </div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Max Drawdown</div>
              <div class="metric-value text-red">
                ${{ formatNumber(performance?.riskMetrics?.maxDrawdown || 0) }}
              </div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Risk/Reward</div>
              <div class="metric-value">
                {{
                  (performance?.riskMetrics?.riskRewardRatio || 0).toFixed(2)
                }}
              </div>
            </div>
          </div>

          <!-- Period Breakdown -->
          <v-divider class="my-3 border-opacity-10"></v-divider>
          <div class="period-breakdown">
            <div class="period-item">
              <span class="period-label">Today</span>
              <span class="period-trades"
                >{{
                  performance?.periodBreakdown?.today?.trades || 0
                }}
                trades</span
              >
              <span
                class="period-profit"
                :class="
                  (performance?.periodBreakdown?.today?.profit || 0) >= 0
                    ? 'text-green'
                    : 'text-red'
                "
              >
                ${{
                  formatNumber(performance?.periodBreakdown?.today?.profit || 0)
                }}
              </span>
            </div>
            <div class="period-item">
              <span class="period-label">This Week</span>
              <span class="period-trades"
                >{{
                  performance?.periodBreakdown?.week?.trades || 0
                }}
                trades</span
              >
              <span
                class="period-profit"
                :class="
                  (performance?.periodBreakdown?.week?.profit || 0) >= 0
                    ? 'text-green'
                    : 'text-red'
                "
              >
                ${{
                  formatNumber(performance?.periodBreakdown?.week?.profit || 0)
                }}
              </span>
            </div>
            <div class="period-item">
              <span class="period-label">This Month</span>
              <span class="period-trades"
                >{{
                  performance?.periodBreakdown?.month?.trades || 0
                }}
                trades</span
              >
              <span
                class="period-profit"
                :class="
                  (performance?.periodBreakdown?.month?.profit || 0) >= 0
                    ? 'text-green'
                    : 'text-red'
                "
              >
                ${{
                  formatNumber(performance?.periodBreakdown?.month?.profit || 0)
                }}
              </span>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Positions and Signals Row -->
    <v-row>
      <!-- Open Positions -->
      <v-col cols="12" md="6">
        <v-card class="positions-card">
          <div class="card-header">
            <v-icon color="amber" class="mr-2">mdi-briefcase-outline</v-icon>
            <h3 class="card-title">Open Positions</h3>
            <v-chip size="small" class="ml-auto">{{ positions.length }}</v-chip>
          </div>
          <v-divider class="my-3 border-opacity-10"></v-divider>
          <div class="positions-list">
            <div
              v-for="pos in positions.slice(0, 5)"
              :key="pos.id"
              class="position-item"
            >
              <div class="position-symbol">
                <v-chip
                  size="small"
                  :color="pos.profit >= 0 ? 'success' : 'error'"
                  variant="tonal"
                >
                  {{ pos.symbol.replace("USDT", "") }}
                </v-chip>
              </div>
              <div class="position-details">
                <span class="position-qty">{{ pos.qty.toFixed(4) }}</span>
                <span class="position-entry"
                  >@ ${{ formatPrice(pos.buyPrice) }}</span
                >
              </div>
              <div
                class="position-pnl"
                :class="pos.profit >= 0 ? 'text-profit' : 'text-loss'"
              >
                {{ pos.profit >= 0 ? "+" : "" }}${{ pos.profit.toFixed(2) }}
                <span class="pnl-percent"
                  >({{ pos.profitPercent.toFixed(2) }}%)</span
                >
              </div>
            </div>
            <div v-if="positions.length === 0" class="empty-state">
              <v-icon size="48" color="grey">mdi-briefcase-off</v-icon>
              <div class="empty-text">No open positions</div>
            </div>
          </div>
          <v-btn
            v-if="positions.length > 5"
            block
            variant="text"
            color="primary"
            class="mt-3"
            to="/positions"
          >
            View all {{ positions.length }} positions
            <v-icon end>mdi-arrow-right</v-icon>
          </v-btn>
        </v-card>
      </v-col>

      <!-- Recent Signals -->
      <v-col cols="12" md="6">
        <v-card class="activity-card">
          <div class="activity-header">
            <v-icon color="primary" class="mr-2">mdi-bell-ring</v-icon>
            <h3 class="activity-title">Recent Signals</h3>
          </div>
          <v-divider class="my-3 border-opacity-10"></v-divider>
          <div class="activity-list">
            <div
              v-for="(signal, index) in signals.slice(0, 5)"
              :key="index"
              class="activity-item"
            >
              <div class="activity-icon">
                <v-icon
                  size="20"
                  :color="signal.type === 'BUY_SIGNAL' ? 'success' : 'warning'"
                >
                  {{
                    signal.type === "BUY_SIGNAL"
                      ? "mdi-arrow-up-bold"
                      : "mdi-arrow-down-bold"
                  }}
                </v-icon>
              </div>
              <div class="activity-content">
                <div class="activity-title-text">
                  {{
                    signal.type === "BUY_SIGNAL" ? "Buy Signal" : "Sell Signal"
                  }}
                  - {{ signal.symbol }}
                </div>
                <div class="activity-subtitle">
                  {{ signal.reasons?.[0] || "No reason provided" }}
                </div>
              </div>
              <div class="activity-meta">
                <v-chip
                  v-if="signal.confidence"
                  size="x-small"
                  :color="signal.confidence >= 70 ? 'success' : 'warning'"
                >
                  {{ signal.confidence }}%
                </v-chip>
                <div class="activity-time">
                  {{ formatRelativeTime(signal.timestamp) }}
                </div>
              </div>
            </div>
            <div v-if="signals.length === 0" class="empty-state">
              <v-icon size="48" color="grey">mdi-bell-off</v-icon>
              <div class="empty-text">No active signals</div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Chart, registerables } from "chart.js";
import { useApi } from "~/apis";

Chart.register(...registerables);

// Types
interface Position {
  id: string;
  symbol: string;
  buyPrice: number;
  qty: number;
  usdSpent: number;
  currentPrice: number;
  profit: number;
  profitPercent: number;
  dcaIndex: number;
  isDualInvestment: boolean;
  createdAt: string;
  strategy: string;
}

interface AccountBalance {
  asset: string;
  free: string;
  locked: string;
}

interface AccountInfo {
  balances: AccountBalance[];
}

interface PerformanceData {
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalProfit: number;
    avgProfit: number;
  };
  riskMetrics: {
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
    riskRewardRatio: number;
  };
  periodBreakdown: {
    today: { trades: number; profit: number };
    week: { trades: number; profit: number };
    month: { trades: number; profit: number };
  };
  cumulativeProfits: Array<{
    date: string;
    dailyProfit: number;
    cumulative: number;
  }>;
}

interface Signal {
  symbol: string;
  type: "BUY_SIGNAL" | "SELL_SIGNAL";
  confidence?: number;
  reasons: string[];
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  currentPrice?: number;
  timestamp: number;
}

// API
const api = useApi();

// State
const positions = ref<Position[]>([]);
const accountInfo = ref<AccountInfo | null>(null);
const performance = ref<PerformanceData | null>(null);
const signals = ref<Signal[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const lastUpdated = ref<Date | null>(null);

// Chart
const profitChartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

// Computed
const currentDate = computed(() => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  return now.toLocaleDateString("vi-VN", options);
});

const portfolioValue = computed(() => {
  const usdtBalance = accountInfo.value?.balances?.find(
    (b) => b.asset === "USDT",
  );
  const usdtFree = parseFloat(usdtBalance?.free || "0");
  const usdtLocked = parseFloat(usdtBalance?.locked || "0");
  const positionsValue = positions.value.reduce(
    (sum, p) => sum + p.usdSpent,
    0,
  );
  return usdtFree + usdtLocked + positionsValue;
});

const unrealizedPnL = computed(() => {
  return positions.value.reduce((sum, p) => sum + p.profit, 0);
});

const unrealizedPnLPercent = computed(() => {
  const totalInvested = positions.value.reduce((sum, p) => sum + p.usdSpent, 0);
  if (totalInvested === 0) return 0;
  return (unrealizedPnL.value / totalInvested) * 100;
});

const todayProfit = computed(() => {
  return performance.value?.periodBreakdown?.today?.profit || 0;
});

const winRate = computed(() => {
  return performance.value?.summary?.winRate || 0;
});

// Methods
const formatNumber = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPrice = (price: number) => {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const fetchDashboardData = async () => {
  loading.value = true;
  error.value = null;

  try {
    const [positionsRes, accountRes, performanceRes, signalsRes] =
      await Promise.all([
        api.get<Position[]>("binance/positions"),
        api.get<AccountInfo>("binance/account"),
        api.get<PerformanceData>("strategy/performance"),
        api.get<Signal[]>("strategy/signals"),
      ]);

    positions.value = positionsRes || [];
    accountInfo.value = accountRes || null;
    performance.value = performanceRes || null;
    signals.value = signalsRes || [];

    lastUpdated.value = new Date();
    updateChart();
  } catch (e: any) {
    console.error("Error fetching dashboard data:", e);
    error.value = e?.message || "Failed to fetch data";
  } finally {
    loading.value = false;
  }
};

const updateChart = () => {
  if (!profitChartCanvas.value || !performance.value?.cumulativeProfits) return;

  if (chartInstance) chartInstance.destroy();

  const data = performance.value.cumulativeProfits || [];
  const labels = data.map((d) => d.date);
  const values = data.map((d) => d.cumulative);

  const gradient = profitChartCanvas.value
    .getContext("2d")
    ?.createLinearGradient(0, 0, 0, 300);
  gradient?.addColorStop(0, "rgba(16, 185, 129, 0.3)");
  gradient?.addColorStop(1, "rgba(16, 185, 129, 0)");

  chartInstance = new Chart(profitChartCanvas.value, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Cumulative Profit ($)",
          data: values,
          borderColor: "#10b981",
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#10b981",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          titleColor: "#F1F5F9",
          bodyColor: "#F1F5F9",
          borderColor: "#10b981",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (ctx) => `$${(ctx.parsed.y ?? 0).toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(241, 245, 249, 0.05)" },
          ticks: { color: "#94A3B8", maxRotation: 45 },
        },
        y: {
          grid: { color: "rgba(241, 245, 249, 0.05)" },
          ticks: {
            color: "#94A3B8",
            callback: (v) => `$${v}`,
          },
        },
      },
    },
  });
};

onMounted(() => {
  fetchDashboardData();
  // Auto refresh every 30 seconds
  refreshInterval = setInterval(fetchDashboardData, 30000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
  if (chartInstance) chartInstance.destroy();
});
</script>

<style scoped>
.dashboard-container {
  max-width: 1400px;
  padding: 24px;
  background: transparent;
}

/* Welcome Header */
.welcome-header h1 {
  color: #f1f5f9;
  font-weight: 700;
  background: linear-gradient(135deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.text-secondary {
  color: #94a3b8;
}

/* Stat Cards */
.stat-card {
  position: relative;
  padding: 24px;
  border-radius: 20px;
  overflow: hidden;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  border: 1px solid rgba(167, 139, 250, 0.1);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(124, 58, 237, 0.2);
}

.stat-card-purple {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
}

.stat-card-blue {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.stat-card-green {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.stat-card-cyan {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
}

.stat-icon-wrapper {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.stat-content {
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 8px;
  line-height: 1.2;
}

.stat-value.text-profit {
  color: #ffffff;
}

.stat-value.text-loss {
  color: #fca5a5;
}

.stat-change {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
  color: rgba(255, 255, 255, 0.9);
}

.stat-change.positive {
  color: rgba(255, 255, 255, 0.95);
}

.stat-change.negative {
  color: #fca5a5;
}

/* Chart Card */
.chart-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  height: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.chart-title {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.chart-wrapper {
  width: 100%;
  height: 320px;
}

/* Metrics Card */
.metrics-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.metric-item {
  text-align: center;
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
}

.metric-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.metric-value {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
}

.metric-value.text-green {
  color: #10b981;
}

.metric-value.text-red {
  color: #ef4444;
}

/* Period Breakdown */
.period-breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.period-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
}

.period-label {
  font-size: 14px;
  font-weight: 500;
  color: #f1f5f9;
  min-width: 80px;
}

.period-trades {
  font-size: 12px;
  color: #94a3b8;
}

.period-profit {
  font-size: 14px;
  font-weight: 600;
}

.period-profit.text-green {
  color: #10b981;
}

.period-profit.text-red {
  color: #ef4444;
}

/* Positions Card */
.positions-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  height: 100%;
}

.positions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.position-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
}

.position-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.position-qty {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.position-entry {
  font-size: 12px;
  color: #94a3b8;
}

.position-pnl {
  text-align: right;
  font-size: 14px;
  font-weight: 600;
}

.position-pnl.text-profit {
  color: #10b981;
}

.position-pnl.text-loss {
  color: #ef4444;
}

.pnl-percent {
  font-size: 11px;
  opacity: 0.8;
}

/* Activity Card */
.activity-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  padding: 24px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  height: 100%;
}

.activity-header {
  display: flex;
  align-items: center;
}

.activity-title {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
}

.activity-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.1);
  border-radius: 10px;
}

.activity-content {
  flex: 1;
}

.activity-title-text {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.activity-subtitle {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

.activity-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.activity-time {
  font-size: 11px;
  color: #64748b;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
}

.empty-text {
  margin-top: 12px;
  font-size: 14px;
  color: #64748b;
}

/* Rotating animation */
.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Responsive */
@media (max-width: 960px) {
  .dashboard-container {
    padding: 16px;
  }

  .stat-card {
    padding: 20px;
  }

  .stat-value {
    font-size: 24px;
  }

  .chart-wrapper {
    height: 260px;
  }
}

@media (max-width: 600px) {
  .welcome-header h1 {
    font-size: 24px;
  }

  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .stat-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .stat-icon-wrapper .v-icon {
    font-size: 24px !important;
  }

  .chart-wrapper {
    height: 220px;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .metric-item {
    padding: 8px;
  }

  .metric-value {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .dashboard-container {
    padding: 12px;
  }

  .welcome-header h1 {
    font-size: 20px;
  }

  .stat-card {
    padding: 16px;
  }

  .stat-icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .stat-icon-wrapper .v-icon {
    font-size: 20px !important;
  }

  .stat-value {
    font-size: 18px;
  }

  .stat-label {
    font-size: 11px;
  }

  .chart-wrapper {
    height: 200px;
  }

  .activity-card,
  .positions-card,
  .metrics-card {
    padding: 16px;
  }

  .position-item,
  .activity-item {
    padding: 10px;
  }
}
</style>
