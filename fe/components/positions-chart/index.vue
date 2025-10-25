<template>
  <v-container class="py-12">
    <v-row dense>
      <v-col v-for="(log, key) in logs" :key="key" cols="12" md="6" lg="4">
        <v-card elevation="4" class="pa-6 rounded-xl dark-card">
          <div class="d-flex align-center justify-space-between mb-4">
            <h2 class="text-h6 font-weight-bold text-white">
              {{ key.replace("Log", "") }}
            </h2>
            <v-chip
              :color="getChipColor(log)"
              text-color="white"
              size="small"
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

          <v-divider class="mb-4 divider" />

          <div v-if="log.symbols?.[0]?.openPositions">
            <v-row dense>
              <v-col cols="6" class="text-subtitle-1 text-grey"
                >Số lượng:</v-col
              >
              <v-col cols="6" class="text-right text-white font-weight-medium">
                {{ formatNumber(log.symbols[0].openPositions.totalQty) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-1 text-grey"
                >Giá mua TB:</v-col
              >
              <v-col cols="6" class="text-right text-white font-weight-medium">
                {{ formatPrice(log.symbols[0].openPositions.avgBuyPrice) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-1 text-grey"
                >Giá hiện tại:</v-col
              >
              <v-col cols="6" class="text-right text-white font-weight-medium">
                {{ formatPrice(log.symbols[0].openPositions.currentPrice) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-1 text-grey"
                >Tổng vốn:</v-col
              >
              <v-col cols="6" class="text-right text-white font-weight-medium">
                {{ formatPrice(log.symbols[0].openPositions.totalSpentOpen) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-1 text-grey"
                >Giá trị hiện tại:</v-col
              >
              <v-col cols="6" class="text-right text-white font-weight-medium">
                {{ formatPrice(log.symbols[0].openPositions.currentValue) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-1 text-grey"
                >Lãi / Lỗ:</v-col
              >
              <v-col
                cols="6"
                class="text-right font-weight-bold"
                :class="{
                  'text-success':
                    log.symbols[0].openPositions.unrealizedPnL > 0,
                  'text-error': log.symbols[0].openPositions.unrealizedPnL < 0,
                }"
              >
                {{ formatPrice(log.symbols[0].openPositions.unrealizedPnL) }}
              </v-col>
            </v-row>
          </div>

          <div v-else class="text-center text-grey py-8">
            Không có vị thế mở
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="loading" justify="center" class="mt-8">
      <v-col cols="12" class="text-center">
        <v-progress-circular
          indeterminate
          color="primary"
          size="40"
          width="4"
        ></v-progress-circular>
      </v-col>
    </v-row>

    <v-row
      v-if="!loading && Object.keys(logs).length === 0"
      justify="center"
      class="mt-8"
    >
      <v-col cols="12" class="text-center text-grey text-h6">
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
/* Card styling */
.dark-card {
  background: linear-gradient(135deg, #0a1420 0%, #1c2a3b 100%);
  color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.dark-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(30, 136, 229, 0.2);
}

/* Chip styling */
.chip-status {
  font-weight: 600;
  text-transform: uppercase;
  border-radius: 6px;
  padding: 0 8px;
}

.chip-status.success {
  background: linear-gradient(90deg, #00e676 0%, #4caf50 100%) !important;
}

.chip-status.error {
  background: linear-gradient(90deg, #ff5252 0%, #d32f2f 100%) !important;
}

.chip-status.grey {
  background: linear-gradient(90deg, #616161 0%, #757575 100%) !important;
}

/* Text styling */
.text-grey {
  color: rgba(200, 200, 200, 0.7);
}

.text-success {
  color: #00e676;
}

.text-error {
  color: #ff5252;
}

/* Divider styling */
.divider {
  border-color: rgba(255, 255, 255, 0.1);
}

/* Progress circular */
:deep(.v-progress-circular) {
  color: #4fc3f7;
}

/* Row styling */
.v-row.dense > .v-col {
  padding: 8px;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .dark-card {
    padding: 16px;
  }
  .text-h6 {
    font-size: 1.1rem !important;
  }
  .text-subtitle-1 {
    font-size: 0.9rem !important;
  }
}

/* Scrollbar styling for container */
:deep(.v-container::-webkit-scrollbar) {
  width: 8px;
}

:deep(.v-container::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

:deep(.v-container::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
}
</style>
