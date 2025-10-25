<template>
  <v-container fluid class="pa-6 pa-sm-8 pa-md-10">
    <v-card class="rounded-xl pa-4 pa-sm-6 dark-card">
      <!-- Header -->
      <div
        class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between mb-4 mb-sm-6"
      >
        <div class="mb-4 mb-sm-0">
          <h2 class="text-sm-h6 text-sm-h4 font-weight-bold text-white">
            Danh sách tài sản
          </h2>
          <p class="text-body-2 text-sm-body-1 text-grey mt-1 mt-sm-2">
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
      <v-row class="mb-4 mb-sm-6" dense>
        <v-col cols="12" sm="12">
          <v-sheet class="pa-3 pa-sm-4 rounded-lg dark-sheet text-center">
            <div class="text-subtitle-2 text-grey">Tổng tài sản</div>
            <div class="text-h6 text-sm-h5 font-weight-bold text-white">
              {{ balances.length }}
            </div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- Bảng tài sản -->
      <v-data-table
        :items="balances"
        :headers="headers"
        :items-per-page="6"
        class="dark-table"
        :loading="loading"
        density="compact"
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
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25);
  transition: all 0.3s ease;
}
.dark-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(30, 136, 229, 0.2);
}

/* Sheet styling */
.dark-sheet {
  background: linear-gradient(135deg, #232355 0%, #2a2a3a 100%);
  color: #ffffff;
  border-radius: 12px;
  transition: all 0.3s ease;
}
.dark-sheet:hover {
  background: linear-gradient(135deg, #232355 0%, #30303f 100%);
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
  background: rgba(30, 136, 229, 0.08);
}

/* Chip styling */
.chip-bg {
  background: linear-gradient(90deg, #2a2a3a 0%, #30303f 100%) !important;
  color: #ffffff;
}
.chip-asset {
  transition: all 0.3s ease;
  font-size: 0.8rem;
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
  font-size: 0.9rem;
  padding: 6px 14px;
}

/* Text styling */
.text-grey {
  color: rgba(200, 200, 200, 0.7);
}

/* Responsive tweaks */
@media (max-width: 600px) {
  .v-card {
    padding: 12px !important;
  }
  .text-h5 {
    font-size: 1.1rem !important;
  }
  .refresh-btn {
    font-size: 0.8rem;
    padding: 6px 10px;
  }
  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 0.8rem !important;
    padding: 8px 10px;
  }
  .v-chip {
    font-size: 0.75rem !important;
    height: 24px !important;
  }
}
</style>
