<!-- components/ChartsCandle.vue -->
<template>
  <div ref="chartContainer" style="height: 500px; width: 100%" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import type { CandlestickData, IChartApi, ISeriesApi } from 'lightweight-charts'
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts'

// Define props
const props = defineProps<{
  klinesData: CandlestickData[]
}>()

const chartContainer = ref<HTMLDivElement | null>(null)
let chart: IChartApi | null = null
let candleSeries: ISeriesApi<'Candlestick'> | null = null

// Initialize chart on mount
onMounted(() => {
  if (!chartContainer.value) return

  chart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: chartContainer.value.clientHeight,
    layout: {
      background: { type: ColorType.Solid, color: '#111' },
      textColor: '#DDD'
    },
    grid: {
      vertLines: { color: '#222' },
      horzLines: { color: '#222' }
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false
    }
  })

  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350'
  })

  // Initial data load
  if (props.klinesData.length > 0) {
    candleSeries.setData(props.klinesData)
    chart.timeScale().fitContent()
  }
})

// Watch for klinesData changes
watch(
  () => props.klinesData,
  newKlines => {
    if (newKlines && newKlines.length > 0 && candleSeries) {
      candleSeries.setData(newKlines)
      // Only call fitContent if needed (e.g., initial load or significant data change)
      if (newKlines.length <= 1) {
        chart?.timeScale().fitContent()
      }
    }
  },
  { immediate: true }
)

// Handle window resize
const resizeChart = () => {
  if (chart && chartContainer.value) {
    chart.resize(
      chartContainer.value.clientWidth,
      chartContainer.value.clientHeight
    )
  }
}

onMounted(() => {
  window.addEventListener('resize', resizeChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.remove()
  chart = null
  candleSeries = null
})
</script>
