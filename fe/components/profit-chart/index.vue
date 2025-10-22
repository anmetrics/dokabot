<template>
  <v-card class="pa-4 dark-card" elevation="2">
    <div class="d-flex justify-space-between align-center mb-4">
      <h3 class="text-h6 font-weight-medium text-white">Tổng lợi nhuận</h3>
      <v-btn small text @click="refresh">Làm mới</v-btn>
    </div>
    <canvas ref="chartCanvas"></canvas>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

// Dữ liệu mẫu
const profits = ref([
  { date: "2025-10-16", totalProfit: 12 },
  { date: "2025-10-17", totalProfit: -5 },
  { date: "2025-10-18", totalProfit: 8 },
  { date: "2025-10-19", totalProfit: 20 },
  { date: "2025-10-20", totalProfit: -2 },
]);

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

onMounted(() => {
  createChart();
});

const refresh = () => {
  // có thể fetch API mới ở đây
  console.log("Làm mới chart...");
  createChart();
};
</script>

<style scoped>
.dark-card {
  background-color: #1e1e2f;
  color: #ffffff;
  border-radius: 12px;
}
</style>
