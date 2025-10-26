<template>
  <v-container class="py-6 container-compact">
    <v-card elevation="6" class="pa-4 pa-sm-6 dark-card">
      <!-- Header -->
      <div
        class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between mb-4 mb-sm-6"
      >
        <div class="d-flex align-center gap-2 mb-3 mb-sm-0">
          <v-avatar size="36" class="header-icon">
            <v-icon size="24" color="primary">mdi-chart-line</v-icon>
          </v-avatar>
        </div>

        <v-btn
          color="primary"
          @click="refresh"
          variant="elevated"
          :loading="loading"
          class="refresh-btn"
        >
          <v-icon start>mdi-refresh</v-icon>
          Refresh
        </v-btn>
      </div>

      <!-- Summary stats -->
      <v-row class="mb-5" dense>
        <v-col cols="12" sm="6" md="3">
          <v-sheet class="pa-4 rounded-lg stat-card">
            <div class="d-flex align-center justify-space-between">
              <v-icon color="cyan" size="24">mdi-briefcase-outline</v-icon>
              <span class="stat-value">{{ positions.length }}</span>
            </div>
            <div class="stat-label">Tổng vị thế</div>
          </v-sheet>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-sheet class="pa-4 rounded-lg stat-card">
            <div class="d-flex align-center justify-space-between">
              <v-icon color="amber" size="24">mdi-currency-usd</v-icon>
              <span class="stat-value">{{ totalUsdSpent.toFixed(2) }}</span>
            </div>
            <div class="stat-label">Tổng vốn USDT</div>
          </v-sheet>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-sheet class="pa-4 rounded-lg stat-card">
            <div class="d-flex align-center justify-space-between">
              <v-icon color="green" size="24">mdi-trending-up</v-icon>
              <span
                class="stat-value"
                :class="totalProfit >= 0 ? 'text-profit' : 'text-loss'"
              >
                {{ totalProfit.toFixed(2) }}
              </span>
            </div>
            <div class="stat-label">Unrealized P/L</div>
          </v-sheet>
        </v-col>

        <v-col cols="12" sm="6" md="3">
          <v-sheet class="pa-4 rounded-lg stat-card">
            <div class="d-flex align-center justify-space-between">
              <v-icon color="deep-purple" size="24">mdi-finance</v-icon>
              <span
                class="stat-value"
                :class="avgProfitPercent >= 0 ? 'text-profit' : 'text-loss'"
              >
                {{ avgProfitPercent.toFixed(2) }}%
              </span>
            </div>
            <div class="stat-label">Tỷ suất trung bình</div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- Table (desktop) -->
      <v-data-table
        v-if="!isMobile"
        :items="positions"
        :headers="headers"
        :items-per-page="800"
        class="dark-table"
        :loading="loading"
        density="compact"
        hide-default-footer
      >
        <template #item.buyPrice="{ item }">
          {{ Number(item.buyPrice).toLocaleString() }}
        </template>

        <template #item.usdSpent="{ item }">
          {{ item.usdSpent.toFixed(2) }}
        </template>

        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>

        <template #item.profit="{ item }">
          <span :class="item.profit > 0 ? 'text-profit' : 'text-loss'">
            {{ item.profit.toFixed(2) }} USDT ({{
              item.profitPercent.toFixed(2)
            }}%)
          </span>
        </template>

        <template #item.actions="{ item }">
          <v-btn
            small
            color="red"
            :disabled="item.profitPercent < 0.5"
            @click="confirmSell(item)"
          >
            Bán
          </v-btn>
        </template>
      </v-data-table>

      <!-- Mobile -->
      <div v-else class="mobile-list">
        <v-list two-line>
          <v-list-item
            v-for="item in positions"
            :key="item.id"
            class="mobile-card"
          >
            <v-list-item-content>
              <div class="d-flex justify-space-between align-center mb-1">
                <span class="mobile-symbol">{{ item.symbol }}</span>
                <v-chip
                  small
                  class="chip-profit"
                  :color="item.profit > 0 ? 'green' : 'red'"
                >
                  {{ item.profitPercent.toFixed(2) }}%
                </v-chip>
              </div>
              <div class="text-caption text-grey">
                {{ item.strategy }} • {{ formatDate(item.createdAt) }}
              </div>
              <div class="mt-2 d-flex justify-space-between align-center">
                <div>
                  {{ item.qty }} qty @ {{ item.buyPrice.toLocaleString() }}
                </div>
                <v-btn
                  x-small
                  color="red"
                  variant="flat"
                  @click.stop="confirmSell(item)"
                  :disabled="item.profitPercent < 0.5"
                >
                  Bán
                </v-btn>
              </div>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </div>
    </v-card>

    <!-- Confirm Sell Dialog -->
    <v-dialog v-model="dialog" max-width="400">
      <v-card class="dark-card pa-4">
        <v-card-title class="text-h6 mb-2">
          <v-icon color="red" start>mdi-alert-octagon</v-icon>
          Xác nhận bán
        </v-card-title>
        <v-card-text>
          <div v-if="errorMessage" class="text-red mb-2">
            {{ errorMessage }}
          </div>
          <div>
            Bán <strong>{{ selectedPosition?.symbol }}</strong
            >?
          </div>
          <div class="mt-2">
            <strong>Giá mua:</strong>
            {{ selectedPosition?.buyPrice.toLocaleString() }} USDT
          </div>
          <div>
            <strong>Lợi nhuận:</strong>
            <span
              :class="
                selectedPosition?.profit && selectedPosition.profit >= 0
                  ? 'text-profit'
                  : 'text-loss'
              "
            >
              {{ selectedPosition?.profit.toFixed(2) }} USDT ({{
                selectedPosition?.profitPercent.toFixed(2)
              }}%)
            </span>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text color="grey" @click="closeDialog">Hủy</v-btn>
          <v-btn color="red darken-1" :loading="loading" @click="sellConfirmed">
            Bán ngay
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>

  <!-- Chart component -->
  <positions-chart />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApi } from "~/apis";

const isMobile = ref(false);
if (process.client) {
  isMobile.value = window.innerWidth <= 600;
  window.addEventListener("resize", () => {
    isMobile.value = window.innerWidth <= 600;
  });
}

interface Position {
  id: string;
  buyPrice: number;
  strategy: string;
  symbol: string;
  qty: number;
  usdSpent: number;
  dcaIndex: number;
  createdAt: string;
  profit: number;
  profitPercent: number;
}

const api = useApi();
const positions = ref<Position[]>([]);
const loading = ref(false);

const headers = [
  { title: "Symbol", key: "symbol" },
  { title: "Chiến lược", key: "strategy" },
  { title: "Giá mua", key: "buyPrice", align: "end" },
  { title: "Số lượng", key: "qty", align: "end" },
  { title: "USD đã dùng", key: "usdSpent", align: "end" },
  { title: "DCA", key: "dcaIndex", align: "center" },
  { title: "Ngày tạo", key: "createdAt", align: "center" },
  { title: "Lợi nhuận", key: "profit", align: "end" },
  { title: "Actions", key: "actions", align: "center" },
];

const totalUsdSpent = computed(() =>
  positions.value.reduce((acc, p) => acc + p.usdSpent, 0)
);

const totalProfit = computed(() =>
  positions.value.reduce((acc, p) => acc + p.profit, 0)
);

const avgProfitPercent = computed(() =>
  positions.value.length
    ? positions.value.reduce((a, b) => a + b.profitPercent, 0) /
      positions.value.length
    : 0
);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function fetchPositions() {
  loading.value = true;
  try {
    const res: any = await api.get("binance/positions");
    positions.value = res || [];
  } catch (err) {
    console.error("Lỗi khi fetch positions:", err);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  fetchPositions();
}

/* --- Dialog --- */
const dialog = ref(false);
const selectedPosition = ref<Position | null>(null);
const errorMessage = ref("");

function confirmSell(position: Position) {
  if (position.profit <= 0) {
    alert("Chỉ có thể bán vị thế có lãi!");
    return;
  }
  selectedPosition.value = position;
  dialog.value = true;
}

function closeDialog() {
  dialog.value = false;
  selectedPosition.value = null;
  errorMessage.value = "";
}

async function sellConfirmed() {
  if (!selectedPosition.value) return;
  loading.value = true;
  try {
    await api.post("binance/sell", { id: selectedPosition.value.id });
    await fetchPositions();
    closeDialog();
  } catch (err: any) {
    errorMessage.value = err.message || "Bán thất bại!";
  } finally {
    loading.value = false;
  }
}

onMounted(fetchPositions);
</script>

<style scoped>
.container-compact {
  max-width: 1200px;
  margin: 0 auto;
}
.dark-card {
  background: linear-gradient(145deg, #0d1723, #111b28);
  border-radius: 16px;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}
.header-icon {
  background: rgba(79, 195, 247, 0.15);
  border: 1px solid rgba(79, 195, 247, 0.3);
}
.stat-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: #fff;
  transition: all 0.2s ease;
}
.stat-card:hover {
  background: rgba(79, 195, 247, 0.08);
  transform: translateY(-2px);
}
.stat-label {
  color: rgba(200, 200, 200, 0.7);
  font-size: 13px;
  margin-top: 6px;
}
.stat-value {
  font-weight: 600;
  font-size: 1.2rem;
}
.text-profit {
  color: #00e676;
}
.text-loss {
  color: #ef5350;
}
.refresh-btn {
  background: linear-gradient(90deg, #4fc3f7, #2196f3);
  color: #fff;
  border-radius: 8px;
  text-transform: none;
  font-weight: 500;
  padding: 6px 12px;
}
.dark-table {
  background: transparent;
  color: #fff;
  border-radius: 10px;
}
.dark-table :deep(th) {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
}
.dark-table :deep(td) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}
.dark-table :deep(tr:hover) {
  background: rgba(79, 195, 247, 0.05);
}
.mobile-list {
  display: none;
}
.text-grey {
  color: rgba(200, 200, 200, 0.6);
}
.chip-profit {
  font-size: 11px;
  font-weight: 500;
  color: #fff !important;
}
@media (max-width: 600px) {
  .dark-table {
    display: none;
  }
  .mobile-list {
    display: block;
  }
}
</style>
