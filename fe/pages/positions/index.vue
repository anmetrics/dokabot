<template>
  <v-container class="py-8" dark>
    <v-card elevation="2" class="pa-4 dark-card">
      <div class="d-flex align-center justify-space-between mb-4">
        <div>
          <h2 class="text-h5 font-weight-medium text-white">
            Danh sách vị thế đang mở
          </h2>
          <p class="text-body-2 text-grey">
            Hiển thị toàn bộ position hiện có trong hệ thống
          </p>
        </div>
        <v-btn color="primary" @click="refresh" variant="elevated">
          <v-icon start>mdi-refresh</v-icon> Làm mới
        </v-btn>
      </div>

      <!-- Tổng quan -->
      <v-row class="mb-4">
        <v-col cols="12" sm="4">
          <v-sheet class="pa-3 rounded dark-sheet">
            <div class="text-subtitle-1 text-grey">Tổng số vị thế</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ positions.length }}
            </div>
          </v-sheet>
        </v-col>
        <v-col cols="12" sm="4">
          <v-sheet class="pa-3 rounded dark-sheet">
            <div class="text-subtitle-1 text-grey">Tổng vốn USD</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ totalUsdSpent.toFixed(2) }} USDT
            </div>
          </v-sheet>
        </v-col>
        <v-col cols="12" sm="4">
          <v-sheet class="pa-3 rounded dark-sheet">
            <div class="text-subtitle-1 text-grey">Chiến lược</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ uniqueStrategies.join(", ") }}
            </div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- Bảng danh sách -->
      <v-data-table
        :headers="headers"
        :items="positions"
        :items-per-page="5"
        class="elevation-1 dark-table"
      >
        <template #item.buyPrice="{ item }">
          {{ item.buyPrice.toLocaleString() }}
        </template>
        <template #item.usdSpent="{ item }">
          {{ item.usdSpent.toFixed(2) }}
        </template>
        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed } from "vue";

// Dữ liệu mẫu
const positions = ref([
  {
    id: "1",
    buyPrice: 1140,
    strategy: "BNBUSDT_MINI",
    symbol: "BNBUSDT",
    qty: 0.044,
    usdSpent: 49.63728,
    totalQtyActual: 0.044,
    dcaIndex: 0,
    createdAt: "2025-10-20T00:00:00.000Z",
  },
  {
    id: "2",
    buyPrice: 1257.9,
    strategy: "BNBUSDT",
    symbol: "BNBUSDT",
    qty: 0.159,
    usdSpent: 200.01,
    totalQtyActual: 0.159,
    dcaIndex: 2,
    createdAt: "2025-10-20T00:00:00.000Z",
  },
  {
    id: "3",
    buyPrice: 1300,
    strategy: "BNBUSDT",
    symbol: "BNBUSDT",
    qty: 0.076,
    usdSpent: 98,
    totalQtyActual: 0.076,
    dcaIndex: 4,
    createdAt: "2025-10-20T00:00:00.000Z",
  },
  {
    id: "4",
    buyPrice: 112870,
    strategy: "BTCUSDT_MINI",
    symbol: "BTCUSDT",
    qty: 0.00044,
    usdSpent: 49.66,
    totalQtyActual: 0.00044,
    dcaIndex: 0,
    createdAt: "2025-10-20T00:00:00.000Z",
  },
  {
    id: "5",
    buyPrice: 1100,
    strategy: "BNBUSDT",
    symbol: "BNBUSDT",
    qty: 0.045,
    usdSpent: 49.5,
    totalQtyActual: 0.045,
    dcaIndex: 3,
    createdAt: "2025-10-20T00:00:00.000Z",
  },
]);

const headers = [
  { title: "Symbol", key: "symbol", sortable: true },
  { title: "Chiến lược", key: "strategy" },
  { title: "Giá mua", key: "buyPrice", align: "end" },
  { title: "Số lượng", key: "qty", align: "end" },
  { title: "USD đã dùng", key: "usdSpent", align: "end" },
  { title: "DCA Index", key: "dcaIndex", align: "center" },
  { title: "Ngày tạo", key: "createdAt", align: "center" },
];

const totalUsdSpent = computed(() =>
  positions.value.reduce((acc, p) => acc + p.usdSpent, 0)
);

const uniqueStrategies = computed(() => [
  ...new Set(positions.value.map((p) => p.strategy)),
]);

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function refresh() {
  console.log("Làm mới danh sách position...");
}
</script>

<style scoped>
.dark-card {
  background-color: #1e1e2f;
  color: #ffffff;
}
.dark-sheet {
  background-color: #252532;
  color: #ffffff;
}
.text-grey {
  color: rgba(200, 200, 200, 0.7);
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
</style>
