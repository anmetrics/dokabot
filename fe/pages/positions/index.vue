<template>
  <v-container class="py-10">
    <v-card elevation="4" class="pa-6 dark-card">
      <div class="d-flex align-center justify-space-between mb-6">
        <div>
          <h2 class="text-h4 font-weight-bold text-white">
            Danh sách vị thế đang mở
          </h2>
        </div>
        <v-btn
          color="primary"
          @click="refresh"
          variant="elevated"
          :loading="loading"
          class="refresh-btn"
        >
          <v-icon start>mdi-refresh</v-icon> Làm mới
        </v-btn>
      </div>

      <!-- Tổng quan -->
      <v-row class="mb-6">
        <v-col cols="12" sm="6">
          <v-sheet class="pa-4 rounded-lg dark-sheet">
            <div class="text-subtitle-1 text-grey">Tổng số vị thế</div>
            <div class="text-h5 font-weight-bold text-white">
              {{ positions.length }}
            </div>
          </v-sheet>
        </v-col>
        <v-col cols="12" sm="6">
          <v-sheet class="pa-4 rounded-lg dark-sheet">
            <div class="text-subtitle-1 text-grey">Tổng vốn USD</div>
            <div class="text-h5 font-weight-bold text-white">
              {{ totalUsdSpent.toFixed(2) }} USDT
            </div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- Bảng danh sách -->
      <v-data-table
        :items="positions"
        :headers="headers"
        :items-per-page="-1"
        class="dark-table"
        :loading="loading"
        hide-default-footer
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
const loading = ref(false);

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

onMounted(fetchPositions);
</script>

<style scoped>
/* Card styling */
.dark-card {
  background: linear-gradient(135deg, #0d1723 0%, #0e1721 50%, #0f1721 100%);
  color: #ffffff;
  border-radius: 16px;
  box-shadow: 1px 6px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease;
}

.dark-card:hover {
  transform: translateY(-4px);
}

/* Sheet styling */
.dark-sheet {
  background: linear-gradient(135deg, #252532 0%, #2a2a3a 100%);
  color: #ffffff;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.dark-sheet:hover {
  background: linear-gradient(135deg, #2a2a3a 0%, #30303f 100%);
  transform: scale(1.02);
}

/* Text styling */
.text-grey {
  color: rgba(200, 200, 200, 0.7);
}

/* Table styling */
.dark-table {
  background: transparent;
  color: #ffffff;
  border-radius: 12px;
}

.dark-table :deep(.v-data-table-header th) {
  background: linear-gradient(90deg, #2a2a3a 0%, #30303f 100%);
  color: #ffffff !important;
  font-weight: 600;
  font-size: 14px;
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.dark-table :deep(.v-data-table__td) {
  padding: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.dark-table :deep(.v-data-table__tr:hover) {
  background: rgba(30, 136, 229, 0.1);
  transition: background 0.3s ease;
}

/* Refresh button */
.refresh-btn {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
  color: #ffffff;
  border-radius: 8px;
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.refresh-btn:hover {
  background: linear-gradient(90deg, #64b5f6 0%, #42a5f5 100%) !important;
  transform: translateY(-2px);
}

/* Loading animation */
:deep(.v-progress-circular) {
  color: #4fc3f7;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .dark-card {
    padding: 16px;
  }
  .dark-sheet {
    padding: 12px;
  }
  .text-h4 {
    font-size: 1.5rem !important;
  }
}

/* Scrollbar styling */
:deep(.v-data-table__wrapper::-webkit-scrollbar) {
  width: 8px;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

:deep(.v-data-table__wrapper::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
}
</style>
