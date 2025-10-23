<template>
  <v-card class="pa-4 dark-card" elevation="2">
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <h3 class="text-h6 font-weight-medium text-white">Daily PNL</h3>
      <v-btn small text @click="refresh" :disabled="loading">
        <v-icon start>mdi-refresh</v-icon>
        Làm mới
      </v-btn>
    </div>

    <!-- Tổng PNL -->
    <div class="text-center mb-4">
      <div class="text-grey text-subtitle-2 mb-1">Tổng lợi nhuận</div>
      <div
        :class="[
          'text-h5 font-weight-bold',
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

    <!-- Loading -->
    <div
      v-if="loading"
      class="d-flex justify-center align-center"
      style="height: 300px"
    >
      <v-progress-circular indeterminate color="primary" size="50" />
    </div>

    <!-- Chart -->
    <canvas v-show="!loading" ref="chartCanvas"></canvas>
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
const loading = ref(false);
const api = useApi();

// 👉 Tính tổng lợi nhuận
const totalPNL = computed(() =>
  profits.value.reduce((sum, p) => sum + p.totalProfit, 0)
);

const createChart = () => {
  if (!chartCanvas.value) return;
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(chartCanvas.value, {
    type: "line",
    data: {
      labels: profits.value.map((p) => p.date),
      datasets: [
        {
          label: "Lợi nhuận (USDT)",
          data: profits.value.map((p) => p.totalProfit),
          borderColor: "#0EB3E8",
          backgroundColor: "rgba(14, 179, 232, 0.2)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: "#0EB3E8",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#FFFFFF" } },
        tooltip: {
          backgroundColor: "#2A2A3A",
          titleColor: "#FFFFFF",
          bodyColor: "#FFFFFF",
          callbacks: {
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
          ticks: { color: "#FFFFFF" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
};

async function fetchProfits() {
  loading.value = true;
  try {
    const res: ProfitItem[] = await api.get("binance/profits");
    profits.value = res || [];
    createChart();
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
.dark-card {
  background-color: #1e1e2f;
  color: #ffffff;
  border-radius: 12px;
}

.text-success {
  color: #4caf50 !important;
}

.text-error {
  color: #f44336 !important;
}
</style>
