<template>
  <v-container fluid class="sell-manager-container">
    <v-row justify="center">
      <v-col cols="12" xl="10">
        <!-- Page Header -->
        <div class="page-header mb-6">
          <div class="d-flex align-center gap-3">
            <div class="header-icon-wrapper">
              <v-icon size="28" color="white">mdi-cash-minus</v-icon>
            </div>
            <div>
              <h1 class="page-title">Bán tự động</h1>
              <p class="page-subtitle">
                Cập nhật giá bán tự động cho các vị thế
              </p>
            </div>
          </div>
          <v-btn
            @click="fetchPositions"
            :loading="loading"
            class="refresh-btn"
          >
            <v-icon start>mdi-refresh</v-icon>
            Refresh
          </v-btn>
        </div>

        <!-- Summary Card -->
        <v-row class="mb-6">
          <v-col cols="12" sm="6" md="3">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper">
                <v-icon size="24" color="#a78bfa">mdi-briefcase-outline</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Tổng vị thế</div>
                <div class="stat-value">{{ positions.length }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper">
                <v-icon size="24" color="#10b981">mdi-check-circle</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Đã set giá</div>
                <div class="stat-value">{{ withSellPrice }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper">
                <v-icon size="24" color="#f59e0b">mdi-alert-circle</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Chưa set giá</div>
                <div class="stat-value">{{ withoutSellPrice }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper">
                <v-icon size="24" color="#3b82f6">mdi-percent</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">Tỷ lệ hoàn thành</div>
                <div class="stat-value">{{ completionRate }}%</div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Table Card -->
        <v-card class="table-card">
          <v-data-table
            :headers="headers"
            :items="positions"
            :loading="loading"
            hide-default-footer
            class="dark-table"
            density="comfortable"
          >
            <template #item.symbol="{ item }">
              <v-chip
                size="small"
                class="symbol-chip"
                variant="flat"
              >
                {{ item.symbol }}
              </v-chip>
            </template>

            <template #item.buyPrice="{ item }">
              <span class="price-text">{{ item.buyPrice.toLocaleString() }}</span>
            </template>

            <template #item.sellPrice="{ item }">
              <v-chip
                v-if="item.sellPrice"
                size="small"
                class="sell-price-chip"
                variant="flat"
              >
                {{ item.sellPrice.toLocaleString() }}
              </v-chip>
              <v-chip
                v-else
                size="small"
                class="no-price-chip"
                variant="flat"
              >
                Chưa có
              </v-chip>
            </template>

            <template #item.actions="{ item }">
              <v-btn
                size="small"
                class="update-btn"
                @click="openDialog(item)"
                :disabled="loading"
              >
                <v-icon start size="16">mdi-pencil</v-icon>
                Update
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog cập nhật giá -->
    <v-dialog v-model="dialog" max-width="500">
      <v-card class="dialog-card">
        <div class="dialog-header">
          <v-icon color="#f59e0b" size="28">mdi-cash-edit</v-icon>
          <h3 class="dialog-title">Cập nhật giá bán</h3>
        </div>

        <v-card-text class="pa-6">
          <div class="position-info mb-5">
            <div class="info-row">
              <span class="info-label">Vị thế:</span>
              <v-chip size="small" class="symbol-chip" variant="flat">
                {{ selected?.symbol }}
              </v-chip>
            </div>
            <div class="info-row">
              <span class="info-label">Giá mua:</span>
              <span class="info-value">{{ selected?.buyPrice.toLocaleString() }} USDT</span>
            </div>
            <div class="info-row" v-if="selected?.sellPrice">
              <span class="info-label">Giá bán hiện tại:</span>
              <span class="info-value">{{ selected?.sellPrice.toLocaleString() }} USDT</span>
            </div>
          </div>

          <v-text-field
            v-model.number="sellPrice"
            label="Giá bán mới (USDT)"
            type="number"
            variant="outlined"
            density="comfortable"
            class="sell-price-input"
            placeholder="Nhập giá bán"
          >
            <template #prepend-inner>
              <v-icon color="#f59e0b" size="20">mdi-currency-usd</v-icon>
            </template>
          </v-text-field>

          <v-alert
            v-if="sellPrice && selected"
            type="info"
            variant="tonal"
            class="profit-alert"
            density="compact"
          >
            <template #prepend>
              <v-icon size="20">mdi-information</v-icon>
            </template>
            Lợi nhuận dự kiến:
            <strong :class="profitAmount >= 0 ? 'text-success' : 'text-error'">
              {{ profitAmount.toFixed(2) }} USDT ({{ profitPercent.toFixed(2) }}%)
            </strong>
          </v-alert>
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-spacer></v-spacer>
          <v-btn
            variant="text"
            class="cancel-btn"
            @click="closeDialog"
          >
            Hủy
          </v-btn>
          <v-btn
            class="confirm-btn"
            :loading="loading"
            @click="confirmUpdate"
          >
            <v-icon start>mdi-check</v-icon>
            Cập nhật
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
      location="top"
    >
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false">Đóng</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
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
  { title: "Symbol", key: "symbol", align: "start" as const },
  { title: "Chiến lược", key: "strategy", align: "start" as const },
  { title: "Giá mua", key: "buyPrice", align: "end" as const },
  { title: "Giá bán hiện tại", key: "sellPrice", align: "center" as const },
  { title: "Actions", key: "actions", align: "center" as const },
];

const withSellPrice = computed(() =>
  positions.value.filter(p => p.sellPrice).length
);

const withoutSellPrice = computed(() =>
  positions.value.filter(p => !p.sellPrice).length
);

const completionRate = computed(() =>
  positions.value.length > 0
    ? Math.round((withSellPrice.value / positions.value.length) * 100)
    : 0
);

const profitAmount = computed(() => {
  if (!sellPrice.value || !selected.value) return 0;
  return sellPrice.value - selected.value.buyPrice;
});

const profitPercent = computed(() => {
  if (!sellPrice.value || !selected.value || selected.value.buyPrice === 0) return 0;
  return ((sellPrice.value - selected.value.buyPrice) / selected.value.buyPrice) * 100;
});

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
    showToast(`✅ Đã cập nhật giá bán cho ${selected.value.symbol}!`, "success");
    await fetchPositions();
  } catch (err: any) {
    showToast(`❌ ${err.message || "Cập nhật thất bại!"}`, "error");
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
.sell-manager-container {
  max-width: 1400px;
  padding: 24px;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-icon-wrapper {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #94a3b8;
  margin: 4px 0 0 0;
}

.refresh-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%) !important;
  color: white;
  text-transform: none;
  font-weight: 600;
  border-radius: 12px;
  font-size: 14px;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
  transition: all 0.3s ease;
}

.refresh-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
}

/* Stat Cards */
.stat-card {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.1) 0%,
    rgba(167, 139, 250, 0.05) 100%
  );
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(167, 139, 250, 0.15);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.15) 0%,
    rgba(167, 139, 250, 0.08) 100%
  );
  transform: translateY(-3px);
  border-color: rgba(167, 139, 250, 0.3);
  box-shadow: 0 8px 20px rgba(124, 58, 237, 0.2);
}

.stat-icon-wrapper {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.1);
  border-radius: 12px;
}

.stat-content {
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 13px;
  color: #94a3b8;
  font-weight: 500;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #f1f5f9;
}

/* Table Card */
.table-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
}

.dark-table {
  background: transparent;
  color: #f1f5f9;
}

.dark-table :deep(.v-data-table-header th) {
  background: rgba(167, 139, 250, 0.08);
  color: #f1f5f9 !important;
  font-weight: 600;
  font-size: 13px;
  padding: 16px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.dark-table :deep(.v-data-table__td) {
  padding: 14px 16px;
  font-size: 14px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.05);
  color: #f1f5f9;
}

.dark-table :deep(.v-data-table__tr:hover) {
  background: rgba(167, 139, 250, 0.05);
  transition: background 0.2s ease;
}

.symbol-chip {
  background: rgba(124, 58, 237, 0.2) !important;
  color: #a78bfa !important;
  font-weight: 600;
  border: 1px solid rgba(167, 139, 250, 0.3);
}

.price-text {
  color: #f1f5f9;
  font-weight: 500;
}

.sell-price-chip {
  background: rgba(16, 185, 129, 0.15) !important;
  color: #10b981 !important;
  font-weight: 600;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.no-price-chip {
  background: rgba(239, 68, 68, 0.15) !important;
  color: #ef4444 !important;
  font-weight: 600;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.update-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
  color: white !important;
  text-transform: none;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
  transition: all 0.3s ease;
}

.update-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

/* Dialog */
.dialog-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #f1f5f9;
}

.dialog-header {
  padding: 24px 24px 16px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.dialog-title {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.position-info {
  background: rgba(167, 139, 250, 0.05);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 12px;
  padding: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
}

.info-value {
  font-size: 14px;
  color: #f1f5f9;
  font-weight: 600;
}

.sell-price-input :deep(.v-field) {
  background: rgba(167, 139, 250, 0.05);
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #f1f5f9;
}

.sell-price-input :deep(.v-field:hover) {
  border-color: rgba(167, 139, 250, 0.4);
}

.profit-alert {
  background: rgba(59, 130, 246, 0.1) !important;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  font-size: 13px;
}

.text-success {
  color: #10b981;
}

.text-error {
  color: #ef4444;
}

.cancel-btn {
  color: #94a3b8;
  text-transform: none;
  font-weight: 600;
}

.confirm-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%) !important;
  color: white;
  text-transform: none;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}

.confirm-btn:hover {
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
}

/* Responsive */
@media (max-width: 960px) {
  .sell-manager-container {
    padding: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .header-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .refresh-btn {
    width: 100%;
  }

  .stat-value {
    font-size: 20px;
  }
}

@media (max-width: 600px) {
  .page-title {
    font-size: 20px;
  }

  .stat-value {
    font-size: 18px;
  }

  .dialog-header {
    padding: 20px 20px 12px 20px;
  }

  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 12px;
    padding: 8px 6px;
  }
}

@media (max-width: 480px) {
  .sell-manager-container {
    padding: 12px;
  }

  .page-title {
    font-size: 18px;
  }

  .header-icon-wrapper {
    width: 40px;
    height: 40px;
  }

  .stat-card {
    padding: 8px 4px;
  }

  .stat-label {
    font-size: 10px;
  }

  .stat-value {
    font-size: 16px;
  }

  .refresh-btn {
    padding: 8px 12px;
    font-size: 11px;
    min-height: 44px;
  }

  .update-btn {
    padding: 4px 8px;
    font-size: 10px;
    min-height: 32px;
  }

  .dialog-header {
    padding: 16px;
  }

  .dialog-header h3 {
    font-size: 16px;
  }

  .v-dialog {
    max-width: 95vw !important;
  }

  .dialog-content {
    padding: 16px;
  }

  .sell-price-input {
    font-size: 13px;
  }

  .profit-alert {
    font-size: 12px;
    padding: 10px;
  }

  .cancel-btn,
  .confirm-btn {
    padding: 10px 16px;
    font-size: 12px;
    min-height: 44px;
  }

  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 11px;
    padding: 6px 4px;
  }
}
</style>
