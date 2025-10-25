<template>
  <v-container class="py-6 container-compact">
    <v-card elevation="2" class="pa-4 dark-card">
      <div class="d-flex align-center justify-space-between mb-3">
        <h2 class="text-h6 font-weight-medium text-white">Lịch sử giao dịch</h2>

        <v-btn
          color="primary"
          @click="refresh"
          variant="flat"
          :disabled="loading"
          class="refresh-btn"
        >
          <v-icon start>mdi-refresh</v-icon>
          Làm mới
        </v-btn>
      </div>

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
          {{ item.buyPrices[0]?.toLocaleString() }}
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
      <v-row v-if="meta.totalPages > 1" justify="center" class="mt-4">
        <v-pagination
          v-model="page"
          :length="meta.totalPages"
          color="primary"
          total-visible="5"
          @update:model-value="fetchTrades"
          class="pagination"
        ></v-pagination>
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
  { title: "Symbol", key: "symbol" },
  { title: "Giá mua", key: "buyPrices", align: "end" },
  { title: "Giá bán", key: "sellPrice", align: "end" },
  { title: "Số lượng", key: "totalAmountBuyActual", align: "end" },
  { title: "Tổng vốn USDT", key: "totalAmountBuyUsdtSpent", align: "end" },
  { title: "Lãi/Lỗ", key: "totalProfit", align: "end" },
  { title: "Doanh thu USDT", key: "totalRevenueUsdt", align: "end" },
  { title: "Ngày tạo", key: "createdAt", align: "center" },
];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatNumber = (num: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(num);

const formatPrice = (num: number) =>
  `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    num
  )}`;

async function fetchTrades() {
  try {
    loading.value = true;
    const res: any = await api.get(
      `binance/histories?page=${page.value}&limit=15`
    );
    trades.value = res.data || [];
    meta.value = res.meta || meta.value;
  } catch (err) {
    console.error("Lỗi khi fetch transactions:", err);
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
  max-width: 1100px;
  margin: 0 auto;
}

/* Card */
.dark-card {
  background: linear-gradient(135deg, #0b1620 0%, #1b2535 100%);
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dark-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(30, 136, 229, 0.15);
}

/* Table */
.dark-table {
  background: transparent;
  color: #fff;
  border-radius: 10px;
}

.dark-table :deep(.v-data-table-header th) {
  background: linear-gradient(90deg, #2a2a3a 0%, #30303f 100%);
  color: #fff !important;
  font-weight: 600;
  font-size: 13px;
  padding: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.dark-table :deep(.v-data-table__td) {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 12px;
}

.dark-table :deep(.v-data-table__tr:hover) {
  background: rgba(30, 136, 229, 0.08);
  transition: background 0.2s ease;
}

/* Refresh button */
.refresh-btn {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
  color: #fff;
  border-radius: 6px;
  text-transform: none;
  font-weight: 500;
  font-size: 0.85rem;
  padding: 5px 10px;
}

.refresh-btn:hover {
  background: linear-gradient(90deg, #64b5f6 0%, #42a5f5 100%) !important;
  transform: translateY(-1px);
}

/* Pagination */
.pagination :deep(.v-pagination__item) {
  background: #2a2a3a;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
}

.pagination :deep(.v-pagination__item--active) {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
  color: #fff;
}

.pagination :deep(.v-btn) {
  border-radius: 6px;
}

/* Loading */
:deep(.v-progress-circular) {
  color: #4fc3f7;
}

/* Text colors */
.text-success {
  color: #00e676;
  font-size: 12px;
}

.text-error {
  color: #ff5252;
  font-size: 12px;
}

/* Responsive */
@media (max-width: 600px) {
  .dark-card {
    padding: 12px;
  }
  .text-h6 {
    font-size: 1rem !important;
  }
  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 11px;
    padding: 8px;
  }
}

/* Scrollbar */
:deep(.v-data-table__wrapper::-webkit-scrollbar) {
  width: 6px;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
}
</style>
