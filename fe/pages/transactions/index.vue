<template>
  <v-container class="py-8" dark>
    <v-card elevation="2" class="pa-4 dark-card">
      <div class="d-flex align-center justify-space-between mb-4">
        <h2 class="text-h5 font-weight-medium text-white">Lịch sử giao dịch</h2>

        <div class="d-flex align-center ga-2">
          <v-btn
            color="primary"
            @click="refresh"
            variant="flat"
            :disabled="loading"
          >
            <v-icon start>mdi-refresh</v-icon>
            Làm mới
          </v-btn>
        </div>
      </div>

      <v-data-table
        :loading="loading"
        :headers="headers"
        :items="trades"
        :items-per-page="meta.limit"
        class="dark-table"
        hide-default-footer
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
      <v-row v-if="meta.totalPages > 1" justify="center" class="mt-6">
        <v-pagination
          v-model="page"
          :length="meta.totalPages"
          color="primary"
          total-visible="5"
          @update:model-value="fetchTrades"
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
  limit: 10,
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
      `binance/histories?page=${page.value}&limit=10`
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
.dark-card {
  background-color: #1e1e2f;
  color: #ffffff;
  border-radius: 12px;
}
.dark-table {
  background-color: #1e1e2f;
  color: #ffffff;
}
.dark-table .v-data-table-header th {
  background-color: #2a2a3a;
  color: #ffffff;
}
.dark-table .v-data-table__row:hover {
  background-color: rgba(255, 255, 255, 0.05);
}
.text-success {
  color: #4caf50;
}
.text-error {
  color: #f44336;
}
</style>
