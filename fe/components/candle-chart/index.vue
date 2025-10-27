<template>
  <div ref="chartContainer" style="height: 500px; width: 100%" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  LogicalRange,
  IRange,
  Time,
} from "lightweight-charts";
import { createChart, ColorType, CandlestickSeries } from "lightweight-charts";

// Define props
const props = defineProps<{
  klinesData: CandlestickData[];
}>();

// Define emits
const emit = defineEmits<{
  (e: "load-more"): void;
}>();

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<"Candlestick"> | null = null;

// Initialize chart on mount
onMounted(() => {
  if (!chartContainer.value) return;

  chart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: chartContainer.value.clientHeight,
    layout: {
      background: { type: ColorType.Solid, color: "#111" },
      textColor: "#DDD",
    },
    grid: {
      vertLines: { color: "#222" },
      horzLines: { color: "#222" },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
    },
  });

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderVisible: false,
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
  });

  const timeScale = chart.timeScale();

  // Subscribe to visible logical range changes for infinite loading
  const handleRangeChange = (range: LogicalRange | null) => {
    if (range && range.from < 20 && props.klinesData.length > 0) {
      // Buffer of 20 bars
      emit("load-more");
    }
  };
  timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);

  // Initial data load
  if (props.klinesData.length > 0) {
    candleSeries.setData(props.klinesData);
    chart.timeScale().fitContent();
  }

  // Cleanup
  onBeforeUnmount(() => {
    timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
  });
});

// Watch for klinesData changes
watch(
  () => props.klinesData,
  (newKlines, oldKlines) => {
    if (newKlines && newKlines.length > 0 && candleSeries && chart) {
      const safeOldKlines = oldKlines || [];
      const currentRange: IRange<Time> | null = chart
        .timeScale()
        .getVisibleRange();
      const wasAtEnd =
        currentRange &&
        safeOldKlines.length > 0 &&
        currentRange.to >= safeOldKlines[safeOldKlines.length - 1].time;

      candleSeries.setData(newKlines);

      if (newKlines.length <= 1 || safeOldKlines.length === 0) {
        chart.timeScale().fitContent();
      } else if (wasAtEnd) {
        chart.timeScale().scrollToRealTime();
      } else if (currentRange) {
        chart.timeScale().setVisibleRange(currentRange);
      }
    }
  },
  { immediate: true }
);

// Handle window resize
const resizeChart = () => {
  if (chart && chartContainer.value) {
    chart.resize(
      chartContainer.value.clientWidth,
      chartContainer.value.clientHeight
    );
  }
};

onMounted(() => {
  window.addEventListener("resize", resizeChart);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", resizeChart);
  chart?.remove();
  chart = null;
  candleSeries = null;
});
</script>
