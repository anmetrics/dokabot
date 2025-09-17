<template>
    <div ref="chartContainer" style="height:500px; width:100%;"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { createChart, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries } from 'lightweight-charts'

const props = defineProps<{ klines: Array<{ time: number; open: number; high: number; low: number; close: number }> }>()

const chartContainer = ref<HTMLDivElement | null>(null)
let chart: IChartApi | null = null
let candleSeries: ISeriesApi<'Candlestick'> | null = null

onMounted(() => {
    if (!chartContainer.value) return
    chart = createChart(chartContainer.value, {
        layout: {
            background: { color: '#111' },
            textColor: '#DDD'
        },
        grid: {
            vertLines: { color: '#222' },
            horzLines: { color: '#222' }
        },
        width: chartContainer.value.clientWidth,
        height: chartContainer.value.clientHeight
    })
    candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
    })
    candleSeries.setData([{
        time: 1758076500000,
        open: 116802.60000000,
        high: 116888.00000000,
        low: 116788.18000000,
        close: 116870.37000000,


    }] as CandlestickData[])
    chart.timeScale().fitContent();
})

watch(() => props.klines, (newVal) => {
    if (!candleSeries) return
    candleSeries.setData(newVal as CandlestickData[])
}, { deep: true })

onBeforeUnmount(() => {
    chart?.remove()
})
</script>
