<template>
  <v-container fluid class="ict-dashboard pa-4">
    <!-- Header -->
    <div class="dashboard-header mb-4">
      <div class="d-flex align-center justify-space-between flex-wrap ga-3">
        <div>
          <h1 class="text-h5 font-weight-bold text-white mb-1">
            ICT Analysis Dashboard
          </h1>
          <p class="text-body-2 text-grey">
            Multi-Timeframe ICT Strategy Monitor
          </p>
        </div>
        <div class="d-flex align-center ga-2">
          <v-chip
            :color="isKillZone ? 'success' : 'grey'"
            size="small"
            variant="flat"
          >
            <v-icon start size="14">mdi-clock-outline</v-icon>
            {{ isKillZone ? "Kill Zone Active" : "Outside Kill Zone" }}
          </v-chip>
          <v-btn-toggle v-model="selectedSymbol" mandatory density="compact">
            <v-btn
              v-for="sym in symbols"
              :key="sym"
              :value="sym"
              size="small"
            >
              {{ sym.replace("USDT", "") }}
            </v-btn>
          </v-btn-toggle>
          <v-btn icon size="small" @click="refreshData">
            <v-icon :class="{ 'rotating': loading }">mdi-refresh</v-icon>
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

    <!-- Quick Stats Row -->
    <v-row class="mb-4">
      <v-col cols="6" sm="3">
        <div class="stat-mini">
          <div class="stat-mini-label">Daily Bias</div>
          <div
            class="stat-mini-value"
            :class="getBiasClass(currentAnalysis?.htfContext?.dailyBias)"
          >
            {{ currentAnalysis?.htfContext?.dailyBias?.toUpperCase() || "-" }}
          </div>
        </div>
      </v-col>
      <v-col cols="6" sm="3">
        <div class="stat-mini">
          <div class="stat-mini-label">4H Bias</div>
          <div
            class="stat-mini-value"
            :class="getBiasClass(currentAnalysis?.htfContext?.h4Bias)"
          >
            {{ currentAnalysis?.htfContext?.h4Bias?.toUpperCase() || "-" }}
          </div>
        </div>
      </v-col>
      <v-col cols="6" sm="3">
        <div class="stat-mini">
          <div class="stat-mini-label">Current Price</div>
          <div class="stat-mini-value text-white">
            ${{ formatPrice(currentAnalysis?.currentPrice) }}
          </div>
        </div>
      </v-col>
      <v-col cols="6" sm="3">
        <div class="stat-mini">
          <div class="stat-mini-label">Signal Confidence</div>
          <div
            class="stat-mini-value"
            :class="getConfidenceClass(currentAnalysis?.currentSetup?.confidence)"
          >
            {{ currentAnalysis?.currentSetup?.confidence || 0 }}%
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Main Content -->
    <v-row>
      <!-- Left Panel: ICT Analysis -->
      <v-col cols="12" lg="8">
        <!-- HTF Context Card -->
        <v-card class="glass-card mb-4">
          <div class="card-header">
            <v-icon color="primary" class="mr-2">mdi-chart-timeline-variant</v-icon>
            <span>HTF Context (Daily + 4H)</span>
          </div>
          <v-divider class="mx-4 border-opacity-10" />
          <div class="card-content">
            <v-row>
              <!-- Daily Structure -->
              <v-col cols="12" md="6">
                <div class="structure-card">
                  <div class="structure-title">
                    <v-icon size="18" color="amber">mdi-calendar</v-icon>
                    Daily Structure
                  </div>
                  <div class="structure-content">
                    <div class="structure-item">
                      <span class="label">Trend</span>
                      <span
                        class="value"
                        :class="getBiasClass(currentAnalysis?.htfContext?.dailyStructure?.trend)"
                      >
                        {{ currentAnalysis?.htfContext?.dailyStructure?.trend || "-" }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Premium Zone</span>
                      <span class="value text-red">
                        ${{ formatPrice(currentAnalysis?.htfContext?.dailyPremiumDiscount?.premium) }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Equilibrium</span>
                      <span class="value text-grey">
                        ${{ formatPrice(currentAnalysis?.htfContext?.dailyPremiumDiscount?.eq) }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Discount Zone</span>
                      <span class="value text-green">
                        ${{ formatPrice(currentAnalysis?.htfContext?.dailyPremiumDiscount?.discount) }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Swing High</span>
                      <span class="value">
                        ${{ formatPrice(currentAnalysis?.htfContext?.dailyStructure?.swingHigh?.price) }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Swing Low</span>
                      <span class="value">
                        ${{ formatPrice(currentAnalysis?.htfContext?.dailyStructure?.swingLow?.price) }}
                      </span>
                    </div>
                  </div>
                </div>
              </v-col>

              <!-- 4H Structure -->
              <v-col cols="12" md="6">
                <div class="structure-card">
                  <div class="structure-title">
                    <v-icon size="18" color="cyan">mdi-clock-outline</v-icon>
                    4H Structure
                  </div>
                  <div class="structure-content">
                    <div class="structure-item">
                      <span class="label">Trend</span>
                      <span
                        class="value"
                        :class="getBiasClass(currentAnalysis?.htfContext?.h4Structure?.trend)"
                      >
                        {{ currentAnalysis?.htfContext?.h4Structure?.trend || "-" }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Premium Zone</span>
                      <span class="value text-red">
                        ${{ formatPrice(currentAnalysis?.htfContext?.h4PremiumDiscount?.premium) }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Equilibrium</span>
                      <span class="value text-grey">
                        ${{ formatPrice(currentAnalysis?.htfContext?.h4PremiumDiscount?.eq) }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Discount Zone</span>
                      <span class="value text-green">
                        ${{ formatPrice(currentAnalysis?.htfContext?.h4PremiumDiscount?.discount) }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Swing High</span>
                      <span class="value">
                        ${{ formatPrice(currentAnalysis?.htfContext?.h4Structure?.swingHigh?.price) }}
                      </span>
                    </div>
                    <div class="structure-item">
                      <span class="label">Swing Low</span>
                      <span class="value">
                        ${{ formatPrice(currentAnalysis?.htfContext?.h4Structure?.swingLow?.price) }}
                      </span>
                    </div>
                  </div>
                </div>
              </v-col>
            </v-row>
          </div>
        </v-card>

        <!-- Order Blocks & FVG -->
        <v-row>
          <!-- Order Blocks -->
          <v-col cols="12" md="6">
            <v-card class="glass-card">
              <div class="card-header">
                <v-icon color="orange" class="mr-2">mdi-cube-outline</v-icon>
                <span>HTF Order Blocks</span>
                <v-chip size="x-small" class="ml-auto">
                  {{ currentAnalysis?.orderBlocks?.length || 0 }}
                </v-chip>
              </div>
              <v-divider class="mx-4 border-opacity-10" />
              <div class="card-content ob-list">
                <div
                  v-for="(ob, i) in currentAnalysis?.orderBlocks?.slice(0, 5)"
                  :key="i"
                  class="ob-item"
                  :class="ob.type"
                >
                  <div class="ob-type">
                    <v-icon size="14" :color="ob.type === 'bullish' ? 'green' : 'red'">
                      {{ ob.type === "bullish" ? "mdi-arrow-up-bold" : "mdi-arrow-down-bold" }}
                    </v-icon>
                    {{ ob.type.toUpperCase() }}
                  </div>
                  <div class="ob-range">
                    ${{ formatPrice(ob.low) }} - ${{ formatPrice(ob.high) }}
                  </div>
                  <div class="ob-meta">
                    <span class="ob-tf">{{ ob.timeframe }}</span>
                    <span class="ob-strength">{{ (ob.strength * 100).toFixed(0) }}%</span>
                  </div>
                </div>
                <div v-if="!currentAnalysis?.orderBlocks?.length" class="empty-state">
                  No active Order Blocks
                </div>
              </div>
            </v-card>
          </v-col>

          <!-- Fair Value Gaps -->
          <v-col cols="12" md="6">
            <v-card class="glass-card">
              <div class="card-header">
                <v-icon color="purple" class="mr-2">mdi-vector-difference</v-icon>
                <span>HTF Fair Value Gaps</span>
                <v-chip size="x-small" class="ml-auto">
                  {{ currentAnalysis?.fairValueGaps?.length || 0 }}
                </v-chip>
              </div>
              <v-divider class="mx-4 border-opacity-10" />
              <div class="card-content fvg-list">
                <div
                  v-for="(fvg, i) in currentAnalysis?.fairValueGaps?.slice(0, 5)"
                  :key="i"
                  class="fvg-item"
                  :class="fvg.type"
                >
                  <div class="fvg-type">
                    <v-icon size="14" :color="fvg.type === 'bullish' ? 'green' : 'red'">
                      {{ fvg.type === "bullish" ? "mdi-arrow-up-bold" : "mdi-arrow-down-bold" }}
                    </v-icon>
                    {{ fvg.type.toUpperCase() }}
                  </div>
                  <div class="fvg-range">
                    ${{ formatPrice(fvg.low) }} - ${{ formatPrice(fvg.high) }}
                  </div>
                  <div class="fvg-meta">
                    <span class="fvg-tf">{{ fvg.timeframe }}</span>
                    <span class="fvg-mid">Mid: ${{ formatPrice(fvg.midpoint) }}</span>
                  </div>
                </div>
                <div v-if="!currentAnalysis?.fairValueGaps?.length" class="empty-state">
                  No active FVGs
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-col>

      <!-- Right Panel: Signals & Performance -->
      <v-col cols="12" lg="4">
        <!-- Current Signal -->
        <v-card class="glass-card mb-4" :class="signalCardClass">
          <div class="card-header">
            <v-icon :color="signalIconColor" class="mr-2">mdi-target</v-icon>
            <span>Current Setup</span>
          </div>
          <v-divider class="mx-4 border-opacity-10" />
          <div class="card-content">
            <div v-if="currentAnalysis?.currentSetup?.valid" class="signal-active">
              <div class="signal-header">
                <v-chip
                  :color="currentAnalysis.currentSetup.type === 'long' ? 'success' : 'error'"
                  size="large"
                >
                  {{ currentAnalysis.currentSetup.type.toUpperCase() }}
                </v-chip>
                <div class="signal-confidence">
                  <div class="conf-label">Confidence</div>
                  <div class="conf-value">{{ currentAnalysis.currentSetup.confidence }}%</div>
                </div>
              </div>

              <div class="signal-levels mt-3">
                <div class="level-item entry">
                  <span class="level-label">Entry</span>
                  <span class="level-value">${{ formatPrice(currentAnalysis.currentSetup.entry) }}</span>
                </div>
                <div class="level-item sl">
                  <span class="level-label">Stop Loss</span>
                  <span class="level-value">${{ formatPrice(currentAnalysis.currentSetup.stopLoss) }}</span>
                </div>
                <div class="level-item tp">
                  <span class="level-label">Take Profit</span>
                  <span class="level-value">${{ formatPrice(currentAnalysis.currentSetup.takeProfit) }}</span>
                </div>
              </div>

              <div class="signal-reasons mt-3">
                <div class="reasons-title">Confluence Factors:</div>
                <div
                  v-for="(reason, i) in currentAnalysis.currentSetup.reasons"
                  :key="i"
                  class="reason-item"
                >
                  <v-icon size="12" color="success">mdi-check</v-icon>
                  {{ reason }}
                </div>
              </div>
            </div>

            <div v-else class="signal-inactive">
              <v-icon size="48" color="grey">mdi-target-variant</v-icon>
              <div class="inactive-text">No Active Setup</div>
              <div class="inactive-sub">Waiting for confluence...</div>
            </div>
          </div>
        </v-card>

        <!-- Sell Conditions -->
        <v-card class="glass-card mb-4" v-if="currentAnalysis?.sellConditions?.shouldSell">
          <div class="card-header">
            <v-icon color="warning" class="mr-2">mdi-alert</v-icon>
            <span>Sell Signal Active</span>
          </div>
          <v-divider class="mx-4 border-opacity-10" />
          <div class="card-content">
            <div
              v-for="(reason, i) in currentAnalysis.sellConditions.reasons"
              :key="i"
              class="sell-reason"
            >
              <v-icon size="14" color="warning">mdi-arrow-right</v-icon>
              {{ reason }}
            </div>
          </div>
        </v-card>

        <!-- Performance Metrics -->
        <v-card class="glass-card">
          <div class="card-header">
            <v-icon color="cyan" class="mr-2">mdi-chart-arc</v-icon>
            <span>Performance Metrics</span>
          </div>
          <v-divider class="mx-4 border-opacity-10" />
          <div class="card-content">
            <div class="perf-grid">
              <div class="perf-item">
                <div class="perf-label">Win Rate</div>
                <div class="perf-value" :class="performance?.summary?.winRate >= 50 ? 'text-green' : 'text-red'">
                  {{ performance?.summary?.winRate || 0 }}%
                </div>
              </div>
              <div class="perf-item">
                <div class="perf-label">Total Trades</div>
                <div class="perf-value">{{ performance?.summary?.totalTrades || 0 }}</div>
              </div>
              <div class="perf-item">
                <div class="perf-label">Profit Factor</div>
                <div class="perf-value" :class="performance?.riskMetrics?.profitFactor >= 1 ? 'text-green' : 'text-red'">
                  {{ performance?.riskMetrics?.profitFactor || 0 }}
                </div>
              </div>
              <div class="perf-item">
                <div class="perf-label">Sharpe Ratio</div>
                <div class="perf-value">{{ performance?.riskMetrics?.sharpeRatio || 0 }}</div>
              </div>
              <div class="perf-item">
                <div class="perf-label">Max Drawdown</div>
                <div class="perf-value text-red">
                  ${{ performance?.riskMetrics?.maxDrawdown?.toFixed(2) || 0 }}
                </div>
              </div>
              <div class="perf-item">
                <div class="perf-label">Risk/Reward</div>
                <div class="perf-value">
                  {{ performance?.riskMetrics?.riskRewardRatio || 0 }}
                </div>
              </div>
            </div>

            <v-divider class="my-3 border-opacity-10" />

            <!-- Period Breakdown -->
            <div class="period-breakdown">
              <div class="period-item">
                <span class="period-label">Today</span>
                <span class="period-trades">{{ performance?.periodBreakdown?.today?.trades || 0 }} trades</span>
                <span
                  class="period-profit"
                  :class="(performance?.periodBreakdown?.today?.profit || 0) >= 0 ? 'text-green' : 'text-red'"
                >
                  ${{ performance?.periodBreakdown?.today?.profit?.toFixed(2) || 0 }}
                </span>
              </div>
              <div class="period-item">
                <span class="period-label">This Week</span>
                <span class="period-trades">{{ performance?.periodBreakdown?.week?.trades || 0 }} trades</span>
                <span
                  class="period-profit"
                  :class="(performance?.periodBreakdown?.week?.profit || 0) >= 0 ? 'text-green' : 'text-red'"
                >
                  ${{ performance?.periodBreakdown?.week?.profit?.toFixed(2) || 0 }}
                </span>
              </div>
              <div class="period-item">
                <span class="period-label">This Month</span>
                <span class="period-trades">{{ performance?.periodBreakdown?.month?.trades || 0 }} trades</span>
                <span
                  class="period-profit"
                  :class="(performance?.periodBreakdown?.month?.profit || 0) >= 0 ? 'text-green' : 'text-red'"
                >
                  ${{ performance?.periodBreakdown?.month?.profit?.toFixed(2) || 0 }}
                </span>
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Profit Chart -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card class="glass-card">
          <div class="card-header">
            <v-icon color="green" class="mr-2">mdi-chart-line</v-icon>
            <span>Cumulative Profit</span>
          </div>
          <v-divider class="mx-4 border-opacity-10" />
          <div class="card-content">
            <div class="chart-wrapper">
              <canvas ref="profitChartCanvas"></canvas>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from "vue";
import { Chart, registerables } from "chart.js";
import { useApi } from "~/apis";

Chart.register(...registerables);

const api = useApi();

const symbols = ["BNBUSDT", "BTCUSDT", "SOLUSDT"];
const selectedSymbol = ref("BNBUSDT");
const loading = ref(false);
const error = ref<string | null>(null);
const allAnalysis = ref<any[]>([]);
const performance = ref<any>(null);
const profitChartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const currentAnalysis = computed(() => {
  return allAnalysis.value.find((a) => a.symbol === selectedSymbol.value);
});

const isKillZone = computed(() => {
  return currentAnalysis.value?.isKillZone || false;
});

const signalCardClass = computed(() => {
  if (!currentAnalysis.value?.currentSetup?.valid) return "";
  return currentAnalysis.value.currentSetup.type === "long"
    ? "signal-long"
    : "signal-short";
});

const signalIconColor = computed(() => {
  if (!currentAnalysis.value?.currentSetup?.valid) return "grey";
  return currentAnalysis.value.currentSetup.type === "long" ? "success" : "error";
});

const formatPrice = (price: number | undefined) => {
  if (!price) return "-";
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
};

const getBiasClass = (bias: string | undefined) => {
  if (bias === "bullish") return "text-green";
  if (bias === "bearish") return "text-red";
  return "text-grey";
};

const getConfidenceClass = (conf: number | undefined) => {
  if (!conf) return "text-grey";
  if (conf >= 70) return "text-green";
  if (conf >= 50) return "text-amber";
  return "text-red";
};

const fetchData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const [analysisRes, perfRes] = await Promise.all([
      api.get<any[]>("strategy/ict/analysis"),
      api.get<any>("strategy/performance"),
    ]);
    console.log("ICT Analysis:", analysisRes);
    console.log("Performance:", perfRes);
    allAnalysis.value = analysisRes || [];
    performance.value = perfRes || null;
    updateChart();
  } catch (e: any) {
    console.error("Error fetching ICT data:", e);
    error.value = e?.message || "Failed to fetch data";
  } finally {
    loading.value = false;
  }
};

const refreshData = () => {
  fetchData();
};

const updateChart = () => {
  if (!profitChartCanvas.value || !performance.value?.cumulativeProfits) return;

  if (chartInstance) chartInstance.destroy();

  const data = performance.value.cumulativeProfits || [];
  const labels = data.map((d: any) => d.date);
  const values = data.map((d: any) => d.cumulative);

  const gradient = profitChartCanvas.value
    .getContext("2d")
    ?.createLinearGradient(0, 0, 0, 200);
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
          pointRadius: 3,
          pointBackgroundColor: "#10b981",
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
          callbacks: {
            label: (ctx) => `$${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#94A3B8", maxRotation: 45 },
        },
        y: {
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: {
            color: "#94A3B8",
            callback: (v) => `$${v}`,
          },
        },
      },
    },
  });
};

watch(selectedSymbol, () => {
  // Trigger re-render when symbol changes
});

onMounted(() => {
  fetchData();
  // Auto refresh every 30 seconds
  refreshInterval = setInterval(fetchData, 30000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
  if (chartInstance) chartInstance.destroy();
});
</script>

<style scoped>
.ict-dashboard {
  background: transparent;
  min-height: 100vh;
}

.dashboard-header h1 {
  background: linear-gradient(135deg, #a78bfa, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Glass Card */
.glass-card {
  background: rgba(30, 41, 59, 0.6) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 16px !important;
}

.glass-card.signal-long {
  border-color: rgba(16, 185, 129, 0.3);
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
}

.glass-card.signal-short {
  border-color: rgba(239, 68, 68, 0.3);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.1);
}

.card-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #f1f5f9;
}

.card-content {
  padding: 16px 20px;
}

/* Stat Mini */
.stat-mini {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-mini-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.stat-mini-value {
  font-size: 18px;
  font-weight: 700;
}

/* Structure Card */
.structure-card {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 12px;
  padding: 16px;
}

.structure-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 12px;
}

.structure-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.structure-item:last-child {
  border-bottom: none;
}

.structure-item .label {
  color: #94a3b8;
  font-size: 13px;
}

.structure-item .value {
  font-weight: 600;
  font-size: 13px;
}

/* OB & FVG List */
.ob-list,
.fvg-list {
  max-height: 280px;
  overflow-y: auto;
}

.ob-item,
.fvg-item {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.ob-item.bullish,
.fvg-item.bullish {
  border-left: 3px solid #10b981;
}

.ob-item.bearish,
.fvg-item.bearish {
  border-left: 3px solid #ef4444;
}

.ob-type,
.fvg-type {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
}

.ob-range,
.fvg-range {
  font-size: 12px;
  color: #f1f5f9;
  text-align: right;
}

.ob-meta,
.fvg-meta {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: #64748b;
}

/* Signal Card */
.signal-active {
  text-align: left;
}

.signal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.signal-confidence {
  text-align: right;
}

.conf-label {
  font-size: 11px;
  color: #94a3b8;
}

.conf-value {
  font-size: 24px;
  font-weight: 700;
  color: #10b981;
}

.signal-levels {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.level-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.5);
}

.level-item.entry {
  border-left: 3px solid #60a5fa;
}

.level-item.sl {
  border-left: 3px solid #ef4444;
}

.level-item.tp {
  border-left: 3px solid #10b981;
}

.level-label {
  color: #94a3b8;
  font-size: 12px;
}

.level-value {
  font-weight: 600;
  color: #f1f5f9;
}

.signal-reasons {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  padding: 12px;
}

.reasons-title {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.reason-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #f1f5f9;
  padding: 4px 0;
}

.signal-inactive {
  text-align: center;
  padding: 24px;
}

.inactive-text {
  color: #64748b;
  font-weight: 600;
  margin-top: 12px;
}

.inactive-sub {
  color: #475569;
  font-size: 12px;
}

/* Sell Reason */
.sell-reason {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  color: #fbbf24;
  font-size: 13px;
}

/* Performance Grid */
.perf-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.perf-item {
  text-align: center;
}

.perf-label {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.perf-value {
  font-size: 18px;
  font-weight: 700;
  color: #f1f5f9;
}

/* Period Breakdown */
.period-breakdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.period-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.period-item:last-child {
  border-bottom: none;
}

.period-label {
  color: #94a3b8;
  font-size: 13px;
}

.period-trades {
  color: #64748b;
  font-size: 12px;
}

.period-profit {
  font-weight: 600;
}

/* Chart */
.chart-wrapper {
  height: 200px;
}

/* Colors */
.text-green {
  color: #10b981 !important;
}

.text-red {
  color: #ef4444 !important;
}

.text-amber {
  color: #f59e0b !important;
}

.text-grey {
  color: #94a3b8 !important;
}

/* Rotating Animation */
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

/* Scrollbar */
::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.3);
  border-radius: 2px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 960px) {
  .perf-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
