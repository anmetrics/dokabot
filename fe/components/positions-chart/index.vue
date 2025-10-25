<template>
  <v-container class="py-8 container-compact">
    <v-row dense>
      <v-col v-for="(log, key) in logs" :key="key" cols="12" sm="6" md="4">
        <v-card elevation="2" class="pa-4 rounded-lg dark-card log-card">
          <div class="d-flex align-center justify-space-between mb-2">
            <h4 class="text-h7 font-weight-bold text-white">
              {{ key.replace("Log", "") }}
            </h4>
            <v-chip
              :color="getChipColor(log)"
              text-color="white"
              small
              label
              class="chip-status"
            >
              {{
                log.symbols?.[0]?.openPositions
                  ? log.symbols[0].openPositions.unrealizedPnL > 0
                    ? "Lãi"
                    : "Lỗ"
                  : "Không vị thế"
              }}
            </v-chip>
          </div>

          <v-divider class="mb-3 divider" />

          <div class="log-content">
            <div v-if="log.symbols?.[0]?.openPositions">
              <v-row dense class="info-row">
                <v-col cols="6" class="text-grey">Số lượng:</v-col>
                <v-col
                  cols="6"
                  class="text-right text-white font-weight-medium"
                >
                  {{ formatNumber(log.symbols[0].openPositions.totalQty) }}
                </v-col>

                <v-col cols="6" class="text-grey">Giá mua TB:</v-col>
                <v-col
                  cols="6"
                  class="text-right text-white font-weight-medium"
                >
                  {{ formatPrice(log.symbols[0].openPositions.avgBuyPrice) }}
                </v-col>

                <v-col cols="6" class="text-grey">Giá hiện tại:</v-col>
                <v-col
                  cols="6"
                  class="text-right text-white font-weight-medium"
                >
                  {{ formatPrice(log.symbols[0].openPositions.currentPrice) }}
                </v-col>

                <v-col cols="6" class="text-grey">Tổng vốn:</v-col>
                <v-col
                  cols="6"
                  class="text-right text-white font-weight-medium"
                >
                  {{ formatPrice(log.symbols[0].openPositions.totalSpentOpen) }}
                </v-col>

                <v-col cols="6" class="text-grey">Giá trị hiện tại:</v-col>
                <v-col
                  cols="6"
                  class="text-right text-white font-weight-medium"
                >
                  {{ formatPrice(log.symbols[0].openPositions.currentValue) }}
                </v-col>

                <v-col cols="6" class="text-grey">Lãi / Lỗ:</v-col>
                <v-col
                  cols="6"
                  class="text-right font-weight-bold"
                  :class="{
                    'text-success':
                      log.symbols[0].openPositions.unrealizedPnL > 0,
                    'text-error':
                      log.symbols[0].openPositions.unrealizedPnL < 0,
                  }"
                >
                  {{ formatPrice(log.symbols[0].openPositions.unrealizedPnL) }}
                </v-col>
              </v-row>
            </div>

            <div v-else class="no-position text-center text-grey">
              Không có vị thế mở
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="loading" justify="center" class="mt-6">
      <v-col cols="12" class="text-center">
        <v-progress-circular
          indeterminate
          color="primary"
          size="36"
          width="4"
        ></v-progress-circular>
      </v-col>
    </v-row>

    <v-row
      v-if="!loading && Object.keys(logs).length === 0"
      justify="center"
      class="mt-6"
    >
      <v-col cols="12" class="text-center text-grey text-h7">
        Không có dữ liệu logs
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useApi } from "~/apis";

const api = useApi();
const logs = ref<Record<string, any>>({});
const loading = ref(true);

async function fetchLogs() {
  loading.value = true;
  try {
    const res = await api.get<Record<string, any>>("binance/logs");
    logs.value = res || {};
  } catch (err) {
    console.error("Fetch logs failed:", err);
    logs.value = {};
  } finally {
    loading.value = false;
  }
}

onMounted(fetchLogs);

const formatNumber = (num: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(num);

const formatPrice = (num: number) =>
  `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    num
  )}`;

const getChipColor = (log: any) => {
  const pos = log.symbols?.[0]?.openPositions;
  if (!pos) return "grey";
  if (pos.unrealizedPnL > 0) return "success";
  if (pos.unrealizedPnL < 0) return "error";
  return "grey";
};
</script>

<style scoped>
.container-compact {
  max-width: 1100px;
  margin: 0 auto;
}

.log-card {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 280px;
}

.log-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.no-position {
  padding: 20px 0;
}

/* Card */
.dark-card {
  background: linear-gradient(135deg, #0b1624 0%, #182236 100%);
  color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dark-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(30, 136, 229, 0.15);
}

/* Chip */
.chip-status {
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 0.65rem;
}

.chip-status.success {
  background: #00c853 !important;
}

.chip-status.error {
  background: #ff3d00 !important;
}

.chip-status.grey {
  background: #616161 !important;
}

/* Text */
.text-grey {
  color: rgba(200, 200, 200, 0.6);
  font-size: 0.75rem;
}

.text-success {
  color: #00c853;
  font-size: 0.75rem;
}

.text-error {
  color: #ff3d00;
  font-size: 0.75rem;
}

/* Divider */
.divider {
  border-color: rgba(255, 255, 255, 0.08);
  margin-bottom: 0.5rem;
}

/* Row spacing */
.info-row > .v-col {
  padding: 2px 0;
}

/* Progress circular */
:deep(.v-progress-circular) {
  color: #4fc3f7;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .dark-card {
    padding: 12px;
  }
  .text-h7 {
    font-size: 0.9rem !important;
  }
  .text-grey,
  .text-success,
  .text-error {
    font-size: 0.7rem !important;
  }
}
</style>
