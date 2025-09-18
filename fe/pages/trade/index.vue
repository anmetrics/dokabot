<template>
  <div class="p-4">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-2xl">Binance Spot Candlestick Chart</h1>
      <div class="flex items-center space-x-4">
        <select
          v-model="selectedPair"
          class="bg-gray-700 text-black p-2 rounded border border-gray-600 hover:bg-gray-600 focus:ring-2 focus:ring-blue-500"
          @change="changePair"
        >
          <option value="">Select Pair</option>
          <option
            v-for="pair in tradingPairs"
            :key="pair.symbol"
            :value="pair.symbol"
          >
            {{ pair.baseAsset }}/{{ pair.quoteAsset }}
          </option>
        </select>
        <select
          v-model="selectedInterval"
          class="bg-gray-700 text-black p-2 rounded border border-gray-600 hover:bg-gray-600 focus:ring-2 focus:ring-blue-500"
          @change="changeInterval"
        >
          <option
            v-for="interval in intervals"
            :key="interval"
            :value="interval"
          >
            {{ intervalLabel(interval) }}
          </option>
        </select>
      </div>
    </div>
    <div v-if="tradingPairs.length === 0" class="text-center py-8">
      Loading trading pairs...
    </div>
    <ClientOnly v-else>
      <ChartsCandle :klines-data="klines" @load-more="loadMoreHistorical" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { CandlestickData } from 'lightweight-charts'
import {
  fetchHistoricalKlines,
  fetchTradingPairs,
  subscribeKlines,
  type TradingPair
} from '~/services/binanceService'

// Config
const intervals = [
  '1s',
  '1m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '8h',
  '1d',
  '1w',
  '1M'
]

const intervalLabels = {
  '1s': '1 Second',
  '1m': '1 Minute',
  '5m': '5 Minutes',
  '15m': '15 Minutes',
  '30m': '30 Minutes',
  '1h': '1 Hour',
  '2h': '2 Hours',
  '8h': '8 Hours',
  '1d': '1 Day',
  '1w': '1 Week',
  '1M': '1 Month'
}

const intervalLabel = (interval: string) =>
  intervalLabels[interval as keyof typeof intervalLabels] || interval

// Reactive state
const tradingPairs = ref<TradingPair[]>([])
const selectedPair = ref<string>('')
const selectedInterval = ref<string>('1m')
const klines = ref<CandlestickData[]>([])
const isLoading = ref(false)
let stopWs: (() => void) | null = null

// Fetch trading pairs on mount
onMounted(async () => {
  try {
    tradingPairs.value = await fetchTradingPairs()
    console.log('fasdfasdfasdfasaaa', tradingPairs.value)
    // Default to BTCUSDT
    selectedPair.value = 'BTCUSDT'
    await loadInitialData()
  } catch (error) {
    console.error('Failed to fetch trading pairs:', error)
  }
})

// Function to load initial data
const loadInitialData = async () => {
  if (!selectedPair.value) return

  isLoading.value = true
  // Clear existing klines to avoid stale data
  klines.value = []

  // Stop any existing WebSocket subscription
  stopWs?.()

  try {
    const historicalData = await fetchHistoricalKlines(
      selectedPair.value,
      selectedInterval.value,
      100
    )
    klines.value = historicalData
  } catch (error) {
    console.error('Failed to fetch historical klines:', error)
  } finally {
    isLoading.value = false
  }

  // Start new WebSocket subscription
  if (selectedPair.value) {
    stopWs = subscribeKlines(
      selectedPair.value,
      selectedInterval.value,
      updateCandle
    )
  }
}

// Function to change pair
const changePair = async () => {
  await loadInitialData()
}

// Function to change interval
const changeInterval = async () => {
  await loadInitialData()
}

// Function to update candle from WebSocket
const updateCandle = (candle: CandlestickData) => {
  const lastCandle = klines.value[klines.value.length - 1]

  // Ensure the candle belongs to the current pair
  if (klines.value.length === 0) return

  if (lastCandle && lastCandle.time === candle.time) {
    // Update the last candle (incomplete, real-time candle)
    klines.value[klines.value.length - 1] = candle
    klines.value = [...klines.value] // Trigger Vue reactivity
  } else {
    // Add new candle when the previous one is complete
    klines.value.push(candle)
    klines.value = [...klines.value] // Trigger Vue reactivity
  }
}

// Function to load more historical data
const loadMoreHistorical = async () => {
  if (isLoading.value || klines.value.length === 0 || !selectedPair.value)
    return

  isLoading.value = true
  try {
    const oldestTime = klines.value[0].time * 1000 - 1 // -1 to avoid duplicates
    const newData = await fetchHistoricalKlines(
      selectedPair.value,
      selectedInterval.value,
      100,
      oldestTime
    )
    klines.value = [...newData, ...klines.value]
  } catch (error) {
    console.error('Failed to load more historical klines:', error)
  } finally {
    isLoading.value = false
  }
}

// Cleanup WebSocket on unmount
onBeforeUnmount(() => {
  stopWs?.()
})
</script>
