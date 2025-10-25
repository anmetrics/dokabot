<template>
  <v-container class="py-6 container-compact">
    <positions-chart />
    <v-card elevation="4" class="pa-4 pa-sm-6 dark-card">
      <div
        class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between mb-4 mb-sm-6"
      >
        <div class="mb-3 mb-sm-0">
          <h2 class="text-sm-h6 text-sm-h4 font-weight-bold text-white">
            Open positions
          </h2>
        </div>

        <v-btn
          color="primary"
          @click="refresh"
          variant="elevated"
          :loading="loading"
          class="refresh-btn"
        >
          <v-icon start>mdi-refresh</v-icon>
          Làm mới
        </v-btn>
      </div>

      <!-- Tổng quan -->
      <v-row class="mb-4 mb-sm-6" dense>
        <v-col cols="12" sm="6">
          <v-sheet class="pa-3 rounded-lg dark-sheet text-center">
            <div class="text-subtitle-2 text-grey">Tổng số vị thế</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ positions.length }}
            </div>
          </v-sheet>
        </v-col>
        <v-col cols="12" sm="6">
          <v-sheet class="pa-3 rounded-lg dark-sheet text-center">
            <div class="text-subtitle-2 text-grey">Tổng vốn USD</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ totalUsdSpent.toFixed(2) }} USDT
            </div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- TABLE cho desktop/tablet -->
      <v-data-table
        v-if="!isMobile"
        :items="positions"
        :headers="headers"
        :items-per-page="8"
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
      </v-data-table>

      <!-- LIST nhỏ gọn cho mobile -->
      <div v-else class="mobile-list">
        <v-list two-line>
          <v-list-item
            v-for="item in positions"
            :key="item.id"
            class="mobile-card"
            @click="openPosition(item.id)"
            ripple
          >
            <v-list-item-content>
              <div class="d-flex justify-space-between align-center">
                <div>
                  <div class="mobile-symbol font-weight-medium">
                    {{ item.symbol }}
                  </div>
                  <div class="text-caption text-grey">{{ item.strategy }}</div>
                </div>
                <div class="text-right">
                  <div class="mobile-usd font-weight-medium">
                    {{ item.usdSpent.toFixed(2) }} USDT
                  </div>
                  <div class="text-caption text-grey">
                    {{ formatDate(item.createdAt) }}
                  </div>
                </div>
              </div>

              <div class="mobile-meta d-flex align-center mt-2">
                <v-chip small class="chip-mini">{{ item.qty }} qty</v-chip>
                <v-chip small class="chip-mini ml-2"
                  >Price: {{ Number(item.buyPrice).toLocaleString() }}</v-chip
                >
                <v-chip small class="chip-mini ml-2"
                  >DCA: {{ item.dcaIndex }}</v-chip
                >
              </div>
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApi } from "~/apis";

// Thử detect mobile bằng window width (đơn giản, không phụ vào vuetify breakpoint)
const isMobile = ref(false);
if (process.client) {
  isMobile.value = window.innerWidth <= 600;
  // lắng nghe resize để cập nhật động
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

function openPosition(id: string) {
  // placeholder: bạn có thể điều hướng tới chi tiết vị thế
  // router.push(`/positions/${id}`);
  console.log("Open position", id);
}

onMounted(fetchPositions);
</script>

<style scoped>
/* Container */
.container-compact {
  max-width: 1200px;
  margin: 0 auto;
}

/* Card */
.dark-card {
  background: linear-gradient(135deg, #0d1723 0%, #0e1721 50%, #0f1721 100%);
  color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 6px 10px rgba(0, 0, 0, 0.25);
  transition: transform 0.18s ease;
}
.dark-card:hover {
  transform: translateY(-2px);
}

/* Sheet */
.dark-sheet {
  background: linear-gradient(135deg, #252532 0%, #2a2a3a 100%);
  color: #ffffff;
  border-radius: 10px;
}

/* Table (desktop) */
.dark-table {
  background: transparent;
  color: #ffffff;
  border-radius: 10px;
}
.dark-table :deep(.v-data-table-header th) {
  background: linear-gradient(90deg, #2a2a3a 0%, #30303f 100%);
  color: #ffffff !important;
  font-weight: 600;
  font-size: 13px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.dark-table :deep(.v-data-table__td) {
  padding: 10px 12px;
  font-size: 13px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.dark-table :deep(.v-data-table__tr:hover) {
  background: rgba(30, 136, 229, 0.06);
}

/* Mobile list card */
.mobile-list {
  display: none;
}
.mobile-card {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
  border-radius: 10px;
  margin-bottom: 8px;
  padding: 12px;
  transition: background 0.15s ease, transform 0.12s ease;
  cursor: pointer;
}
.mobile-card:hover {
  transform: translateY(-3px);
  background: linear-gradient(
    180deg,
    rgba(79, 195, 247, 0.06),
    rgba(79, 195, 247, 0.02)
  );
}
.mobile-symbol {
  font-size: 1rem;
}
.mobile-usd {
  font-size: 0.95rem;
}
.mobile-meta .chip-mini {
  background: rgba(255, 255, 255, 0.04) !important;
  color: #ffffff;
  font-size: 11px;
  height: 24px;
}

/* Refresh button */
.refresh-btn {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
  color: #ffffff;
  border-radius: 8px;
  text-transform: none;
  font-weight: 500;
  padding: 6px 12px;
  font-size: 0.9rem;
}

/* Text small */
.text-grey {
  color: rgba(200, 200, 200, 0.7);
  font-size: 0.85rem;
}

/* Responsive rules */
@media (max-width: 960px) {
  .dark-card {
    padding: 12px;
  }
}

@media (max-width: 600px) {
  /* hide table, show mobile list */
  .dark-table {
    display: none;
  }
  .mobile-list {
    display: block;
  }

  .dark-card {
    padding: 10px !important;
    border-radius: 10px;
  }

  .refresh-btn {
    padding: 6px 10px;
    font-size: 0.8rem;
  }

  .dark-sheet {
    padding: 10px;
  }

  /* giảm padding cho table header/cell nếu vẫn hiển thị */
  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    padding: 8px 10px;
    font-size: 12px;
  }
}
</style>
