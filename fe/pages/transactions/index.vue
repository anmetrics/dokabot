<template>
  <v-container class="py-8" dark>
    <v-card elevation="2" class="pa-4 dark-card">
      <div class="d-flex align-center justify-space-between mb-4">
        <h2 class="text-h5 font-weight-medium text-white">Lịch sử giao dịch</h2>
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

      <v-data-table
        :loading="loading"
        :headers="headers"
        :items="trades"
        :items-per-page="10"
        class="dark-table"
      >
        <template #item.buyPrices="{ item }">
          {{ item.buyPrices.toLocaleString() }}
        </template>
        <template #item.sellPrice="{ item }">
          {{ item.sellPrice.toLocaleString() }}
        </template>
        <template #item.totalAmountBuyActual="{ item }">
          {{ item.totalAmountBuyActual }}
        </template>
        <template #item.totalAmountBuyUsdtSpent="{ item }">
          {{ item.totalAmountBuyUsdtSpent.toFixed(2) }}
        </template>
        <template #item.totalProfit="{ item }">
          <span
            :class="{
              'text-success': item.totalProfit > 0,
              'text-error': item.totalProfit < 0,
            }"
          >
            {{ item.totalProfit.toFixed(2) }}
          </span>
        </template>
        <template #item.totalRevenueUsdt="{ item }">
          {{ item.totalRevenueUsdt.toFixed(2) }}
        </template>
        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useApi } from "~/apis";

interface Trade {
  id: string;
  symbol: string;
  buyPrices: number;
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

const headers = [
  { title: "Symbol", key: "symbol" },
  { title: "Giá mua", key: "buyPrices", align: "end" },
  { title: "Giá bán", key: "sellPrice", align: "end" },
  { title: "Tổng lượng", key: "totalAmountBuyActual", align: "end" },
  { title: "Tổng vốn USDT", key: "totalAmountBuyUsdtSpent", align: "end" },
  { title: "Lãi/Lỗ", key: "totalProfit", align: "end" },
  { title: "Doanh thu USDT", key: "totalRevenueUsdt", align: "end" },
  { title: "Ngày tạo", key: "createdAt", align: "center" },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchTrades() {
  try {
    loading.value = true;
    const res: any = await api.get("binance/histories");
    trades.value = res || [];
  } catch (err) {
    console.error("Lỗi khi fetch transactions:", err);
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
