<template>
  <v-container fluid class="pa-4">
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">Backtest Strategy</h1>
      </v-col>
    </v-row>

    <v-row>
      <!-- Settings Panel -->
      <v-col cols="12" md="4">
        <v-card class="pa-4">
          <v-card-title class="text-h6">Settings</v-card-title>
          <v-card-text>
            <v-select
              v-model="settings.ltfTimeframe"
              :items="timeframes"
              label="Timeframe (LTF)"
              variant="outlined"
              density="compact"
              class="mb-3"
            />

            <v-text-field
              v-model.number="settings.leverage"
              label="Leverage"
              type="number"
              variant="outlined"
              density="compact"
              suffix="x"
              class="mb-3"
            />

            <v-text-field
              v-model.number="settings.usdPerTrade"
              label="USD per Trade"
              type="number"
              variant="outlined"
              density="compact"
              prefix="$"
              class="mb-3"
            />

            <v-text-field
              v-model.number="settings.profitTargetPct"
              label="Take Profit %"
              type="number"
              step="0.001"
              variant="outlined"
              density="compact"
              suffix="%"
              class="mb-3"
            />

            <v-text-field
              v-model.number="settings.stopLossPct"
              label="Stop Loss %"
              type="number"
              step="0.001"
              variant="outlined"
              density="compact"
              suffix="%"
              class="mb-3"
            />

            <v-text-field
              v-model.number="settings.minConfidence"
              label="Min Confidence"
              type="number"
              variant="outlined"
              density="compact"
              class="mb-3"
            />

            <v-text-field
              v-model.number="settings.rsiOverbought"
              label="RSI Overbought (SHORT)"
              type="number"
              variant="outlined"
              density="compact"
              class="mb-3"
            />

            <v-text-field
              v-model.number="settings.rsiOversold"
              label="RSI Oversold (LONG)"
              type="number"
              variant="outlined"
              density="compact"
              class="mb-3"
            />

            <v-btn
              color="primary"
              size="large"
              block
              :loading="loading"
              @click="runBacktest"
            >
              Run Backtest
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Results Panel -->
      <v-col cols="12" md="8">
        <v-card class="pa-4">
          <v-card-title class="text-h6">Results</v-card-title>
          <v-card-text>
            <div v-if="!results && !loading" class="text-center py-8 text-grey">
              Configure settings and click "Run Backtest" to see results
            </div>

            <div v-if="loading" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" size="64" />
              <p class="mt-4">Running backtest...</p>
            </div>

            <div v-if="results && !loading">
              <!-- Summary Cards -->
              <v-row class="mb-4">
                <v-col cols="6" sm="3">
                  <v-card
                    :color="results.totalProfit >= 0 ? 'success' : 'error'"
                    variant="tonal"
                    class="pa-3 text-center"
                  >
                    <div class="text-h5 font-weight-bold">
                      ${{ results.totalProfit.toFixed(2) }}
                    </div>
                    <div class="text-caption">Total Profit</div>
                  </v-card>
                </v-col>
                <v-col cols="6" sm="3">
                  <v-card
                    :color="results.winRate >= 70 ? 'success' : results.winRate >= 50 ? 'warning' : 'error'"
                    variant="tonal"
                    class="pa-3 text-center"
                  >
                    <div class="text-h5 font-weight-bold">
                      {{ results.winRate.toFixed(1) }}%
                    </div>
                    <div class="text-caption">Win Rate</div>
                  </v-card>
                </v-col>
                <v-col cols="6" sm="3">
                  <v-card variant="tonal" class="pa-3 text-center">
                    <div class="text-h5 font-weight-bold">
                      {{ results.totalTrades }}
                    </div>
                    <div class="text-caption">Total Trades</div>
                  </v-card>
                </v-col>
                <v-col cols="6" sm="3">
                  <v-card variant="tonal" class="pa-3 text-center">
                    <div class="text-h5 font-weight-bold">
                      {{ results.riskReward.toFixed(2) }}
                    </div>
                    <div class="text-caption">Risk/Reward</div>
                  </v-card>
                </v-col>
              </v-row>

              <!-- Detailed Stats -->
              <v-row class="mb-4">
                <v-col cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="text-subtitle-2 mb-2">Trade Statistics</div>
                    <v-table density="compact">
                      <tbody>
                        <tr>
                          <td>Wins</td>
                          <td class="text-right text-success">{{ results.wins }}</td>
                        </tr>
                        <tr>
                          <td>Losses</td>
                          <td class="text-right text-error">{{ results.losses }}</td>
                        </tr>
                        <tr>
                          <td>Avg Win</td>
                          <td class="text-right text-success">${{ results.avgWin.toFixed(2) }}</td>
                        </tr>
                        <tr>
                          <td>Avg Loss</td>
                          <td class="text-right text-error">${{ results.avgLoss.toFixed(2) }}</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-card variant="outlined" class="pa-3">
                    <div class="text-subtitle-2 mb-2">Exit Types</div>
                    <v-table density="compact">
                      <tbody>
                        <tr v-for="(count, type) in results.exitTypes" :key="type">
                          <td>{{ type }}</td>
                          <td class="text-right">
                            {{ count }} ({{ ((count / results.totalTrades) * 100).toFixed(1) }}%)
                          </td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card>
                </v-col>
              </v-row>

              <!-- Recent Trades -->
              <v-card variant="outlined" class="pa-3">
                <div class="text-subtitle-2 mb-2">Recent Trades (Last 50)</div>
                <v-data-table
                  :headers="tradeHeaders"
                  :items="results.trades"
                  density="compact"
                  :items-per-page="10"
                >
                  <template #item.side="{ item }">
                    <v-chip
                      :color="item.side === 'LONG' ? 'success' : 'error'"
                      size="small"
                    >
                      {{ item.side }}
                    </v-chip>
                  </template>
                  <template #item.entryPrice="{ item }">
                    ${{ item.entryPrice.toFixed(2) }}
                  </template>
                  <template #item.exitPrice="{ item }">
                    ${{ item.exitPrice.toFixed(2) }}
                  </template>
                  <template #item.profit="{ item }">
                    <span :class="item.profit >= 0 ? 'text-success' : 'text-error'">
                      {{ item.profit >= 0 ? '+' : '' }}${{ item.profit.toFixed(2) }}
                    </span>
                  </template>
                  <template #item.exitType="{ item }">
                    <v-chip
                      :color="getExitTypeColor(item.exitType)"
                      size="small"
                      variant="outlined"
                    >
                      {{ item.exitType }}
                    </v-chip>
                  </template>
                </v-data-table>
              </v-card>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '~/apis';

const api = useApi();

const timeframes = ['1m', '3m', '5m', '15m'];

const settings = ref({
  ltfTimeframe: '3m',
  leverage: 50,
  usdPerTrade: 20,
  profitTargetPct: 0.5,
  stopLossPct: 0.5,
  minConfidence: 200,
  rsiOverbought: 72,
  rsiOversold: 28,
});

const loading = ref(false);
const results = ref<any>(null);

const tradeHeaders = [
  { title: 'Side', key: 'side', width: 80 },
  { title: 'Entry', key: 'entryPrice' },
  { title: 'Exit', key: 'exitPrice' },
  { title: 'Profit', key: 'profit' },
  { title: 'Exit Type', key: 'exitType' },
];

const getExitTypeColor = (type: string) => {
  switch (type) {
    case 'TAKE_PROFIT':
      return 'success';
    case 'STOP_LOSS':
      return 'error';
    case 'TRAILING':
      return 'warning';
    case 'ICT_OB_EXIT':
      return 'info';
    default:
      return 'grey';
  }
};

const runBacktest = async () => {
  loading.value = true;
  results.value = null;

  try {
    const response = await api.post<any>('strategy/backtest', {
      json: {
        ltfTimeframe: settings.value.ltfTimeframe,
        leverage: settings.value.leverage,
        usdPerTrade: settings.value.usdPerTrade,
        profitTargetPct: settings.value.profitTargetPct / 100, // Convert from % to decimal
        stopLossPct: settings.value.stopLossPct / 100,
        minConfidence: settings.value.minConfidence,
        rsiOverbought: settings.value.rsiOverbought,
        rsiOversold: settings.value.rsiOversold,
      },
    });

    if (response.success) {
      results.value = response.results;
    } else {
      console.error('Backtest failed:', response.error);
    }
  } catch (error) {
    console.error('Error running backtest:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  // Load default settings from API
  try {
    const defaults = await api.get<any>('strategy/backtest/settings');
    if (defaults?.defaults) {
      settings.value = {
        ...settings.value,
        ...defaults.defaults,
        profitTargetPct: defaults.defaults.profitTargetPct * 100,
        stopLossPct: defaults.defaults.stopLossPct * 100,
      };
    }
  } catch (error) {
    console.error('Error loading default settings:', error);
  }
});
</script>

<style scoped>
.v-card {
  background: rgba(30, 30, 30, 0.8);
}
</style>
