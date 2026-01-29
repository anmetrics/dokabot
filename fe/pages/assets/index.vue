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
            <v-icon size="18" color="#a78bfa">mdi-finance</v-icon>
            <div class="card-label mt-1">Tổng tài sản</div>
            <div class="card-value mt-1">
              {{ balances.length }}
            </div>
          </v-sheet>
        </v-col>

        <v-col cols="12" sm="4">
          <v-sheet class="summary-card">
            <v-icon size="18" color="#10b981">mdi-lock</v-icon>
            <div class="card-label mt-1">Đang khóa</div>
            <div class="card-value mt-1">
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
            <v-icon size="18" color="#f59e0b">mdi-currency-usd</v-icon>
            <div class="card-label mt-1">Tổng USD</div>
            <div class="card-value mt-1">
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
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}
.dark-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(124, 58, 237, 0.15);
}

/* Summary cards */
.summary-card {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.1) 0%, rgba(167, 139, 250, 0.05) 100%);
  border-radius: 10px;
  text-align: center;
  padding: 10px 12px;
  color: #f1f5f9;
  transition: all 0.3s ease;
  border: 1px solid rgba(167, 139, 250, 0.15);
  backdrop-filter: blur(10px);
}
.summary-card:hover {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15) 0%, rgba(167, 139, 250, 0.08) 100%);
  transform: translateY(-3px);
  border-color: rgba(167, 139, 250, 0.3);
  box-shadow: 0 8px 20px rgba(124, 58, 237, 0.2);
}

/* Data table */
.dark-table {
  background: transparent;
  color: #f1f5f9;
}
.dark-table :deep(.v-data-table-header th) {
  background: rgba(167, 139, 250, 0.08);
  color: #f1f5f9 !important;
  font-weight: 600;
  font-size: 13px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}
.dark-table :deep(.v-data-table__td) {
  padding: 12px 16px;
  font-size: 13px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.05);
}
.dark-table :deep(.v-data-table__tr:hover) {
  background: rgba(167, 139, 250, 0.05);
  transition: background 0.2s ease;
}

/* Chip */
.chip-bg {
  background: rgba(124, 58, 237, 0.2) !important;
  color: #a78bfa;
  border: 1px solid rgba(167, 139, 250, 0.3);
}
.chip-asset {
  transition: all 0.3s ease;
  font-size: 0.85rem;
  font-weight: 600;
}
.chip-asset:hover {
  background: linear-gradient(90deg, #7c3aed, #a78bfa) !important;
  color: #ffffff !important;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

/* Button */
.refresh-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%) !important;
  color: #ffffff;
  border-radius: 12px;
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0.02em;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
  transition: all 0.3s ease;
}
.refresh-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
  filter: brightness(1.1);
}

/* Card Label & Value */
.card-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.card-value {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
}

/* Text */
.text-grey {
  color: #94a3b8;
}

/* Responsive */
@media (max-width: 960px) {
  .card-value {
    font-size: 14px;
  }
}

@media (max-width: 600px) {
  .summary-card {
    padding: 8px 6px !important;
  }

  .card-value {
    font-size: 12px;
  }
  .v-card {
    padding: 16px 8px !important;
  }
  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 0.8rem !important;
    padding: 10px 12px;
  }
}

@media (max-width: 480px) {
  .page-title {
    font-size: 18px;
  }

  .summary-card {
    padding: 6px 4px !important;
  }

  .card-label {
    font-size: 10px;
  }

  .card-value {
    font-size: 11px;
  }

  .v-card {
    padding: 12px 6px !important;
  }

  .refresh-btn {
    padding: 6px 12px;
    font-size: 11px;
  }

  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 11px !important;
    padding: 8px 6px;
  }
}
</style>
