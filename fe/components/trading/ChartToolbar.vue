<template>
  <div class="chart-toolbar">
    <!-- Timeframe buttons -->
    <div class="toolbar-section timeframes">
      <button
        v-for="tf in timeframes"
        :key="tf.value"
        :class="['tf-btn', { active: modelValue === tf.value }]"
        @click="$emit('update:modelValue', tf.value)"
      >
        {{ tf.label }}
      </button>
    </div>

    <!-- Chart type -->
    <div class="toolbar-section chart-types">
      <button
        v-for="ct in chartTypes"
        :key="ct.value"
        :class="['type-btn', { active: chartType === ct.value }]"
        @click="$emit('update:chartType', ct.value)"
        :title="ct.label"
      >
        <v-icon size="18">{{ ct.icon }}</v-icon>
      </button>
    </div>

    <!-- Indicators dropdown -->
    <div class="toolbar-section indicators">
      <v-menu offset-y :close-on-content-click="false">
        <template #activator="{ props }">
          <button class="indicator-btn" v-bind="props">
            <v-icon size="18">mdi-chart-timeline-variant</v-icon>
            <span>Indicators</span>
            <v-icon size="16">mdi-chevron-down</v-icon>
          </button>
        </template>
        <v-card class="indicator-menu">
          <v-list density="compact">
            <v-list-subheader>Moving Averages</v-list-subheader>
            <v-list-item
              v-for="ind in maIndicators"
              :key="`${ind.type}-${ind.params.period}`"
              @click="toggleIndicator(ind.type, ind.params)"
            >
              <template #prepend>
                <v-checkbox-btn
                  :model-value="isIndicatorEnabled(ind.type, ind.params)"
                  :color="ind.color"
                  density="compact"
                />
              </template>
              <v-list-item-title>
                {{ ind.type }} ({{ ind.params.period }})
              </v-list-item-title>
              <template #append>
                <div class="color-dot" :style="{ background: ind.color }"></div>
              </template>
            </v-list-item>

            <v-divider class="my-2" />
            <v-list-subheader>Oscillators</v-list-subheader>

            <v-list-item @click="toggleIndicator('MACD', { fast: 12, slow: 26, signal: 9 })">
              <template #prepend>
                <v-checkbox-btn
                  :model-value="isIndicatorEnabled('MACD', { fast: 12, slow: 26, signal: 9 })"
                  color="primary"
                  density="compact"
                />
              </template>
              <v-list-item-title>MACD (12, 26, 9)</v-list-item-title>
            </v-list-item>

            <v-list-item @click="toggleIndicator('RSI', { period: 14 })">
              <template #prepend>
                <v-checkbox-btn
                  :model-value="isIndicatorEnabled('RSI', { period: 14 })"
                  color="primary"
                  density="compact"
                />
              </template>
              <v-list-item-title>RSI (14)</v-list-item-title>
            </v-list-item>

            <v-divider class="my-2" />
            <v-list-subheader>Other</v-list-subheader>

            <v-list-item @click="toggleIndicator('BOLL', { period: 20, stdDev: 2 })">
              <template #prepend>
                <v-checkbox-btn
                  :model-value="isIndicatorEnabled('BOLL', { period: 20, stdDev: 2 })"
                  color="primary"
                  density="compact"
                />
              </template>
              <v-list-item-title>Bollinger Bands (20, 2)</v-list-item-title>
            </v-list-item>

            <v-list-item @click="toggleIndicator('VOL', {})">
              <template #prepend>
                <v-checkbox-btn
                  :model-value="isIndicatorEnabled('VOL', {})"
                  color="primary"
                  density="compact"
                />
              </template>
              <v-list-item-title>Volume</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>
    </div>

    <!-- Fullscreen toggle -->
    <div class="toolbar-section actions">
      <button class="action-btn" @click="$emit('toggleFullscreen')" title="Fullscreen">
        <v-icon size="18">{{ isFullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen' }}</v-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useTradingState } from "~/composables/useTradingState";

const props = defineProps<{
  modelValue: string;
  chartType: "candlestick" | "line" | "area";
  isFullscreen?: boolean;
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "update:chartType", value: "candlestick" | "line" | "area"): void;
  (e: "toggleFullscreen"): void;
}>();

const { indicators, toggleIndicator } = useTradingState();

const timeframes = [
  { label: "1s", value: "1s" },
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "30m", value: "30m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

const chartTypes = [
  { label: "Candlestick", value: "candlestick", icon: "mdi-chart-box" },
  { label: "Line", value: "line", icon: "mdi-chart-line" },
  { label: "Area", value: "area", icon: "mdi-chart-areaspline" },
];

const maIndicators = computed(() =>
  indicators.value.filter((i) => i.type === "MA" || i.type === "EMA")
);

function isIndicatorEnabled(type: string, params: Record<string, number>): boolean {
  return indicators.value.some(
    (i) =>
      i.type === type &&
      i.enabled &&
      JSON.stringify(i.params) === JSON.stringify(params)
  );
}
</script>

<style scoped>
.chart-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(30, 41, 59, 0.8);
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  flex-wrap: wrap;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-section.timeframes {
  flex-wrap: wrap;
}

.tf-btn {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tf-btn:hover {
  color: #f1f5f9;
  background: rgba(167, 139, 250, 0.1);
}

.tf-btn.active {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
}

.type-btn {
  padding: 6px;
  color: #94a3b8;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.type-btn:hover {
  color: #f1f5f9;
  background: rgba(167, 139, 250, 0.1);
}

.type-btn.active {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
}

.indicator-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
  background: transparent;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.indicator-btn:hover {
  color: #f1f5f9;
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.3);
}

.indicator-menu {
  background: #1e293b !important;
  border: 1px solid rgba(167, 139, 250, 0.2);
  min-width: 240px;
}

.indicator-menu :deep(.v-list) {
  background: transparent;
}

.indicator-menu :deep(.v-list-subheader) {
  color: #64748b;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.indicator-menu :deep(.v-list-item-title) {
  font-size: 13px;
  color: #f1f5f9;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.action-btn {
  padding: 6px;
  color: #94a3b8;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  color: #f1f5f9;
  background: rgba(167, 139, 250, 0.1);
}

.toolbar-section.chart-types {
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid rgba(167, 139, 250, 0.1);
}

.toolbar-section.indicators {
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid rgba(167, 139, 250, 0.1);
}

.toolbar-section.actions {
  margin-left: auto;
}

@media (max-width: 768px) {
  .chart-toolbar {
    padding: 6px 8px;
  }

  .tf-btn {
    padding: 3px 6px;
    font-size: 11px;
  }

  .indicator-btn span {
    display: none;
  }
}
</style>
