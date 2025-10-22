<template>
  <v-container fluid class="pa-6">
    <v-card class="rounded-xl pa-4" color="#1e1e1e">
      <div class="d-flex align-center justify-space-between mb-4">
        <div>
          <h2 class="text-h5 font-weight-medium text-white">
            Danh sách tài sản
          </h2>
          <p class="text-body-2 text-grey-lighten-1">
            Hiển thị toàn bộ số dư tài sản hiện có trong tài khoản
          </p>
        </div>
        <v-btn
          color="primary"
          @click="refresh"
          variant="flat"
          :loading="loading"
        >
          <v-icon start>mdi-refresh</v-icon>
          Làm mới
        </v-btn>
      </div>

      <!-- Tổng quan -->
      <v-row class="mb-4">
        <v-col cols="12" sm="6">
          <v-sheet class="pa-4 rounded-lg" color="#2a2a2a">
            <div class="text-subtitle-1 text-grey-lighten-1">Tổng tài sản</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ balances.length }}
            </div>
          </v-sheet>
        </v-col>
        <v-col cols="12" sm="6">
          <v-sheet class="pa-4 rounded-lg" color="#2a2a2a">
            <div class="text-subtitle-1 text-grey-lighten-1">Tổng Locked</div>
            <div class="text-h6 font-weight-bold text-white">
              {{ totalLocked.toFixed(4) }}
            </div>
          </v-sheet>
        </v-col>
      </v-row>

      <!-- Bảng danh sách tài sản -->
      <v-data-table
        :headers="headers"
        :items="balances"
        :items-per-page="10"
        class="text-white"
        style="background-color: transparent"
        :loading="loading"
      >
        <template #item.asset="{ item }">
          <v-chip color="#2c2c2c" variant="flat" size="small">
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
const loading = ref(false); // thêm trạng thái loading

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
  loading.value = true; // bắt đầu loading
  try {
    const res: any = await api.get("binance/account");
    balances.value =
      res.balances.filter((b) =>
        ["BNB", "BTC", "SOL", "USDT"].includes(b.asset)
      ) || [];
  } catch (err) {
    console.error("Lỗi khi fetch balances:", err);
  } finally {
    loading.value = false; // kết thúc loading
  }
}

onMounted(fetchBalances);

function refresh() {
  fetchBalances();
}
</script>

<style scoped>
.v-card {
  background-color: #1e1e1e !important;
  border: 1px solid #2c2c2c;
  color: #ffffff;
  box-shadow: none;
}

.v-data-table-header {
  background-color: #232323 !important;
}

.v-data-table th,
.v-data-table td {
  border-color: #2a2a2a !important;
}

.v-chip {
  color: #fff;
  font-weight: 500;
}

.v-btn {
  text-transform: none;
}
</style>
