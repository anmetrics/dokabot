<template>
  <v-card class="pa-4 dark-card" elevation="2">
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <h3 class="text-h6 font-weight-medium text-white">Daily PNL</h3>
      <v-btn small text @click="refresh" :disabled="loading">
        <v-icon :class="{ spin: spinning }" start>mdi-refresh</v-icon>
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

    <!-- Chart -->
    <canvas ref="chartCanvas"></canvas>
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
  spinning.value = true;
  loading.value = true;
  try {
    const res: ProfitItem[] = await api.get("binance/profits");
    profits.value = res || [];
    createChart();
    setTimeout(() => {
      spinning.value = false;
    }, 400);
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

/* Card styling */
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

/* Refresh button */
.refresh-btn {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
  color: #ffffff;
  border-radius: 8px;
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.refresh-btn:hover {
  background: linear-gradient(90deg, #64b5f6 0%, #42a5f5 100%) !important;
  transform: translateY(-2px);
}

/* Text styling */
.text-grey {
  color: rgba(200, 200, 200, 0.7);
}

.text-success {
  color: #00e676 !important;
}

.text-error {
  color: #ff5252 !important;
}

/* Loading animation */
:deep(.v-progress-circular) {
  color: #4fc3f7;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .dark-card {
    padding: 16px;
  }
  .text-h4 {
    font-size: 1.5rem !important;
  }
  .text-h5 {
    font-size: 1.25rem !important;
  }
}

/* Scrollbar styling */
:deep(.v-card::-webkit-scrollbar) {
  width: 8px;
}

:deep(.v-card::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

:deep(.v-card::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
}
</style>
