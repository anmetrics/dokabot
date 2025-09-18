<template>
  <div class="p-4">
    <h1 class="text-2xl mb-4">BTC/USDT Candlestick Chart (Binance)</h1>
    <ClientOnly>
      <ChartsCandle :klines-data="klines" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { CandlestickData } from 'lightweight-charts'
import {
  fetchHistoricalKlines,
  subscribeKlines
} from '~/services/binanceService'

// Store candlestick data for the chart
const klines = ref<CandlestickData[]>([])
let stopWs: (() => void) | null = null

// Fetch historical klines and subscribe to real-time updates
onMounted(async () => {
  // Fetch initial historical data (e.g., last 100 candles)
  try {
    const historicalData = await fetchHistoricalKlines('BTCUSDT', '1m', 100)
    klines.value = historicalData
  } catch (error) {
    console.error('Failed to fetch historical klines:', error)
  }

  // Subscribe to real-time candlestick data
  stopWs = subscribeKlines('BTCUSDT', '1m', candle => {
    // Ensure reactivity by updating klines array
    const lastCandle = klines.value[klines.value.length - 1]

    if (lastCandle && lastCandle.time === candle.time) {
      // Update the last candle (incomplete, real-time candle)
      klines.value[klines.value.length - 1] = candle
      klines.value = [...klines.value] // Trigger Vue reactivity
    } else {
      // Add new candle when the previous one is complete
      klines.value.push(candle)
      klines.value = [...klines.value] // Trigger Vue reactivity
    }
  })
})

// Cleanup WebSocket on unmount
onBeforeUnmount(() => {
  stopWs?.()
})
</script>
