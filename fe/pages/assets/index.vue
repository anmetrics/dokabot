<template>
  <v-container fluid class="pa-10">
    <v-card class="rounded-xl pa-6 dark-card">
      <div class="d-flex align-center justify-space-between mb-6">
        <div>
          <h2 class="text-h4 font-weight-bold text-white">Danh sách tài sản</h2>
          <p class="text-body-1 text-grey mt-2">
            Hiển thị toàn bộ số dư tài sản hiện có trong tài khoản
          </p>
        </div>
        <v-btn
          color="primary"
          @click="refresh"
          variant="flat"
          :loading="loading"
          class="refresh-btn"
        >
          <v-icon start>mdi-refresh</v-icon>
          Làm mới
        </v-btn>
      </div>

      <!-- Tổng quan -->
      <v-row class="mb-6">
        <v-col cols="12" sm="6">
          <v-sheet class="pa-4 rounded-lg dark-sheet">
            <div class="text-subtitle-1 text-grey">Tổng tài sản</div>
            <div class="text-h5 font-weight-bold text-white">
              {{ balances.length }}
            </div>
          </v-sheet>
        </v-col>
        <v-col cols="12" sm="6">
          <v-sheet class="pa-4 rounded-lg dark-sheet">
            <div class="text-subtitle-1 text-grey">Tổng Locked</div>
            <div class="text-h5 font-weight-bold text-white">
              {{ totalLocked.toFixed(4) }}
            </div>
          </v-sheet>
        </v-col>
      </v-row>

      <v-data-table
        :items="balances"
        :headers="headers"
        :items-per-page="10"
        class="dark-table"
        :loading="loading"
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
          {{ Number(item.free).toLocaleString() }}
        </template>
        <template #item.locked="{ item }">
          {{ Number(item.locked).toLocaleString() }}
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

const headers = [
  { title: "Tài sản", key: "asset", align: "start" },
  { title: "Số dư khả dụng", key: "free", align: "end" },
  { title: "Đang khóa", key: "locked", align: "end" },
];

const totalFree = computed(() =>
  balances.value.reduce((acc, b) => acc + Number(b.free), 0)
);
const totalLocked = computed(() =>
  balances.value.reduce((acc, b) => acc + Number(b.locked), 0)
);

async function fetchBalances() {
  loading.value = true;
  try {
    const res: any = await api.get("binance/account");
    balances.value =
      res.balances.filter((b) =>
        ["BNB", "BTC", "SOL", "USDT"].includes(b.asset)
      ) || [];
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
/* Card styling */
.dark-card {
  background: linear-gradient(135deg, #0d1622 0%, #111923 100%);
  color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.dark-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(30, 136, 229, 0.2);
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

/* Chip styling */
.chip-bg {
  background: linear-gradient(90deg, #2a2a3a 0%, #30303f 100%) !important;
  color: #ffffff;
  font-weight: 500;
}

.chip-asset {
  transition: all 0.3s ease;
}

.chip-asset:hover {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
  transform: scale(1.05);
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

/* Text styling */
.text-grey {
  color: rgba(200, 200, 200, 0.7);
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .dark-card {
    padding: 16px;
  }
  .text-h4 {
    font-size: 1.5rem !important;
  }
  .text-h5 {
    font-size: 1.25rem !important;
  }
  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 0.9rem !important;
    padding: 12px;
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
