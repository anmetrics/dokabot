<template>
  <v-container class="py-6 px-0 container-compact">
    <v-card elevation="6" class="pa-4 pa-sm-6 dark-card">
      <!-- Header -->
      <div
        class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between mb-6"
      >
        <div class="d-flex align-center gap-2 mb-3 mb-sm-0">
          <v-avatar size="36" class="header-icon">
            <v-icon size="24" color="amber">mdi-cash-edit</v-icon>
          </v-avatar>
          <span class="text-h6 font-weight-medium ml-3">Update sell price</span>
        </div>
        <v-btn color="primary" @click="fetchPositions" :loading="loading">
          <v-icon start>mdi-refresh</v-icon>
          Refresh
        </v-btn>
      </div>

      <!-- Table -->
      <v-data-table
        :headers="headers"
        :items="positions"
        :loading="loading"
        hide-default-footer
        class="dark-table"
        density="compact"
      >
        <template #item.buyPrice="{ item }">
          {{ item.buyPrice.toLocaleString() }}
        </template>

        <template #item.sellPrice="{ item }">
          <span v-if="item.sellPrice">{{
            item.sellPrice.toLocaleString()
          }}</span>
          <span v-else class="text-grey">Chưa có</span>
        </template>

        <template #item.actions="{ item }">
          <v-btn
            small
            color="amber"
            @click="openDialog(item)"
            :disabled="loading"
          >
            Update Price
          </v-btn>
        </template>
      </v-data-table>
    </v-card>

    <!-- Dialog cập nhật giá -->
    <v-dialog v-model="dialog" max-width="400">
      <v-card class="dark-card pa-4">
        <v-card-title class="text-h6 mb-2">
          <v-icon color="amber" start>mdi-cash</v-icon>
          Cập nhật giá bán
        </v-card-title>
        <v-card-text>
          <div class="mb-3">
            <div>
              Vị thế: <strong>{{ selected?.symbol }}</strong>
            </div>
            <div>Giá mua: {{ selected?.buyPrice.toLocaleString() }} USDT</div>
          </div>

          <v-text-field
            v-model="sellPrice"
            label="Giá bán mới"
            type="number"
            density="compact"
            color="amber"
            hide-details
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text color="grey" @click="closeDialog">Hủy</v-btn>
          <v-btn color="amber" :loading="loading" @click="confirmUpdate">
            Cập nhật
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2500">
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useApi } from "~/apis";

const api = useApi();
const positions = ref<any[]>([]);
const loading = ref(false);
const dialog = ref(false);
const selected = ref<any>(null);
const sellPrice = ref<number | null>(null);

const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

const headers = [
  { title: "Symbol", key: "symbol" },
  { title: "Chiến lược", key: "strategy" },
  { title: "Giá mua", key: "buyPrice", align: "end" },
  { title: "Giá bán hiện tại", key: "sellPrice", align: "end" },
  { title: "Actions", key: "actions", align: "center" },
];

async function fetchPositions() {
  loading.value = true;
  try {
    const res: any = await api.get("binance/positions");
    positions.value = res || [];
  } catch (err) {
    console.error(err);
    showToast("Không thể tải danh sách vị thế", "error");
  } finally {
    loading.value = false;
  }
}

function openDialog(item: any) {
  selected.value = item;
  sellPrice.value = item.sellPrice || null;
  dialog.value = true;
}

function closeDialog() {
  dialog.value = false;
  selected.value = null;
  sellPrice.value = null;
}

async function confirmUpdate() {
  if (!selected.value || !sellPrice.value) {
    showToast("Vui lòng nhập giá bán hợp lệ!", "warning");
    return;
  }
  loading.value = true;
  try {
    await api.patch("binance/update-sell-price", {
      id: selected.value.id,
      price: Number(sellPrice.value),
    });
    showToast(`Đã cập nhật giá bán cho ${selected.value.symbol}!`, "success");
    await fetchPositions();
  } catch (err: any) {
    showToast(err.message || "Cập nhật thất bại!", "error");
  } finally {
    closeDialog();
    loading.value = false;
  }
}

function showToast(message: string, color: string) {
  snackbar.value = { show: true, message, color };
}

onMounted(fetchPositions);
</script>

<style scoped>
.container-compact {
  max-width: 1100px;
  margin: 0 auto;
}
.dark-card {
  background: linear-gradient(145deg, #0d1723, #111b28);
  border-radius: 16px;
  color: #fff;
}
.header-icon {
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid rgba(255, 193, 7, 0.3);
}
.dark-table {
  background: transparent;
  color: #fff;
}
.dark-table :deep(th) {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-weight: 600;
}
.dark-table :deep(td) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 13px;
}
.text-grey {
  color: rgba(200, 200, 200, 0.6);
}
</style>
