<template>
  <v-container fluid class="positions-container">
    <v-row justify="center">
      <v-col cols="12" xl="10">
        <!-- Page Header -->
        <div class="page-header mb-6">
          <div class="d-flex align-center gap-3">
            <div class="header-icon-wrapper">
              <v-icon size="28" color="white">mdi-chart-line-variant</v-icon>
            </div>
            <div>
              <h1 class="page-title">Vị thế giao dịch</h1>
              <p class="page-subtitle">
                Quản lý và theo dõi các vị thế đang mở
              </p>
            </div>
          </div>
          <div class="header-actions">
            <v-btn
              @click="refresh"
              :loading="loading"
              class="action-btn refresh-btn"
            >
              <v-icon start>mdi-refresh</v-icon>
              Refresh
            </v-btn>
            <v-btn @click="goToSellManager" class="action-btn sell-manager-btn">
              <v-icon start>mdi-cash-multiple</v-icon>
              Sell Manager
            </v-btn>
          </div>
        </div>

        <!-- Summary stats -->
        <v-row class="mb-6">
          <v-col cols="12" sm="6" md="3" v-for="(stat, i) in stats" :key="i">
            <v-card class="stat-card">
              <div class="stat-icon-wrapper-small">
                <v-icon :color="stat.color" size="18">{{ stat.icon }}</v-icon>
              </div>
              <div class="stat-content">
                <div class="stat-label">{{ stat.label }}</div>
                <div class="stat-value" :class="stat.class || ''">
                  {{ stat.value }}
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Table (desktop) -->
        <v-card class="table-card">
          <v-data-table
            v-if="!isMobile"
            :items="positions"
            :headers="headers"
            :items-per-page="800"
            class="dark-table"
            :loading="loading"
            density="comfortable"
            hide-default-footer
          >
        <template #item="{ item }">
          <tr :class="{ 'dual-row': item.isDualInvestment }">
            <td>{{ item.symbol }}</td>
            <td>
              <span>
                {{ item.strategy }}
                <v-chip
                  v-if="item.isDualInvestment"
                  size="x-small"
                  class="dual-label ml-1"
                >
                  Dual
                </v-chip>
              </span>
            </td>
            <td class="text-end">
              {{ Number(item.buyPrice).toLocaleString() }}
            </td>
            <td class="text-end">{{ item.qty }}</td>
            <td class="text-end">{{ item.usdSpent.toFixed(2) }}</td>
            <td class="text-center">{{ item.dcaIndex }}</td>
            <td class="text-center">{{ formatDate(item.createdAt) }}</td>
            <td class="text-end">
              <span :class="item.profit > 0 ? 'text-profit' : 'text-loss'">
                {{ item.profit.toFixed(2) }} USDT ({{
                  item.profitPercent.toFixed(2)
                }}%)
              </span>
            </td>
            <td class="text-center">
              <div class="d-flex justify-center gap-2">
                <!-- Bán -->
                <v-btn
                  v-if="!item.isDualInvestment"
                  size="small"
                  :class="
                    item.profitPercent >= 0.5 ? 'btn-sell' : 'btn-disabled'
                  "
                  :disabled="item.profitPercent < 0.5"
                  @click="confirmSell(item)"
                >
                  <v-icon start size="16">mdi-cash-check</v-icon>
                  Bán
                </v-btn>
                <!-- Dual -->
                <v-btn
                  v-if="!item.isDualInvestment"
                  size="small"
                  class="btn-dual"
                  @click="confirmDual(item)"
                >
                  <v-icon start size="16">mdi-swap-horizontal</v-icon>
                  Dual
                </v-btn>
                <!-- Huỷ Dual -->
                <v-btn
                  v-else
                  size="small"
                  class="btn-cancel-dual"
                  @click="confirmCancelDual(item)"
                >
                  <v-icon start size="16">mdi-cancel</v-icon>
                  Huỷ Dual
                </v-btn>
              </div>
            </td>
          </tr>
        </template>
          </v-data-table>

          <!-- Mobile -->
          <div v-if="isMobile" class="mobile-list">
        <v-list>
          <v-list-item
            v-for="item in positions"
            :key="item.id"
            class="mobile-card mb-3"
            rounded
            elevation="1"
          >
            <v-list-item-content>
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="mobile-symbol text-h6 font-weight-medium">
                  {{ item.symbol }}
                </span>
                <v-chip
                  small
                  :color="item.profit > 0 ? 'green' : 'red'"
                  class="text-white font-weight-500"
                >
                  {{ item.profitPercent.toFixed(2) }}%
                </v-chip>
              </div>
              <div class="d-flex flex-wrap mb-2 chip-group">
                <v-chip size="small" color="cyan-darken-2" variant="flat">
                  Mua: {{ item.buyPrice.toLocaleString() }}
                </v-chip>
                <v-chip
                  size="small"
                  color="deep-purple-darken-2"
                  variant="flat"
                >
                  USDT: {{ item.usdSpent.toFixed(1) }}
                </v-chip>
                <v-chip
                  v-if="item.isDualInvestment"
                  size="small"
                  color="purple"
                  variant="flat"
                  class="text-white"
                >
                  Dual
                </v-chip>
              </div>
              <div class="d-flex justify-space-between align-center">
                <span class="text-caption text-grey">
                  {{ formatDate(item.createdAt) }}
                </span>
                <div class="d-flex gap-1">
                  <v-btn
                    x-small
                    rounded
                    :class="
                      item.profitPercent >= 0.5
                        ? 'btn-green'
                        : 'btn-disabled-dark'
                    "
                    @click.stop="confirmSell(item)"
                    :disabled="item.profitPercent < 0.5"
                  >
                    Bán
                  </v-btn>
                  <v-btn
                    x-small
                    rounded
                    v-if="!item.isDualInvestment"
                    color="deep-purple"
                    @click.stop="confirmDual(item)"
                  >
                    Dual
                  </v-btn>
                  <v-btn
                    x-small
                    rounded
                    v-else
                    color="grey-darken-2"
                    @click.stop="confirmCancelDual(item)"
                  >
                    Huỷ
                  </v-btn>
                </div>
              </div>
            </v-list-item-content>
          </v-list-item>
        </v-list>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Confirm Sell Dialog -->
    <v-dialog v-model="dialog" max-width="400">
      <v-card class="dark-card pa-4">
        <v-card-title class="text-h6 mb-2">
          <v-icon color="red" start>mdi-alert-octagon</v-icon>
          Xác nhận bán
        </v-card-title>
        <v-card-text>
          <div v-if="errorMessage" class="text-red mb-2">
            {{ errorMessage }}
          </div>
          <div>
            Bán <strong>{{ selectedPosition?.symbol }}</strong
            >?
          </div>
          <div class="mt-2">
            <strong>Giá mua:</strong>
            {{ selectedPosition?.buyPrice.toLocaleString() }} USDT
          </div>
          <div>
            <strong>Lợi nhuận:</strong>
            <span
              :class="
                selectedPosition?.profit && selectedPosition.profit >= 0
                  ? 'text-profit'
                  : 'text-loss'
              "
            >
              {{ selectedPosition?.profit.toFixed(2) }} USDT ({{
                selectedPosition?.profitPercent.toFixed(2)
              }}%)
            </span>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text color="grey" @click="closeDialog">Hủy</v-btn>
          <v-btn color="red darken-1" :loading="loading" @click="sellConfirmed">
            Bán ngay
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm Dual Dialog -->
    <v-dialog v-model="dualDialog" max-width="400">
      <v-card class="dark-card pa-4">
        <v-card-title class="text-h6 mb-2">
          <v-icon color="deep-purple" start>mdi-swap-horizontal</v-icon>
          Kích hoạt Dual Investment
        </v-card-title>
        <v-card-text>
          Bạn có chắc muốn bật Dual cho
          <strong>{{ selectedPosition?.symbol }}</strong
          >?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text color="grey" @click="closeDualDialog">Hủy</v-btn>
          <v-btn color="deep-purple" :loading="loading" @click="dualConfirmed">
            Xác nhận
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirm Cancel Dual Dialog -->
    <v-dialog v-model="cancelDualDialog" max-width="400">
      <v-card class="dark-card pa-4">
        <v-card-title class="text-h6 mb-2">
          <v-icon color="orange" start>mdi-cancel</v-icon>
          Huỷ Dual Investment
        </v-card-title>
        <v-card-text>
          Bạn có chắc muốn huỷ Dual của
          <strong>{{ selectedPosition?.symbol }}</strong
          >?
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn text color="grey" @click="closeCancelDualDialog">Hủy</v-btn>
          <v-btn color="orange" :loading="loading" @click="cancelDualConfirmed">
            Xác nhận
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApi } from "~/apis";

const router = useRouter();
const api = useApi();

const isMobile = ref(false);
if (process.client) {
  isMobile.value = window.innerWidth <= 600;
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
  dcaIndex: number;
  profit: number;
  profitPercent: number;
  isDualInvestment: boolean;
  createdAt: string;
}

const positions = ref<Position[]>([]);
const loading = ref(false);

const headers = [
  { title: "Symbol", key: "symbol", align: "start" as const },
  { title: "Chiến lược", key: "strategy", align: "start" as const },
  { title: "Giá mua", key: "buyPrice", align: "end" as const },
  { title: "Số lượng", key: "qty", align: "end" as const },
  { title: "USD đã dùng", key: "usdSpent", align: "end" as const },
  { title: "DCA", key: "dcaIndex", align: "center" as const },
  { title: "Ngày tạo", key: "createdAt", align: "center" as const },
  { title: "Lợi nhuận", key: "profit", align: "end" as const },
  { title: "Actions", key: "actions", align: "center" as const },
];

const totalUsdSpent = computed(() =>
  positions.value.reduce((acc, p) => acc + p.usdSpent, 0)
);
const totalProfit = computed(() =>
  positions.value.reduce((acc, p) => acc + p.profit, 0)
);
const avgProfitPercent = computed(() =>
  positions.value.length
    ? positions.value.reduce((a, b) => a + b.profitPercent, 0) /
      positions.value.length
    : 0
);

const stats = computed(() => [
  {
    label: "Tổng vị thế",
    icon: "mdi-briefcase-outline",
    color: "cyan",
    value: positions.value.length,
  },
  {
    label: "Tổng vốn USDT",
    icon: "mdi-currency-usd",
    color: "amber",
    value: totalUsdSpent.value.toFixed(2),
  },
  {
    label: "Unrealized P/L",
    icon: "mdi-trending-up",
    color: "green",
    class: totalProfit.value >= 0 ? "text-profit" : "text-loss",
    value: totalProfit.value.toFixed(2),
  },
  {
    label: "Tỷ suất trung bình",
    icon: "mdi-finance",
    color: "deep-purple",
    class: avgProfitPercent.value >= 0 ? "text-profit" : "text-loss",
    value: `${avgProfitPercent.value.toFixed(2)}%`,
  },
]);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

/* --- Dialog --- */
const dialog = ref(false);
const dualDialog = ref(false);
const cancelDualDialog = ref(false);
const selectedPosition = ref<Position | null>(null);
const errorMessage = ref("");

function confirmSell(position: Position) {
  if (position.profit <= 0) {
    alert("Chỉ có thể bán vị thế có lãi!");
    return;
  }
  selectedPosition.value = position;
  dialog.value = true;
}

function confirmDual(position: Position) {
  selectedPosition.value = position;
  dualDialog.value = true;
}

function confirmCancelDual(position: Position) {
  selectedPosition.value = position;
  cancelDualDialog.value = true;
}

function closeDialog() {
  dialog.value = false;
  selectedPosition.value = null;
  errorMessage.value = "";
}
function closeDualDialog() {
  dualDialog.value = false;
  selectedPosition.value = null;
}
function closeCancelDualDialog() {
  cancelDualDialog.value = false;
  selectedPosition.value = null;
}

async function sellConfirmed() {
  if (!selectedPosition.value) return;
  loading.value = true;
  try {
    await api.post("binance/sell", { id: selectedPosition.value.id });
    await fetchPositions();
    closeDialog();
  } catch (err: any) {
    errorMessage.value = err.message || "Bán thất bại!";
  } finally {
    loading.value = false;
  }
}

async function dualConfirmed() {
  if (!selectedPosition.value) return;
  loading.value = true;
  try {
    await api.post("binance/dual", {
      id: selectedPosition.value.id,
      status: 1,
    });
    await fetchPositions();
    closeDualDialog();
  } catch (err: any) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

async function cancelDualConfirmed() {
  if (!selectedPosition.value) return;
  loading.value = true;
  try {
    await api.post("binance/dual", {
      id: selectedPosition.value.id,
      status: 0,
    });
    await fetchPositions();
    closeCancelDualDialog();
  } catch (err: any) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function goToSellManager() {
  router.push("/sell-manager");
}

onMounted(fetchPositions);
</script>

<style scoped>
.positions-container {
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

.header-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  text-transform: none;
  font-weight: 600;
  border-radius: 12px;
  font-size: 14px;
  letter-spacing: 0.02em;
  transition: all 0.3s ease;
}

.refresh-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%) !important;
  color: white;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.refresh-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
}

.sell-manager-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%) !important;
  color: white;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.sell-manager-btn:hover {
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
  border-radius: 10px;
  padding: 10px 12px;
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

.stat-icon-wrapper-small {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.1);
  border-radius: 8px;
}

.stat-content {
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
  margin-bottom: 3px;
}

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
}

.text-profit {
  color: #10b981 !important;
}

.text-loss {
  color: #ef4444 !important;
}

/* Table Card */
.table-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  padding: 0;
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

.dual-row {
  background: linear-gradient(
    90deg,
    rgba(124, 58, 237, 0.15),
    rgba(167, 139, 250, 0.1)
  ) !important;
  border-left: 3px solid #a78bfa;
}

.dual-label {
  background: linear-gradient(90deg, #7c3aed, #a78bfa);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Action Buttons */
.btn-sell {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
  color: white !important;
  text-transform: none;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  transition: all 0.3s ease;
}

.btn-sell:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.btn-disabled {
  background: rgba(100, 116, 139, 0.2) !important;
  color: #64748b !important;
  text-transform: none;
  font-weight: 600;
  border-radius: 8px;
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-dual {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%) !important;
  color: white !important;
  text-transform: none;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
  transition: all 0.3s ease;
}

.btn-dual:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
}

.btn-cancel-dual {
  background: linear-gradient(135deg, #64748b 0%, #475569 100%) !important;
  color: white !important;
  text-transform: none;
  font-weight: 600;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(100, 116, 139, 0.3);
  transition: all 0.3s ease;
}

.btn-cancel-dual:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(100, 116, 139, 0.4);
}

/* Mobile */
.mobile-list {
  padding: 16px 0;
}

.mobile-card {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.08) 0%,
    rgba(167, 139, 250, 0.03) 100%
  );
  border: 1px solid rgba(167, 139, 250, 0.15);
  border-radius: 16px;
  padding: 16px;
  transition: all 0.3s ease;
}

.mobile-card:hover {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.12) 0%,
    rgba(167, 139, 250, 0.05) 100%
  );
  border-color: rgba(167, 139, 250, 0.3);
}

.mobile-symbol {
  color: #f1f5f9;
  font-weight: 600;
}

.chip-group {
  gap: 8px;
}

.text-grey {
  color: #94a3b8;
}

/* Dialog Styles */
.dark-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #f1f5f9;
}

/* Responsive */
@media (max-width: 960px) {
  .positions-container {
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

  .header-actions {
    width: 100%;
  }

  .action-btn {
    flex: 1;
  }

  .stat-value {
    font-size: 14px;
  }
}

@media (max-width: 600px) {
  .page-title {
    font-size: 20px;
  }

  .stat-card {
    padding: 8px 10px !important;
  }

  .stat-value {
    font-size: 12px;
  }
}
</style>
