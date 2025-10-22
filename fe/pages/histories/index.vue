<template>
  <v-container class="py-6" dark>
    <v-row dense>
      <v-col v-for="(log, key) in logs" :key="key" cols="12" md="6" lg="4">
        <v-card elevation="3" class="pa-4 rounded-xl dark-card">
          <div class="d-flex align-center justify-space-between mb-2">
            <h2 class="text-h6 font-weight-bold text-white">
              {{ key.replace("Log", "") }}
            </h2>
            <v-chip
              :color="getChipColor(log)"
              text-color="white"
              size="small"
              label
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

          <v-divider class="mb-3" />

          <div v-if="log.symbols?.[0]?.openPositions">
            <v-row>
              <v-col cols="6" class="text-subtitle-2 text-grey"
                >Số lượng:</v-col
              >
              <v-col cols="6" class="text-right text-white">
                {{ formatNumber(log.symbols[0].openPositions.totalQty) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-2 text-grey"
                >Giá mua TB:</v-col
              >
              <v-col cols="6" class="text-right text-white">
                {{ formatPrice(log.symbols[0].openPositions.avgBuyPrice) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-2 text-grey"
                >Giá hiện tại:</v-col
              >
              <v-col cols="6" class="text-right text-white">
                {{ formatPrice(log.symbols[0].openPositions.currentPrice) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-2 text-grey"
                >Tổng vốn:</v-col
              >
              <v-col cols="6" class="text-right text-white">
                {{ formatPrice(log.symbols[0].openPositions.totalSpentOpen) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-2 text-grey"
                >Giá trị hiện tại:</v-col
              >
              <v-col cols="6" class="text-right text-white">
                {{ formatPrice(log.symbols[0].openPositions.currentValue) }}
              </v-col>

              <v-col cols="6" class="text-subtitle-2 text-grey"
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

    <v-row v-if="loading" justify="center" class="mt-6">
      <v-col cols="12" class="text-center">
        <v-progress-circular
          indeterminate
          color="primary"
        ></v-progress-circular>
      </v-col>
    </v-row>

    <v-row
      v-if="!loading && Object.keys(logs).length === 0"
      justify="center"
      class="mt-6"
    >
      <v-col cols="12" class="text-center text-grey">
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
.v-card {
  transition: all 0.2s ease;
  background-color: #1e1e2f; /* dark card background */
}
.v-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
}
.text-grey {
  color: rgba(200, 200, 200, 0.7);
}
.dark-card .v-chip {
  font-weight: bold;
}
</style>
