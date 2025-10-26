<template>
  <v-container class="py-4 container-compact">
    <v-card elevation="4" class="pa-4 pa-sm-6 dark-card">
      <!-- Header -->
      <div
        class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between mb-4 mb-sm-6"
      >
        <div class="d-flex align-center gap-2 gap-sm-3 mb-3 mb-sm-0">
          <v-avatar size="32" class="header-icon">
            <v-icon size="20" color="primary">mdi-history</v-icon>
          </v-avatar>
        </div>

        <v-btn
          color="primary"
          @click="refresh"
          variant="elevated"
          :loading="loading"
          class="refresh-btn"
          size="small"
        >
          <v-icon start size="18">mdi-refresh</v-icon>
          Làm mới
        </v-btn>
      </div>

      <!-- Table -->
      <v-data-table
        :loading="loading"
        :headers="headers"
        :items="trades"
        :items-per-page="meta.limit"
        class="dark-table"
        hide-default-footer
        density="compact"
      >
        <template #item.buyPrices="{ item }">
          {{ formatNumber(item.buyPrices[0]) }}
        </template>

        <template #item.sellPrice="{ item }">
          {{ formatNumber(item.sellPrice) }}
        </template>

        <template #item.totalAmountBuyActual="{ item }">
          {{ formatNumber(item.totalAmountBuyActual) }}
        </template>

        <template #item.totalAmountBuyUsdtSpent="{ item }">
          {{ formatPrice(item.totalAmountBuyUsdtSpent) }}
        </template>

        <template #item.totalProfit="{ item }">
          <span
            :class="{
              'text-success': item.totalProfit > 0,
              'text-error': item.totalProfit < 0,
              'text-grey': item.totalProfit === 0,
            }"
          >
            {{ formatPrice(item.totalProfit) }}
          </span>
        </template>

        <template #item.totalRevenueUsdt="{ item }">
          {{ formatPrice(item.totalRevenueUsdt) }}
        </template>

        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>
      </v-data-table>

      <!-- Pagination -->
      <v-row v-if="meta.totalPages > 1" justify="center" class="mt-4 mt-sm-6">
        <v-pagination
          v-model="page"
          :length="meta.totalPages"
          color="primary"
          total-visible="5"
          @update:model-value="fetchTrades"
          class="pagination"
          size="small"
        />
      </v-row>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useApi } from "~/apis";

interface Trade {
  id: string;
  symbol: string;
  buyPrices: number[];
  sellPrice: number;
  totalAmountBuyActual: number;
  totalAmountBuyUsdtSpent: number;
  totalProfit: number;
  totalRevenueUsdt: number;
  createdAt: string;
}

const api = useApi();
const trades = ref<Trade[]>([]);
const loading = ref(false);
const page = ref(1);
const meta = ref({
  total: 0,
  page: 1,
  limit: 15,
  totalPages: 1,
});

const headers = [
  { title: "Symbol", key: "symbol", align: "start" },
  { title: "Giá mua", key: "buyPrices", align: "end" },
  { title: "Giá bán", key: "sellPrice", align: "end" },
  { title: "SL", key: "totalAmountBuyActual", align: "end" },
  { title: "Vốn USDT", key: "totalAmountBuyUsdtSpent", align: "end" },
  { title: "Lãi/Lỗ", key: "totalProfit", align: "end" },
  { title: "Doanh thu", key: "totalRevenueUsdt", align: "end" },
  { title: "Ngày tạo", key: "createdAt", align: "center" },
];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleString("vi-VN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatNumber = (num?: number) =>
  num !== undefined
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(num)
    : "-";

const formatPrice = (num?: number) =>
  num !== undefined
    ? `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
        num
      )}`
    : "-";

async function fetchTrades() {
  try {
    loading.value = true;
    const res: any = await api.get(
      `binance/histories?page=${page.value}&limit=15`
    );
    trades.value = res.data || [];
    meta.value = res.meta || meta.value;
  } catch (err) {
    console.error("Lỗi khi fetch giao dịch:", err);
    trades.value = [];
  } finally {
    loading.value = false;
  }
}

function refresh() {
  fetchTrades();
}

onMounted(fetchTrades);
</script>

<style scoped>
.container-compact {
  max-width: 1200px;
  margin: 0 auto;
  padding-left: 8px !important;
  padding-right: 8px !important;
}

/* Card */
.dark-card {
  background: linear-gradient(145deg, #0d1723, #111b28);
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
  color: #fff;
  transition: all 0.3s ease;
}
.dark-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(79, 195, 247, 0.15);
}

.header-icon {
  background: rgba(79, 195, 247, 0.15);
  border: 1px solid rgba(79, 195, 247, 0.3);
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

/* Table */
.dark-table {
  background: transparent;
  color: #fff;
  border-radius: 10px;
  overflow-x: auto;
}

.dark-table :deep(th) {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  padding: 8px 6px;
  white-space: nowrap;
}

.dark-table :deep(td) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 12px;
  padding: 6px 4px;
  white-space: nowrap;
}
.dark-table :deep(tr:hover) {
  background: rgba(79, 195, 247, 0.05);
}

/* Refresh button */
.refresh-btn {
  background: linear-gradient(90deg, #4fc3f7, #2196f3);
  color: #fff;
  border-radius: 8px;
  text-transform: none;
  font-weight: 500;
}

/* Pagination */
.pagination :deep(.v-pagination__item) {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 12px;
  border-radius: 6px;
}
.pagination :deep(.v-pagination__item--active) {
  background: linear-gradient(90deg, #4fc3f7, #2196f3) !important;
  color: #fff;
  transform: scale(1.05);
}

/* Text colors */
.text-success {
  color: #00e676 !important;
}
.text-error {
  color: #ff5252 !important;
}
.text-grey {
  color: rgba(200, 200, 200, 0.7) !important;
}

/* Scrollbar */
:deep(.v-data-table__wrapper::-webkit-scrollbar) {
  height: 6px;
}
:deep(.v-data-table__wrapper::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
:deep(.v-data-table__wrapper::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
}

/* ===== Responsive tweaks ===== */
@media (max-width: 600px) {
  .dark-card {
    padding: 12px !important;
    border-radius: 10px;
  }

  .header-title {
    font-size: 14px;
  }

  .refresh-btn {
    font-size: 12px;
    padding: 4px 8px !important;
  }

  .dark-table :deep(th),
  .dark-table :deep(td) {
    font-size: 11px !important;
    padding: 4px 2px !important;
  }

  .container-compact {
    padding-left: 4px !important;
    padding-right: 4px !important;
  }

  .v-container {
    padding: 4px !important;
  }
}
</style>
