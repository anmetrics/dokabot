<template>
  <v-card class="pa-4 dark-card" elevation="2">
    <!-- Header -->
    <div
      class="d-flex justify-space-between align-center mb-4 header-container"
    >
      <h3 class="text-h6 font-weight-medium text-white mb-2 mb-sm-0">
        Daily PNL
      </h3>
      <div class="d-flex align-center header-actions">
        <v-select
          v-model="selectedPeriod"
          :items="periodOptions"
          item-title="label"
          item-value="value"
          dense
          outlined
          dark
          class="period-selector mr-4"
          @update:modelValue="fetchProfits"
        ></v-select>
        <v-btn
          small
          text
          class="refresh-btn"
          @click="refresh"
          :disabled="loading"
        >
          <v-icon :class="{ spin: spinning }" start>mdi-refresh</v-icon>
          Làm mới
        </v-btn>
      </div>
    </div>

    <!-- Tổng PNL -->
    <div class="text-center mb-4">
      <div class="text-grey text-subtitle-2 mb-1">Tổng lợi nhuận</div>
      <div
        :class="[
          'text-h5 font-weight-bold total-pnl',
          totalPNL > 0
            ? 'text-success'
            : totalPNL < 0
            ? 'text-error'
            : 'text-white',
        ]"
      >
        {{ totalPNL.toFixed(2) }} USDT
      </div>
    </div>

    <!-- Chart -->
    <div class="chart-wrapper">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Chart, registerables } from "chart.js";
import { useApi } from "~/apis";

Chart.register(...registerables);

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

interface ProfitItem {
  date: string;
  totalProfit: number;
}

const profits = ref<ProfitItem[]>([]);
const spinning = ref(false);
const loading = ref(false);
const api = useApi();

const periodOptions = [
  { label: "1 tháng", value: "1M" },
  { label: "3 tháng", value: "3M" },
  { label: "6 tháng", value: "6M" },
  { label: "1 năm", value: "1Y" },
];
const selectedPeriod = ref("3M");

const totalPNL = computed(() =>
  profits.value.reduce((sum, p) => sum + p.totalProfit, 0)
);

const createChart = () => {
  if (!chartCanvas.value) return;
  if (chartInstance) chartInstance.destroy();

  const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });

  chartInstance = new Chart(chartCanvas.value, {
    type: "bar",
    data: {
      labels: profits.value.map((p) => dateFormatter.format(new Date(p.date))),
      datasets: [
        {
          label: "Lợi nhuận (USDT)",
          data: profits.value.map((p) => p.totalProfit),
          backgroundColor: profits.value.map((p) =>
            p.totalProfit >= 0
              ? "rgba(0, 230, 118, 0.6)"
              : "rgba(255, 82, 82, 0.6)"
          ),
          borderColor: profits.value.map((p) =>
            p.totalProfit >= 0 ? "#00E676" : "#FF5252"
          ),
          borderWidth: 1,
          borderRadius: 4,
          barThickness: 20,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#FFFFFF" } },
        tooltip: {
          backgroundColor: "#2A2A3A",
          titleColor: "#FFFFFF",
          bodyColor: "#FFFFFF",
          callbacks: {
            title: (items) =>
              dateFormatter.format(new Date(items[0].label || "")),
            label: (context) =>
              ` ${context.dataset.label}: ${context?.parsed?.y?.toFixed(
                2
              )} USDT`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#FFFFFF" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: {
            color: "#FFFFFF",
            callback: (value) => `${value} USDT`,
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
};

async function fetchProfits() {
  spinning.value = true;
  loading.value = true;
  try {
    const res: ProfitItem[] = await api.get("binance/profits", {
      params: { period: selectedPeriod.value },
    });
    profits.value = res || [];
    createChart();
    setTimeout(() => (spinning.value = false), 400);
  } catch (err) {
    console.error("Lỗi fetch profits:", err);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchProfits);
const refresh = () => fetchProfits();
</script>

<style scoped>
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.dark-card {
  background: linear-gradient(135deg, #070d14 0%, #0e141c 100%);
  color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.dark-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(30, 136, 229, 0.2);
}

.text-grey {
  color: rgba(200, 200, 200, 0.7);
}
.text-success {
  color: #00e676 !important;
}
.text-error {
  color: #ff5252 !important;
}

.period-selector {
  max-width: 120px;
  background-color: rgba(255, 255, 255, 0.1);
}
.period-selector :deep(.v-field) {
  color: #ffffff;
}
.period-selector :deep(.v-select__selection) {
  color: #ffffff;
}

.refresh-btn {
  color: #e4f7ff !important;
  text-transform: none;
  font-weight: 500;
  transition: all 0.2s ease;
}
.refresh-btn:hover {
  color: #afd3f1 !important;
}

/* Chart wrapper responsive height */
.chart-wrapper {
  width: 100%;
  height: 280px;
}
@media (max-width: 600px) {
  .chart-wrapper {
    height: 200px;
  }
}

/* Responsive header layout */
@media (max-width: 600px) {
  .header-container {
    flex-direction: column;
    align-items: flex-start;
  }
  .header-actions {
    width: 100%;
    justify-content: space-between;
    margin-top: 8px;
  }
  .period-selector {
    max-width: unset;
    flex: 1;
    margin-right: 8px;
  }
  .refresh-btn {
    font-size: 13px;
    padding: 4px 8px;
  }
  .total-pnl {
    font-size: 1.1rem !important;
  }
  .dark-card {
    padding: 16px !important;
  }
}
</style>
