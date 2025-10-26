<template>
  <v-container fluid class="pa-6 pa-sm-8 pa-md-10">
    <v-card class="rounded-xl pa-6 dark-card">
      <!-- Header -->
      <div
        class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between mb-6"
      >
        <div class="d-flex align-center gap-3">
          <v-avatar color="blue-darken-3" size="40">
            <v-icon color="white">mdi-wallet</v-icon>
          </v-avatar>
        </div>
        <v-btn
          color="primary"
          variant="flat"
          @click="refresh"
          :loading="loading"
          class="refresh-btn"
        >
          <v-icon start>mdi-refresh</v-icon>
          Refresh
        </v-btn>
      </div>

      <!-- Tổng quan -->
      <v-row class="mb-6" dense>
        <v-col cols="12" sm="4">
          <v-sheet class="summary-card">
            <v-icon size="26" color="cyan-lighten-3">mdi-finance</v-icon>
            <div class="text-subtitle-2 text-grey mt-2">Tổng tài sản</div>
            <div class="text-h6 font-weight-bold text-white mt-1">
              {{ balances.length }}
            </div>
          </v-sheet>
        </v-col>

        <v-col cols="12" sm="4">
          <v-sheet class="summary-card">
            <v-icon size="26" color="green-lighten-2">mdi-lock</v-icon>
            <div class="text-subtitle-2 text-grey mt-2">Đang khóa</div>
            <div class="text-h6 font-weight-bold text-white mt-1">
              {{
                totalLocked.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }}
            </div>
          </v-sheet>
        </v-col>

        <v-col cols="12" sm="4">
          <v-sheet class="summary-card">
            <v-icon size="26" color="amber-lighten-2">mdi-currency-usd</v-icon>
            <div class="text-subtitle-2 text-grey mt-2">Tổng USD</div>
            <div class="text-h6 font-weight-bold text-white mt-1">
              {{
                totalUSD.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              }}
              $
            </div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- Bảng tài sản -->
      <v-data-table
        :items="balances"
        :headers="headers"
        :items-per-page="6"
        class="dark-table"
        :loading="loading"
        density="compact"
      >
        <template #item.asset="{ item }">
          <v-chip
            color="chip-bg"
            variant="flat"
            size="small"
            class="chip-asset"
          >
            {{ item.asset }}
          </v-chip>
        </template>
        <template #item.free="{ item }">
          {{
            parseFloat(item.free).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })
          }}
        </template>
        <template #item.locked="{ item }">
          {{
            parseFloat(item.locked).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })
          }}
        </template>
        <template #item.usd="{ item }">
          {{
            (
              (parseFloat(item.free) + parseFloat(item.locked)) *
              (rates[item.asset] || 0)
            ).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          }}
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApi } from "~/apis";

interface AssetBalance {
  asset: string;
  free: string;
  locked: string;
}

const api = useApi();
const balances = ref<AssetBalance[]>([]);
const loading = ref(false);
const rates = ref<Record<string, number>>({});

const headers = [
  { title: "Tài sản", key: "asset", align: "start" },
  { title: "Số dư khả dụng", key: "free", align: "end" },
  { title: "Đang khóa", key: "locked", align: "end" },
  { title: "USD", key: "usd", align: "end" },
];

const totalLocked = computed(() =>
  balances.value.reduce((acc, b) => acc + parseFloat(b.locked), 0)
);

const totalUSD = computed(() =>
  balances.value.reduce((acc, b) => {
    const rate = rates.value[b.asset] || 0;
    return acc + (parseFloat(b.free) + parseFloat(b.locked)) * rate;
  }, 0)
);

async function fetchRates() {
  try {
    // Lấy giá trực tiếp từ Binance API
    const response = await fetch("https://api.binance.com/api/v3/ticker/price");
    const data = await response.json();

    const filteredRates: Record<string, number> = {};
    ["BNB", "BTC", "SOL", "USDT"].forEach((asset) => {
      if (asset === "USDT") filteredRates[asset] = 1;
      else {
        const ticker = data.find((t: any) => t.symbol === asset + "USDT");
        filteredRates[asset] = ticker ? parseFloat(ticker.price) : 0;
      }
    });
    rates.value = filteredRates;
  } catch (err) {
    console.error("Lỗi fetch rates từ Binance:", err);
  }
}

async function fetchBalances() {
  loading.value = true;
  try {
    const res: any = await api.get("binance/account");
    balances.value =
      res.balances.filter((b: AssetBalance) => ["USDT"].includes(b.asset)) ||
      [];
    await fetchRates();
  } catch (err) {
    console.error("Lỗi khi fetch balances:", err);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchBalances);

function refresh() {
  fetchBalances();
}
</script>

<style scoped>
.dark-card {
  background: linear-gradient(145deg, #0d1723, #111b28);
  border-radius: 20px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  transition: all 0.3s ease;
}
.dark-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(0, 150, 255, 0.15);
}

/* Summary cards */
.summary-card {
  background: linear-gradient(135deg, #1c2535, #18202d);
  border-radius: 14px;
  text-align: center;
  padding: 20px;
  color: #ffffff;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
.summary-card:hover {
  background: linear-gradient(135deg, #223048, #1a2435);
  transform: translateY(-2px) scale(1.02);
}

/* Data table */
.dark-table {
  background: transparent;
  color: #ffffff;
}
.dark-table :deep(.v-data-table-header th) {
  background: linear-gradient(90deg, #232a35, #1a1f28);
  color: #e0e0e0 !important;
  font-weight: 600;
  font-size: 13px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.dark-table :deep(.v-data-table__td) {
  padding: 10px 12px;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.dark-table :deep(.v-data-table__tr:hover) {
  background: rgba(30, 136, 229, 0.08);
  transition: background 0.2s ease;
}

/* Chip */
.chip-bg {
  background: linear-gradient(90deg, #232a35, #2f3a47) !important;
  color: #ffffff;
}
.chip-asset {
  transition: all 0.3s ease;
  font-size: 0.8rem;
}
.chip-asset:hover {
  background: linear-gradient(90deg, #42a5f5, #2196f3) !important;
  transform: scale(1.05);
}

/* Button */
.refresh-btn {
  background: linear-gradient(90deg, #42a5f5 0%, #1e88e5 100%) !important;
  color: #ffffff;
  border-radius: 10px;
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0.5px;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
  transition: all 0.3s ease;
}
.refresh-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.4);
}

/* Text */
.text-grey {
  color: rgba(200, 200, 200, 0.7);
}

/* Responsive */
@media (max-width: 600px) {
  .summary-card {
    padding: 14px !important;
  }
  .v-card {
    padding: 16px !important;
  }
  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 0.8rem !important;
    padding: 8px 10px;
  }
}
</style>
