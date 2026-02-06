<template>
  <v-container fluid class="volume-dashboard pa-4">
    <!-- Header -->
    <div class="dashboard-header mb-4">
      <div class="d-flex align-center justify-space-between flex-wrap ga-3">
        <div>
          <h1 class="text-h5 font-weight-bold text-white mb-1">
            Volume Resistance Analysis
          </h1>
          <p class="text-body-2 text-grey">
            Volume Profile &bull; Resistance/Support Levels &bull; Breakout
            Probability
          </p>
        </div>
        <div class="d-flex align-center ga-2">
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
          <v-btn-toggle v-model="selectedTimeframe" mandatory density="compact">
            <v-btn value="1h" size="small">1H</v-btn>
            <v-btn value="4h" size="small">4H</v-btn>
          </v-btn-toggle>
          <v-btn icon size="small" @click="fetchData">
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

    <!-- Loading -->
    <div v-if="loading && !analysis" class="text-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-if="analysis">
      <!-- Quick Stats Row -->
      <v-row class="mb-4">
        <v-col cols="6" sm="3">
          <div class="stat-mini">
            <div class="stat-mini-label">Current Price</div>
            <div class="stat-mini-value text-white">
              ${{ formatPrice(analysis.currentPrice) }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="stat-mini">
            <div class="stat-mini-label">Next Resistance</div>
            <div class="stat-mini-value text-red">
              {{
                analysis.nextResistance
                  ? "$" + formatPrice(analysis.nextResistance.priceZoneCenter)
                  : "-"
              }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="stat-mini">
            <div class="stat-mini-label">Breakout Probability</div>
            <div
              class="stat-mini-value"
              :class="getBreakoutClass(analysis.nextResistance?.breakoutProbability)"
            >
              {{
                analysis.nextResistance
                  ? analysis.nextResistance.breakoutProbability.toFixed(1) + "%"
                  : "-"
              }}
            </div>
          </div>
        </v-col>
        <v-col cols="6" sm="3">
          <div class="stat-mini">
            <div class="stat-mini-label">POC</div>
            <div class="stat-mini-value text-amber">
              ${{ formatPrice(analysis.pointOfControl) }}
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Main Content -->
      <v-row>
        <!-- Left: Volume Profile Chart -->
        <v-col cols="12" lg="8">
          <v-card class="glass-card mb-4">
            <div class="card-header">
              <v-icon color="primary" class="mr-2"
                >mdi-chart-bar-stacked</v-icon
              >
              <span>Volume Profile</span>
              <v-chip size="x-small" class="ml-auto">
                {{ analysis.analyzedCandles }} candles
              </v-chip>
            </div>
            <v-divider class="mx-4 border-opacity-10" />
            <div class="card-content">
              <div class="chart-wrapper">
                <canvas ref="volumeChartCanvas"></canvas>
              </div>
            </div>
          </v-card>

          <!-- Value Area Info -->
          <v-card class="glass-card mb-4">
            <div class="card-header">
              <v-icon color="cyan" class="mr-2">mdi-arrow-expand-vertical</v-icon>
              <span>Value Area (70% Volume)</span>
            </div>
            <v-divider class="mx-4 border-opacity-10" />
            <div class="card-content">
              <div class="va-row">
                <div class="va-item">
                  <span class="va-label">Value Area High</span>
                  <span class="va-value text-red"
                    >${{ formatPrice(analysis.valueAreaHigh) }}</span
                  >
                </div>
                <div class="va-item">
                  <span class="va-label">POC (Point of Control)</span>
                  <span class="va-value text-amber"
                    >${{ formatPrice(analysis.pointOfControl) }}</span
                  >
                </div>
                <div class="va-item">
                  <span class="va-label">Value Area Low</span>
                  <span class="va-value text-green"
                    >${{ formatPrice(analysis.valueAreaLow) }}</span
                  >
                </div>
                <div class="va-item">
                  <span class="va-label">Next Support</span>
                  <span class="va-value text-green">
                    {{
                      analysis.nextSupport
                        ? "$" + formatPrice(analysis.nextSupport.priceZoneCenter)
                        : "-"
                    }}
                  </span>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Right: Next Resistance Detail + Breakout Factors -->
        <v-col cols="12" lg="4">
          <!-- Next Resistance Card -->
          <v-card class="glass-card mb-4 resistance-highlight">
            <div class="card-header">
              <v-icon color="red" class="mr-2">mdi-shield-alert</v-icon>
              <span>Next Resistance</span>
            </div>
            <v-divider class="mx-4 border-opacity-10" />
            <div class="card-content">
              <template v-if="analysis.nextResistance">
                <div class="nr-price">
                  ${{
                    formatPrice(analysis.nextResistance.priceZoneCenter)
                  }}
                </div>
                <div class="nr-range">
                  ${{ formatPrice(analysis.nextResistance.priceZoneLow) }} -
                  ${{ formatPrice(analysis.nextResistance.priceZoneHigh) }}
                </div>

                <div class="nr-stats mt-3">
                  <div class="nr-stat">
                    <span class="nr-stat-label">Strength</span>
                    <span class="nr-stat-value">{{
                      analysis.nextResistance.strength.toFixed(1)
                    }}%</span>
                  </div>
                  <div class="nr-stat">
                    <span class="nr-stat-label">Sell Dominance</span>
                    <span class="nr-stat-value text-red">{{
                      analysis.nextResistance.sellDominance.toFixed(1)
                    }}%</span>
                  </div>
                  <div class="nr-stat">
                    <span class="nr-stat-label">Times Tested</span>
                    <span class="nr-stat-value">{{
                      analysis.nextResistance.timesTestedCount
                    }}</span>
                  </div>
                  <div class="nr-stat">
                    <span class="nr-stat-label">Distance</span>
                    <span class="nr-stat-value">{{
                      analysis.nextResistance.distanceFromCurrentPrice.toFixed(2)
                    }}%</span>
                  </div>
                </div>

                <v-divider class="my-3 border-opacity-10" />

                <div class="breakout-big">
                  <div class="breakout-label">Breakout Probability</div>
                  <div
                    class="breakout-value"
                    :class="getBreakoutClass(analysis.nextResistance.breakoutProbability)"
                  >
                    {{
                      analysis.nextResistance.breakoutProbability.toFixed(1)
                    }}%
                  </div>
                </div>
              </template>
              <div v-else class="empty-state">
                <v-icon size="48" color="grey">mdi-shield-check</v-icon>
                <div class="mt-2">No resistance above current price</div>
              </div>
            </div>
          </v-card>

          <!-- Breakout Factors Card -->
          <v-card
            class="glass-card mb-4"
            v-if="analysis.nextResistance?.breakoutFactors"
          >
            <div class="card-header">
              <v-icon color="amber" class="mr-2">mdi-chart-donut</v-icon>
              <span>Breakout Factors</span>
            </div>
            <v-divider class="mx-4 border-opacity-10" />
            <div class="card-content">
              <div class="factor-list">
                <div class="factor-item">
                  <div class="factor-info">
                    <span class="factor-label">Volume Momentum</span>
                    <span class="factor-score">{{
                      analysis.nextResistance.breakoutFactors.volumeMomentumScore.toFixed(0)
                    }}</span>
                  </div>
                  <div class="factor-bar">
                    <div
                      class="factor-fill"
                      :style="{
                        width:
                          analysis.nextResistance.breakoutFactors.volumeMomentumScore + '%',
                      }"
                      :class="getBarClass(analysis.nextResistance.breakoutFactors.volumeMomentumScore)"
                    ></div>
                  </div>
                </div>
                <div class="factor-item">
                  <div class="factor-info">
                    <span class="factor-label">Test Count</span>
                    <span class="factor-score">{{
                      analysis.nextResistance.breakoutFactors.testCountScore.toFixed(0)
                    }}</span>
                  </div>
                  <div class="factor-bar">
                    <div
                      class="factor-fill"
                      :style="{
                        width:
                          analysis.nextResistance.breakoutFactors.testCountScore + '%',
                      }"
                      :class="getBarClass(analysis.nextResistance.breakoutFactors.testCountScore)"
                    ></div>
                  </div>
                </div>
                <div class="factor-item">
                  <div class="factor-info">
                    <span class="factor-label">Volume Trend</span>
                    <span class="factor-score">{{
                      analysis.nextResistance.breakoutFactors.volumeTrendScore.toFixed(0)
                    }}</span>
                  </div>
                  <div class="factor-bar">
                    <div
                      class="factor-fill"
                      :style="{
                        width:
                          analysis.nextResistance.breakoutFactors.volumeTrendScore + '%',
                      }"
                      :class="getBarClass(analysis.nextResistance.breakoutFactors.volumeTrendScore)"
                    ></div>
                  </div>
                </div>
                <div class="factor-item">
                  <div class="factor-info">
                    <span class="factor-label">Buy/Sell Ratio</span>
                    <span class="factor-score">{{
                      analysis.nextResistance.breakoutFactors.buySellRatioScore.toFixed(0)
                    }}</span>
                  </div>
                  <div class="factor-bar">
                    <div
                      class="factor-fill"
                      :style="{
                        width:
                          analysis.nextResistance.breakoutFactors.buySellRatioScore + '%',
                      }"
                      :class="getBarClass(analysis.nextResistance.breakoutFactors.buySellRatioScore)"
                    ></div>
                  </div>
                </div>
                <div class="factor-item">
                  <div class="factor-info">
                    <span class="factor-label">Distance</span>
                    <span class="factor-score">{{
                      analysis.nextResistance.breakoutFactors.distanceScore.toFixed(0)
                    }}</span>
                  </div>
                  <div class="factor-bar">
                    <div
                      class="factor-fill"
                      :style="{
                        width:
                          analysis.nextResistance.breakoutFactors.distanceScore + '%',
                      }"
                      :class="getBarClass(analysis.nextResistance.breakoutFactors.distanceScore)"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </v-card>

          <!-- Next Support Card -->
          <v-card class="glass-card" v-if="analysis.nextSupport">
            <div class="card-header">
              <v-icon color="green" class="mr-2">mdi-shield-check</v-icon>
              <span>Next Support</span>
            </div>
            <v-divider class="mx-4 border-opacity-10" />
            <div class="card-content">
              <div class="nr-price text-green">
                ${{ formatPrice(analysis.nextSupport.priceZoneCenter) }}
              </div>
              <div class="nr-range">
                ${{ formatPrice(analysis.nextSupport.priceZoneLow) }} -
                ${{ formatPrice(analysis.nextSupport.priceZoneHigh) }}
              </div>
              <div class="nr-stats mt-3">
                <div class="nr-stat">
                  <span class="nr-stat-label">Strength</span>
                  <span class="nr-stat-value">{{
                    analysis.nextSupport.strength.toFixed(1)
                  }}%</span>
                </div>
                <div class="nr-stat">
                  <span class="nr-stat-label">Buy Dominance</span>
                  <span class="nr-stat-value text-green">{{
                    analysis.nextSupport.buyDominance.toFixed(1)
                  }}%</span>
                </div>
                <div class="nr-stat">
                  <span class="nr-stat-label">Times Tested</span>
                  <span class="nr-stat-value">{{
                    analysis.nextSupport.timesTestedCount
                  }}</span>
                </div>
                <div class="nr-stat">
                  <span class="nr-stat-label">Distance</span>
                  <span class="nr-stat-value">{{
                    analysis.nextSupport.distanceFromCurrentPrice.toFixed(2)
                  }}%</span>
                </div>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Resistance Levels Table -->
      <v-row class="mt-4">
        <v-col cols="12">
          <v-card class="glass-card">
            <div class="card-header">
              <v-icon color="red" class="mr-2">mdi-format-list-numbered</v-icon>
              <span>Resistance Levels</span>
              <v-chip size="x-small" class="ml-auto">
                {{ analysis.resistanceLevels.length }}
              </v-chip>
            </div>
            <v-divider class="mx-4 border-opacity-10" />
            <div class="card-content table-scroll">
              <table class="levels-table" v-if="analysis.resistanceLevels.length">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Price Zone</th>
                    <th>Strength</th>
                    <th>Sell Dom.</th>
                    <th>Tests</th>
                    <th>Distance</th>
                    <th>Breakout %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, i) in analysis.resistanceLevels"
                    :key="i"
                    :class="{
                      'next-level':
                        analysis.nextResistance &&
                        r.priceZoneCenter ===
                          analysis.nextResistance.priceZoneCenter,
                    }"
                  >
                    <td>{{ i + 1 }}</td>
                    <td>
                      ${{ formatPrice(r.priceZoneLow) }} - ${{
                        formatPrice(r.priceZoneHigh)
                      }}
                    </td>
                    <td>
                      <span class="strength-badge">{{
                        r.strength.toFixed(1)
                      }}</span>
                    </td>
                    <td class="text-red">{{ r.sellDominance.toFixed(1) }}%</td>
                    <td>{{ r.timesTestedCount }}</td>
                    <td>{{ r.distanceFromCurrentPrice.toFixed(2) }}%</td>
                    <td>
                      <span
                        class="prob-badge"
                        :class="getBreakoutClass(r.breakoutProbability)"
                      >
                        {{ r.breakoutProbability.toFixed(1) }}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="empty-state">
                No resistance levels identified
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Support Levels Table -->
      <v-row class="mt-4">
        <v-col cols="12">
          <v-card class="glass-card">
            <div class="card-header" @click="showSupport = !showSupport" style="cursor: pointer">
              <v-icon color="green" class="mr-2">mdi-format-list-numbered</v-icon>
              <span>Support Levels</span>
              <v-chip size="x-small" class="ml-2">
                {{ analysis.supportLevels.length }}
              </v-chip>
              <v-icon class="ml-auto">{{
                showSupport ? "mdi-chevron-up" : "mdi-chevron-down"
              }}</v-icon>
            </div>
            <template v-if="showSupport">
              <v-divider class="mx-4 border-opacity-10" />
              <div class="card-content table-scroll">
                <table
                  class="levels-table"
                  v-if="analysis.supportLevels.length"
                >
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Price Zone</th>
                      <th>Strength</th>
                      <th>Buy Dom.</th>
                      <th>Tests</th>
                      <th>Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(s, i) in analysis.supportLevels"
                      :key="i"
                      :class="{
                        'next-level':
                          analysis.nextSupport &&
                          s.priceZoneCenter ===
                            analysis.nextSupport.priceZoneCenter,
                      }"
                    >
                      <td>{{ i + 1 }}</td>
                      <td>
                        ${{ formatPrice(s.priceZoneLow) }} - ${{
                          formatPrice(s.priceZoneHigh)
                        }}
                      </td>
                      <td>
                        <span class="strength-badge">{{
                          s.strength.toFixed(1)
                        }}</span>
                      </td>
                      <td class="text-green">
                        {{ s.buyDominance.toFixed(1) }}%
                      </td>
                      <td>{{ s.timesTestedCount }}</td>
                      <td>{{ s.distanceFromCurrentPrice.toFixed(2) }}%</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="empty-state">
                  No support levels identified
                </div>
              </div>
            </template>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from "vue";
import { Chart, registerables } from "chart.js";
import { useApi } from "~/apis";

Chart.register(...registerables);

const api = useApi();

const symbols = ["BNBUSDT", "BTCUSDT", "SOLUSDT"];
const selectedSymbol = ref("BTCUSDT");
const selectedTimeframe = ref<"1h" | "4h">("1h");
const loading = ref(false);
const error = ref<string | null>(null);
const analysis = ref<any>(null);
const showSupport = ref(false);
const volumeChartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

const formatPrice = (price: number | undefined) => {
  if (!price) return "-";
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
};

const getBreakoutClass = (prob: number | undefined) => {
  if (!prob) return "text-grey";
  if (prob >= 60) return "text-green";
  if (prob >= 40) return "text-amber";
  return "text-red";
};

const getBarClass = (score: number) => {
  if (score >= 60) return "bar-green";
  if (score >= 40) return "bar-amber";
  return "bar-red";
};

const fetchData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const res = await api.get<any>(
      `strategy/volume/analysis/${selectedSymbol.value}`,
      { timeframe: selectedTimeframe.value },
    );
    analysis.value = res;
    updateChart();
  } catch (e: any) {
    error.value = e?.message || "Failed to fetch volume analysis";
  } finally {
    loading.value = false;
  }
};

const updateChart = () => {
  if (!volumeChartCanvas.value || !analysis.value?.volumeProfile?.length)
    return;

  if (chartInstance) chartInstance.destroy();

  const bins = analysis.value.volumeProfile;
  const currentPrice = analysis.value.currentPrice;
  const poc = analysis.value.pointOfControl;
  const vaHigh = analysis.value.valueAreaHigh;
  const vaLow = analysis.value.valueAreaLow;

  const labels = bins.map((b: any) => formatPrice(b.priceLevel));

  // Color bins based on their role
  const buyColors = bins.map((b: any) => {
    if (
      Math.abs(b.priceLevel - poc) <
      (bins[1]?.priceLevel - bins[0]?.priceLevel || 1)
    )
      return "rgba(251, 191, 36, 0.8)"; // POC = amber
    if (b.priceLevel >= vaLow && b.priceLevel <= vaHigh)
      return "rgba(16, 185, 129, 0.6)"; // VA = green
    return "rgba(16, 185, 129, 0.3)"; // outside VA = dim green
  });

  const sellColors = bins.map((b: any) => {
    if (
      Math.abs(b.priceLevel - poc) <
      (bins[1]?.priceLevel - bins[0]?.priceLevel || 1)
    )
      return "rgba(251, 191, 36, 0.6)"; // POC
    if (b.priceLevel >= vaLow && b.priceLevel <= vaHigh)
      return "rgba(239, 68, 68, 0.6)"; // VA
    return "rgba(239, 68, 68, 0.3)"; // outside VA
  });

  // Find current price index for annotation
  let currentPriceLabel = "";
  let minDist = Infinity;
  for (const b of bins) {
    const dist = Math.abs(b.priceLevel - currentPrice);
    if (dist < minDist) {
      minDist = dist;
      currentPriceLabel = formatPrice(b.priceLevel);
    }
  }

  chartInstance = new Chart(volumeChartCanvas.value, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Buy Volume",
          data: bins.map((b: any) => b.buyVolume),
          backgroundColor: buyColors,
          borderWidth: 0,
          barPercentage: 0.95,
          categoryPercentage: 1.0,
        },
        {
          label: "Sell Volume",
          data: bins.map((b: any) => b.sellVolume),
          backgroundColor: sellColors,
          borderWidth: 0,
          barPercentage: 0.95,
          categoryPercentage: 1.0,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "#94A3B8",
            font: { size: 11 },
            usePointStyle: true,
            pointStyle: "rect",
          },
        },
        tooltip: {
          backgroundColor: "rgba(30, 41, 59, 0.95)",
          titleColor: "#F1F5F9",
          bodyColor: "#F1F5F9",
          borderColor: "#a78bfa",
          borderWidth: 1,
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx !== undefined) {
                const bin = bins[idx];
                return `$${formatPrice(bin.priceLevel)}`;
              }
              return "";
            },
            label: (ctx) => {
              const val = ctx.parsed.x;
              return `${ctx.dataset.label}: ${val.toFixed(2)}`;
            },
            afterBody: (items) => {
              const idx = items[0]?.dataIndex;
              if (idx !== undefined) {
                const bin = bins[idx];
                const lines = [
                  `Buy Ratio: ${(bin.buyRatio * 100).toFixed(1)}%`,
                  `Sell Ratio: ${(bin.sellRatio * 100).toFixed(1)}%`,
                ];
                if (bin.isHVN) lines.push("** High Volume Node **");
                return lines;
              }
              return [];
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: "rgba(255,255,255,0.05)" },
          ticks: { color: "#94A3B8", font: { size: 10 } },
        },
        y: {
          stacked: true,
          grid: { color: "rgba(255,255,255,0.03)" },
          ticks: {
            color: (ctx) => {
              const label = ctx.tick?.label as string;
              if (label === currentPriceLabel) return "#60a5fa";
              return "#94A3B8";
            },
            font: (ctx) => {
              const label = ctx.tick?.label as string;
              if (label === currentPriceLabel)
                return { size: 11, weight: "bold" as const };
              return { size: 9 };
            },
            autoSkip: true,
            maxTicksLimit: 30,
          },
        },
      },
    },
  });
};

watch([selectedSymbol, selectedTimeframe], () => {
  fetchData();
});

onMounted(() => {
  fetchData();
  refreshInterval = setInterval(fetchData, 60000);
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
  if (chartInstance) chartInstance.destroy();
});
</script>

<style scoped>
.volume-dashboard {
  background: transparent;
  min-height: 100vh;
}

.dashboard-header h1 {
  background: linear-gradient(135deg, #a78bfa, #f87171);
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

.resistance-highlight {
  border-color: rgba(239, 68, 68, 0.2);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.05);
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

/* Value Area Row */
.va-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.va-item {
  text-align: center;
}

.va-label {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.va-value {
  font-size: 16px;
  font-weight: 700;
}

/* Next Resistance */
.nr-price {
  font-size: 28px;
  font-weight: 800;
  color: #ef4444;
  text-align: center;
}

.nr-range {
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
  margin-top: 4px;
}

.nr-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.nr-stat {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
  padding: 10px;
  text-align: center;
}

.nr-stat-label {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.nr-stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
}

/* Breakout Big */
.breakout-big {
  text-align: center;
}

.breakout-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.breakout-value {
  font-size: 32px;
  font-weight: 800;
}

/* Factor Bars */
.factor-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.factor-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.factor-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.factor-label {
  font-size: 12px;
  color: #94a3b8;
}

.factor-score {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
}

.factor-bar {
  height: 6px;
  background: rgba(15, 23, 42, 0.8);
  border-radius: 3px;
  overflow: hidden;
}

.factor-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.factor-fill.bar-green {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.factor-fill.bar-amber {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.factor-fill.bar-red {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

/* Levels Table */
.table-scroll {
  overflow-x: auto;
}

.levels-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.levels-table th {
  padding: 10px 12px;
  text-align: left;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.levels-table td {
  padding: 10px 12px;
  color: #f1f5f9;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.levels-table tr:hover {
  background: rgba(167, 139, 250, 0.05);
}

.levels-table tr.next-level {
  background: rgba(239, 68, 68, 0.08);
  border-left: 3px solid #ef4444;
}

.strength-badge {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

.prob-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

/* Chart */
.chart-wrapper {
  height: 500px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 24px;
  color: #64748b;
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
  height: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.3);
  border-radius: 2px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 960px) {
  .va-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .nr-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-wrapper {
    height: 400px;
  }
}

@media (max-width: 600px) {
  .va-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .stat-mini-value {
    font-size: 15px;
  }

  .nr-price {
    font-size: 22px;
  }

  .breakout-value {
    font-size: 24px;
  }

  .chart-wrapper {
    height: 350px;
  }

  .levels-table {
    font-size: 11px;
  }

  .levels-table th,
  .levels-table td {
    padding: 8px 6px;
  }
}
</style>
