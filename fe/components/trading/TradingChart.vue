<template>
  <div class="trading-chart" :class="{ fullscreen: isFullscreen }">
    <!-- Toolbar -->
    <ChartToolbar
      v-model="timeframe"
      v-model:chart-type="chartType"
      :is-fullscreen="isFullscreen"
      @toggle-fullscreen="toggleFullscreen"
    />

    <!-- Price header -->
    <div class="price-header">
      <div class="price-info">
        <span class="current-price" :class="priceChangePercent >= 0 ? 'up' : 'down'">
          {{ formatPrice(currentPrice) }}
        </span>
        <span class="price-change" :class="priceChangePercent >= 0 ? 'up' : 'down'">
          {{ priceChangePercent >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}
          ({{ priceChangePercent >= 0 ? '+' : '' }}{{ priceChangePercent.toFixed(2) }}%)
        </span>
      </div>
      <div class="market-stats">
        <div class="stat">
          <span class="stat-label">24h High</span>
          <span class="stat-value">{{ formatPrice(high24h) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">24h Low</span>
          <span class="stat-value">{{ formatPrice(low24h) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">24h Vol</span>
          <span class="stat-value">{{ formatVolume(volume24h) }}</span>
        </div>
      </div>
    </div>

    <!-- Chart container -->
    <div class="chart-container">
      <div ref="chartContainer" class="chart-wrapper"></div>
      <div v-if="isLoading" class="loading-overlay">
        <v-progress-circular indeterminate color="primary" size="40" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
} from "lightweight-charts";
import { createChart, ColorType, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries } from "lightweight-charts";
import ChartToolbar from "./ChartToolbar.vue";
import { useTradingState } from "~/composables/useTradingState";
import {
  fetchHistoricalKlines,
  subscribeKlines,
  fetch24hTicker,
} from "~/services/binanceService";

const props = defineProps<{
  symbol: string;
}>();

const emit = defineEmits<{
  (e: "priceClick", price: number): void;
}>();

const {
  timeframe,
  chartType,
  klines,
  indicators,
  isFullscreen,
  setKlines,
  updateKline,
  prependKlines,
} = useTradingState();

const chartContainer = ref<HTMLDivElement | null>(null);
const isLoading = ref(false);

let chart: IChartApi | null = null;
let mainSeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
const indicatorSeries: Map<string, ISeriesApi<"Line">> = new Map();
let stopWs: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

// 24h stats
const high24h = ref(0);
const low24h = ref(0);
const volume24h = ref(0);

const currentPrice = computed(() => {
  if (klines.value.length === 0) return 0;
  return klines.value[klines.value.length - 1].close as number;
});

const priceChange = computed(() => {
  if (klines.value.length < 2) return 0;
  const first = klines.value[0].open as number;
  const last = klines.value[klines.value.length - 1].close as number;
  return last - first;
});

const priceChangePercent = computed(() => {
  if (klines.value.length < 2) return 0;
  const first = klines.value[0].open as number;
  if (first === 0) return 0;
  const last = klines.value[klines.value.length - 1].close as number;
  return ((last - first) / first) * 100;
});

function formatPrice(price: number): string {
  if (price === 0) return "-";
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + "B";
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + "M";
  if (vol >= 1e3) return (vol / 1e3).toFixed(2) + "K";
  return vol.toFixed(2);
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value;
}

function initChart() {
  if (!chartContainer.value) return;

  chart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: chartContainer.value.clientHeight,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: "#94a3b8",
    },
    grid: {
      vertLines: { color: "rgba(167, 139, 250, 0.05)" },
      horzLines: { color: "rgba(167, 139, 250, 0.05)" },
    },
    crosshair: {
      mode: 1,
      vertLine: {
        color: "rgba(167, 139, 250, 0.3)",
        width: 1,
        style: 2,
        labelBackgroundColor: "#7c3aed",
      },
      horzLine: {
        color: "rgba(167, 139, 250, 0.3)",
        width: 1,
        style: 2,
        labelBackgroundColor: "#7c3aed",
      },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      borderColor: "rgba(167, 139, 250, 0.1)",
    },
    rightPriceScale: {
      borderColor: "rgba(167, 139, 250, 0.1)",
    },
  });

  createMainSeries();
  createVolumeSeries();

  // Subscribe to visible range changes for infinite loading
  const timeScale = chart.timeScale();
  timeScale.subscribeVisibleLogicalRangeChange((range) => {
    if (range && range.from < 20 && klines.value.length > 0 && !isLoading.value) {
      loadMoreHistorical();
    }
  });

  // Click handler for price
  chart.subscribeCrosshairMove((param) => {
    if (param.point && param.seriesData.size > 0) {
      const data = param.seriesData.get(mainSeries!) as CandlestickData;
      if (data) {
        emit("priceClick", data.close as number);
      }
    }
  });
}

function createMainSeries() {
  if (!chart) return;

  // Remove existing series
  if (mainSeries) {
    chart.removeSeries(mainSeries);
    mainSeries = null;
  }

  if (chartType.value === "candlestick") {
    mainSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
  } else if (chartType.value === "line") {
    mainSeries = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 2,
    });
  } else if (chartType.value === "area") {
    mainSeries = chart.addSeries(AreaSeries, {
      lineColor: "#a78bfa",
      topColor: "rgba(167, 139, 250, 0.4)",
      bottomColor: "rgba(167, 139, 250, 0.0)",
      lineWidth: 2,
    });
  }

  if (klines.value.length > 0 && mainSeries) {
    if (chartType.value === "candlestick") {
      mainSeries.setData(klines.value);
    } else {
      const lineData: LineData[] = klines.value.map((k) => ({
        time: k.time,
        value: k.close as number,
      }));
      mainSeries.setData(lineData);
    }
  }
}

function createVolumeSeries() {
  if (!chart) return;

  // Check if volume indicator is enabled
  const volIndicator = indicators.value.find((i) => i.type === "VOL");
  if (!volIndicator?.enabled) {
    if (volumeSeries) {
      chart.removeSeries(volumeSeries);
      volumeSeries = null;
    }
    return;
  }

  if (!volumeSeries) {
    volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
  }

  if (klines.value.length > 0) {
    const volumeData: HistogramData[] = klines.value.map((k, i) => ({
      time: k.time,
      value: (k as any).volume || 0,
      color:
        i > 0 && (k.close as number) >= (klines.value[i - 1].close as number)
          ? "rgba(16, 185, 129, 0.5)"
          : "rgba(239, 68, 68, 0.5)",
    }));
    volumeSeries.setData(volumeData);
  }
}

function updateIndicators() {
  if (!chart) return;

  // Clear existing indicator series
  for (const [key, series] of indicatorSeries) {
    chart.removeSeries(series);
  }
  indicatorSeries.clear();

  // Create MA/EMA indicators
  const maIndicators = indicators.value.filter(
    (i) => (i.type === "MA" || i.type === "EMA") && i.enabled
  );

  for (const ind of maIndicators) {
    const period = ind.params.period || 7;
    const maData = calculateMA(klines.value, period, ind.type === "EMA");
    const series = chart.addSeries(LineSeries, {
      color: ind.color || "#f59e0b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    series.setData(maData);
    indicatorSeries.set(`${ind.type}-${period}`, series);
  }

  // Create Bollinger Bands
  const bollIndicator = indicators.value.find((i) => i.type === "BOLL" && i.enabled);
  if (bollIndicator) {
    const { upper, middle, lower } = calculateBollingerBands(
      klines.value,
      bollIndicator.params.period || 20,
      bollIndicator.params.stdDev || 2
    );

    const upperSeries = chart.addSeries(LineSeries, {
      color: "rgba(139, 92, 246, 0.5)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    upperSeries.setData(upper);
    indicatorSeries.set("BOLL-upper", upperSeries);

    const middleSeries = chart.addSeries(LineSeries, {
      color: "rgba(139, 92, 246, 0.8)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    middleSeries.setData(middle);
    indicatorSeries.set("BOLL-middle", middleSeries);

    const lowerSeries = chart.addSeries(LineSeries, {
      color: "rgba(139, 92, 246, 0.5)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    lowerSeries.setData(lower);
    indicatorSeries.set("BOLL-lower", lowerSeries);
  }

  // Update volume series
  createVolumeSeries();
}

function calculateMA(data: CandlestickData[], period: number, exponential: boolean): LineData[] {
  const result: LineData[] = [];
  if (data.length < period) return result;

  if (exponential) {
    const multiplier = 2 / (period + 1);
    let ema = 0;

    // Calculate first SMA
    for (let i = 0; i < period; i++) {
      ema += data[i].close as number;
    }
    ema /= period;

    for (let i = period - 1; i < data.length; i++) {
      if (i === period - 1) {
        result.push({ time: data[i].time, value: ema });
      } else {
        ema = ((data[i].close as number) - ema) * multiplier + ema;
        result.push({ time: data[i].time, value: ema });
      }
    }
  } else {
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close as number;
      }
      result.push({ time: data[i].time, value: sum / period });
    }
  }

  return result;
}

function calculateBollingerBands(
  data: CandlestickData[],
  period: number,
  stdDev: number
): { upper: LineData[]; middle: LineData[]; lower: LineData[] } {
  const upper: LineData[] = [];
  const middle: LineData[] = [];
  const lower: LineData[] = [];

  if (data.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close as number;
    }
    const sma = sum / period;

    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow((data[i - j].close as number) - sma, 2);
    }
    const std = Math.sqrt(variance / period);

    middle.push({ time: data[i].time, value: sma });
    upper.push({ time: data[i].time, value: sma + stdDev * std });
    lower.push({ time: data[i].time, value: sma - stdDev * std });
  }

  return { upper, middle, lower };
}

async function loadData() {
  isLoading.value = true;
  stopWs?.();

  try {
    // Fetch historical data
    const historical = await fetchHistoricalKlines(props.symbol, timeframe.value, 200);
    setKlines(historical);

    // Fetch 24h ticker
    const ticker = await fetch24hTicker(props.symbol);
    high24h.value = ticker.high;
    low24h.value = ticker.low;
    volume24h.value = ticker.quoteVolume;

    // Update chart
    if (mainSeries && historical.length > 0) {
      if (chartType.value === "candlestick") {
        mainSeries.setData(historical);
      } else {
        const lineData: LineData[] = historical.map((k) => ({
          time: k.time,
          value: k.close as number,
        }));
        mainSeries.setData(lineData);
      }
      chart?.timeScale().fitContent();
    }

    updateIndicators();

    // Subscribe to WebSocket
    stopWs = subscribeKlines(props.symbol, timeframe.value, (candle) => {
      updateKline(candle);

      // Update main series
      if (mainSeries) {
        if (chartType.value === "candlestick") {
          mainSeries.update(candle);
        } else {
          mainSeries.update({ time: candle.time, value: candle.close as number });
        }
      }

      // Update volume
      if (volumeSeries) {
        const prevClose =
          klines.value.length > 1
            ? (klines.value[klines.value.length - 2].close as number)
            : (candle.close as number);
        volumeSeries.update({
          time: candle.time,
          value: (candle as any).volume || 0,
          color:
            (candle.close as number) >= prevClose
              ? "rgba(16, 185, 129, 0.5)"
              : "rgba(239, 68, 68, 0.5)",
        });
      }
    });
  } catch (error) {
    console.error("Failed to load chart data:", error);
  } finally {
    isLoading.value = false;
  }
}

async function loadMoreHistorical() {
  if (isLoading.value || klines.value.length === 0) return;

  isLoading.value = true;
  try {
    const oldestTime = (klines.value[0].time as number) * 1000 - 1;
    const moreData = await fetchHistoricalKlines(props.symbol, timeframe.value, 200, oldestTime);

    if (moreData.length > 0) {
      prependKlines(moreData);

      // Update all series with new data
      if (mainSeries) {
        if (chartType.value === "candlestick") {
          mainSeries.setData(klines.value);
        } else {
          const lineData: LineData[] = klines.value.map((k) => ({
            time: k.time,
            value: k.close as number,
          }));
          mainSeries.setData(lineData);
        }
      }

      updateIndicators();
    }
  } catch (error) {
    console.error("Failed to load more historical data:", error);
  } finally {
    isLoading.value = false;
  }
}

function resizeChart() {
  if (chart && chartContainer.value) {
    chart.resize(chartContainer.value.clientWidth, chartContainer.value.clientHeight);
  }
}

// Watch for symbol changes
watch(
  () => props.symbol,
  () => {
    loadData();
  }
);

// Watch for timeframe changes
watch(timeframe, () => {
  loadData();
});

// Watch for chart type changes
watch(chartType, () => {
  createMainSeries();
  updateIndicators();
});

// Watch for indicator changes
watch(
  indicators,
  () => {
    updateIndicators();
  },
  { deep: true }
);

// Watch for fullscreen changes
watch(isFullscreen, () => {
  setTimeout(resizeChart, 100);
});

onMounted(() => {
  initChart();
  loadData();
  window.addEventListener("resize", resizeChart);

  // Use ResizeObserver to handle sidebar toggle and container resize
  if (chartContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeChart();
    });
    resizeObserver.observe(chartContainer.value);
  }
});

onBeforeUnmount(() => {
  stopWs?.();
  window.removeEventListener("resize", resizeChart);
  resizeObserver?.disconnect();
  resizeObserver = null;
  chart?.remove();
  chart = null;
  mainSeries = null;
  volumeSeries = null;
  indicatorSeries.clear();
});
</script>

<style scoped>
.trading-chart {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 8px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
}

.trading-chart.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  border-radius: 0;
}

.price-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  flex-wrap: wrap;
  gap: 8px;
}

.price-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.current-price {
  font-size: 18px;
  font-weight: 700;
}

.current-price.up {
  color: #10b981;
}

.current-price.down {
  color: #ef4444;
}

.price-change {
  font-size: 11px;
  font-weight: 500;
}

.price-change.up {
  color: #10b981;
}

.price-change.down {
  color: #ef4444;
}

.market-stats {
  display: flex;
  gap: 16px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.stat-label {
  font-size: 9px;
  color: #64748b;
  text-transform: uppercase;
}

.stat-value {
  font-size: 11px;
  font-weight: 600;
  color: #f1f5f9;
}

.chart-container {
  flex: 1;
  position: relative;
  min-height: 300px;
  overflow: hidden;
}

.chart-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.8);
}

@media (max-width: 768px) {
  .price-header {
    padding: 6px 10px;
  }

  .current-price {
    font-size: 16px;
  }

  .market-stats {
    gap: 12px;
  }

  .stat-value {
    font-size: 10px;
  }

  .trading-chart {
    min-height: 300px;
  }

  .chart-container {
    flex: 1;
    min-height: 240px;
  }

  .chart-wrapper {
    min-height: 240px;
  }
}

@media (max-width: 640px) {
  .trading-chart {
    min-height: 280px;
  }

  .chart-container {
    min-height: 220px;
  }

  .chart-wrapper {
    min-height: 220px;
  }

  .market-stats {
    display: none;
  }
}
</style>
