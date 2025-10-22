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
        <v-btn
          color="primary"
          @click="refresh"
          variant="elevated"
          :loading="loading"
        >
          <v-icon start>mdi-refresh</v-icon> Làm mới
        </v-btn>
      </div>

      <!-- Tổng quan -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6">
          <v-sheet class="pa-3 rounded dark-sheet">
            <div class="text-subtitle-1 text-grey">Tổng số vị thế</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ positions.length }}
            </div>
          </v-sheet>
        </v-col>
        <v-col cols="12" sm="6">
          <v-sheet class="pa-3 rounded dark-sheet">
            <div class="text-subtitle-1 text-grey">Tổng vốn USD</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ totalUsdSpent.toFixed(2) }} USDT
            </div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- Bảng danh sách -->
      <v-data-table
        :headers="headers"
        :items="positions"
        :items-per-page="10"
        class="elevation-1 dark-table"
        :loading="loading"
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

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApi } from "~/apis";

interface Position {
  id: string;
  buyPrice: number;
  strategy: string;
  symbol: string;
  qty: number;
  usdSpent: number;
  totalQtyActual: number;
  dcaIndex: number;
  createdAt: string;
}

const api = useApi();
const positions = ref<Position[]>([]);
const loading = ref(false); // thêm trạng thái loading

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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchPositions() {
  loading.value = true; // bắt đầu loading
  try {
    const res: any = await api.get("binance/positions");
    positions.value = res || [];
  } catch (err) {
    console.error("Lỗi khi fetch positions:", err);
  } finally {
    loading.value = false; // kết thúc loading
  }
}

function refresh() {
  fetchPositions();
}

onMounted(fetchPositions);
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
