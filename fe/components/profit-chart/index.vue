<template>
  <v-card class="pa-4 dark-card" elevation="2">
    <div class="d-flex justify-space-between align-center mb-4">
      <h3 class="text-h6 font-weight-medium text-white">Daily PNL</h3>
      <v-btn small text @click="refresh">Làm mới</v-btn>
    </div>

    <div
      v-if="loading"
      class="d-flex justify-center align-center"
      style="height: 300px"
    >
      <v-progress-circular indeterminate color="primary" size="50" />
    </div>

    <canvas ref="chartCanvas"></canvas>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
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
const loading = ref(false); // thêm loading
const api = useApi();

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
          pointRadius: 5,
          pointHoverRadius: 7,
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
  loading.value = true; // bật loading
  try {
    const res: ProfitItem[] = await api.get("binance/profits");
    profits.value = res || [];
    createChart();
  } catch (err) {
    console.error("Lỗi fetch profits:", err);
  } finally {
    loading.value = false; // tắt loading
  }
}

onMounted(fetchProfits);

const refresh = () => {
  fetchProfits();
};
</script>

<style scoped>
.dark-card {
  background-color: #1e1e2f;
  color: #ffffff;
  border-radius: 12px;
}
</style>
