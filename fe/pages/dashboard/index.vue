<template>
  <v-app>
    <v-container fluid class="pa-6">
      <h2 class="mb-6">Realtime Candles — BTC / BNB / SOL</h2>

      <v-row class="mb-6" align="center">
        <v-col cols="auto">
          <v-select
            v-model="interval"
            :items="intervals"
            label="Chọn nến"
            dense
          />
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12" v-for="sym in symbols" :key="sym">
          <v-card class="pa-4 mb-6 chart-card">
            <div class="d-flex justify-space-between align-center mb-3">
              <div>
                <strong>{{ sym.toUpperCase() }} / USDT</strong>
              </div>
              <div class="text-subtitle-2">{{ lastPrice[sym] ?? "-" }}</div>
            </div>
            <canvas
              :ref="getCanvasRef(sym)"
              :id="`chart-${sym}`"
              height="400"
            ></canvas>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, watch } from "vue";
import axios from "axios";

const symbols = ["btcusdt", "bnbusdt", "solusdt"] as const;
type Sym = (typeof symbols)[number];

const intervals = ["1s", "1m", "5m", "15m", "1h"] as const;
const interval = ref<"1s" | "1m" | "5m" | "15m" | "1h">("1m");

const canvasRefs = reactive<Record<string, HTMLCanvasElement | null>>({
  btcusdt: null,
  bnbusdt: null,
  solusdt: null,
});
const charts = reactive<Record<string, any>>({
  btcusdt: null,
  bnbusdt: null,
  solusdt: null,
});
const lastPrice = reactive<Record<string, string | null>>({
  btcusdt: null,
  bnbusdt: null,
  solusdt: null,
});

let ws: WebSocket | null = null;

function getCanvasRef(sym: string) {
  return (el: HTMLCanvasElement | null) => (canvasRefs[sym] = el);
}

function klineArrayToCandle(arr: any[]) {
  return {
    x: Number(arr[0]),
    o: Number(arr[1]),
    h: Number(arr[2]),
    l: Number(arr[3]),
    c: Number(arr[4]),
  };
}

async function fetchHistorical(symbol: string, interval = "1m", limit = 200) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
  const resp = await axios.get(url);
  return resp.data.map((k: any[]) => klineArrayToCandle(k));
}

async function createCandlestickChart(sym: string, data: any[]) {
  if (!process.client) return null;

  const { Chart, registerables } = await import("chart.js");
  await import("chartjs-chart-financial");
  const zoomPlugin = (await import("chartjs-plugin-zoom")).default;
  await import("chartjs-adapter-luxon");

  Chart.register(...registerables, zoomPlugin);

  const ctx = canvasRefs[sym]?.getContext("2d");
  if (!ctx) return null;

  const chart = new Chart(ctx, {
    type: "candlestick" as any,
    data: { datasets: [{ label: sym.toUpperCase(), data }] },
    options: {
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x",
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: { unit: "minute" },
          ticks: { maxRotation: 0, autoSkip: true },
        },
        y: { position: "right" },
      },
      animation: { duration: 0 },
      maintainAspectRatio: false,
    },
  });

  charts[sym] = chart;
  return chart;
}

function upsertCandle(sym: string, candle: any) {
  const chart = charts[sym];
  if (!chart) return;
  const ds = chart.data.datasets[0].data as any[];
  const last = ds[ds.length - 1];

  if (last && last.x === candle.x) ds[ds.length - 1] = candle;
  else {
    ds.push(candle);
    if (ds.length > 1000) ds.shift();
  }

  lastPrice[sym] = String(candle.c);
  chart.update("none"); // update ngay lập tức, realtime
}

async function loadCharts() {
  await Promise.all(
    symbols.map(async (sym) => {
      const hist = await fetchHistorical(sym, interval.value, 500);
      if (charts[sym]) charts[sym].destroy();
      await createCandlestickChart(sym, hist);
      const last = hist[hist.length - 1];
      lastPrice[sym] = last ? String(last.c) : null;
    })
  );
}

function openWebSocket() {
  if (!process.client) return;
  if (ws) ws.close();

  const streamNames = symbols
    .map((s) => `${s}@kline_${interval.value}`)
    .join("/");
  const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamNames}`;
  ws = new WebSocket(wsUrl);

  ws.onmessage = (ev) => {
    try {
      const payload = JSON.parse(ev.data);
      const stream = payload.stream;
      const data = payload.data;
      if (!stream || !data || !data.k) return;
      const sym = stream.split("@")[0];
      const k = data.k;
      const candle = {
        x: k.t,
        o: Number(k.o),
        h: Number(k.h),
        l: Number(k.l),
        c: Number(k.c),
      };
      upsertCandle(sym, candle);
    } catch (err) {
      console.error("ws parse error", err);
    }
  };
}

watch(interval, async () => {
  await loadCharts();
  openWebSocket();
});

onMounted(async () => {
  await loadCharts();
  openWebSocket();
});

onBeforeUnmount(() => {
  if (ws) ws.close();
  Object.values(charts).forEach((c) => c?.destroy());
});
</script>

<style scoped>
.chart-card {
  height: 460px;
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}
canvas {
  flex: 1 1 auto;
}
</style>
