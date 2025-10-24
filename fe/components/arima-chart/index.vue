<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>ARIMA Forecast</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="4">
                <h3>BTCUSDT</h3>
                <canvas ref="btcChart" height="200"></canvas>
              </v-col>
              <v-col cols="4">
                <h3>BNBUSDT</h3>
                <canvas ref="bnbChart" height="200"></canvas>
              </v-col>
              <v-col cols="4">
                <h3>SOLUSDT</h3>
                <canvas ref="solChart" height="200"></canvas>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <v-progress-circular v-if="loading" indeterminate color="primary" />
    <v-alert v-if="error" type="error">{{ error }}</v-alert>
  </v-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import Chart from "chart.js/auto";
import ARIMA from "arima";

const loading = ref(true);
const error = ref(null);
const btcChart = ref(null);
const bnbChart = ref(null);
const solChart = ref(null);
let btcChartInstance = null;
let bnbChartInstance = null;
let solChartInstance = null;

const chartOptions = {
  responsive: true,
  plugins: { legend: { position: "top" } },
  scales: {
    x: { title: { display: true, text: "Time" } },
    y: { title: { display: true, text: "Price (USDT)" } },
  },
};

const fetchKlines = async (symbol) => {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`;
  const response = await $fetch(url);
  return response.map((kline) => parseFloat(kline[4])); // Close price
};

const runArima = (prices) => {
  const arima = new ARIMA({ p: 2, d: 1, q: 2, verbose: false }).train(prices);
  const [pred] = arima.predict(48); // Forecast 24 hours
  return pred;
};

onMounted(async () => {
  try {
    const [btcPrices, bnbPrices, solPrices] = await Promise.all([
      fetchKlines("BTCUSDT"),
      fetchKlines("BNBUSDT"),
      fetchKlines("SOLUSDT"),
    ]);

    const btcForecast = runArima(btcPrices);
    const bnbForecast = runArima(bnbPrices);
    const solForecast = runArima(solPrices);

    const labels = [
      ...Array(btcPrices.length)
        .fill()
        .map((_, i) => `T-${btcPrices.length - i - 1}`),
      ...Array(48)
        .fill()
        .map((_, i) => `F${i + 1}`),
    ];

    // BTC Chart
    btcChartInstance = new Chart(btcChart.value, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "BTC Historical",
            data: [...btcPrices, ...Array(48).fill(null)],
            borderColor: "#42A5F5",
            backgroundColor: "rgba(66, 165, 245, 0.2)",
            fill: true,
          },
          {
            label: "BTC Forecast",
            data: [...Array(btcPrices.length).fill(null), ...btcForecast],
            borderColor: "#EF5350",
            borderDash: [5, 5],
          },
        ],
      },
      options: chartOptions,
    });

    // BNB Chart
    bnbChartInstance = new Chart(bnbChart.value, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "BNB Historical",
            data: [...bnbPrices, ...Array(48).fill(null)],
            borderColor: "#66BB6A",
            backgroundColor: "rgba(102, 187, 106, 0.2)",
            fill: true,
          },
          {
            label: "BNB Forecast",
            data: [...Array(bnbPrices.length).fill(null), ...bnbForecast],
            borderColor: "#FFA726",
            borderDash: [5, 5],
          },
        ],
      },
      options: chartOptions,
    });

    // SOL Chart
    solChartInstance = new Chart(solChart.value, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "SOL Historical",
            data: [...solPrices, ...Array(24).fill(null)],
            borderColor: "#AB47BC",
            backgroundColor: "rgba(171, 71, 188, 0.2)",
            fill: true,
          },
          {
            label: "SOL Forecast",
            data: [...Array(solPrices.length).fill(null), ...solForecast],
            borderColor: "#7C4DFF",
            borderDash: [5, 5],
          },
        ],
      },
      options: chartOptions,
    });

    loading.value = false;
  } catch (err) {
    error.value = `Error: ${err.message}`;
    loading.value = false;
  }
});

onUnmounted(() => {
  if (btcChartInstance) btcChartInstance.destroy();
  if (bnbChartInstance) bnbChartInstance.destroy();
  if (solChartInstance) solChartInstance.destroy();
});
</script>
