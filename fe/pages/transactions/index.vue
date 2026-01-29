<template>
  <v-container fluid class="transactions-container">
    <v-row justify="center">
      <v-col cols="12" xl="10">
        <!-- Page Header -->
        <div class="page-header mb-6">
          <div class="d-flex align-center gap-3">
            <div class="header-icon-wrapper">
              <v-icon size="28" color="white">mdi-history</v-icon>
            </div>
            <div>
              <h1 class="page-title">Lịch sử giao dịch</h1>
              <p class="page-subtitle">
                Theo dõi toàn bộ lịch sử mua bán của bạn
              </p>
            </div>
          </div>
          <v-btn
            @click="refresh"
            :loading="loading"
            class="refresh-btn"
          >
            <v-icon start>mdi-refresh</v-icon>
            Làm mới
          </v-btn>
        </div>

        <!-- Summary Cards -->
        <v-row class="mb-6">
          <v-col cols="12" sm="6" md="3">
            <v-card class="summary-card">
              <div class="summary-icon-wrapper">
                <v-icon size="18" color="#3b82f6">mdi-swap-horizontal</v-icon>
              </div>
              <div class="summary-content">
                <div class="summary-label">Tổng giao dịch</div>
                <div class="summary-value">{{ meta.total }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="summary-card">
              <div class="summary-icon-wrapper">
                <v-icon size="18" color="#10b981">mdi-trending-up</v-icon>
              </div>
              <div class="summary-content">
                <div class="summary-label">Tổng lợi nhuận</div>
                <div class="summary-value profit">{{ formatPrice(totalProfit) }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="summary-card">
              <div class="summary-icon-wrapper">
                <v-icon size="18" color="#f59e0b">mdi-currency-usd</v-icon>
              </div>
              <div class="summary-content">
                <div class="summary-label">Tổng vốn</div>
                <div class="summary-value">{{ formatPrice(totalInvested) }}</div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-card class="summary-card">
              <div class="summary-icon-wrapper">
                <v-icon size="18" color="#a78bfa">mdi-chart-line</v-icon>
              </div>
              <div class="summary-content">
                <div class="summary-label">Tỷ suất ROI</div>
                <div class="summary-value" :class="roiPercent >= 0 ? 'profit' : 'loss'">
                  {{ roiPercent.toFixed(2) }}%
                </div>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Table Card -->
        <v-card class="table-card">
          <v-data-table
            :loading="loading"
            :headers="headers"
            :items="trades"
            :items-per-page="meta.limit"
            class="dark-table"
            hide-default-footer
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

            <template #item.buyPrices="{ item }">
              <span class="price-text">{{ formatNumber(item.buyPrices[0]) }}</span>
            </template>

            <template #item.sellPrice="{ item }">
              <span class="price-text">{{ formatNumber(item.sellPrice) }}</span>
            </template>

            <template #item.totalAmountBuyActual="{ item }">
              {{ formatNumber(item.totalAmountBuyActual) }}
            </template>

            <template #item.totalAmountBuyUsdtSpent="{ item }">
              {{ formatPrice(item.totalAmountBuyUsdtSpent) }}
            </template>

            <template #item.totalProfit="{ item }">
              <v-chip
                size="small"
                :class="{
                  'profit-chip': item.totalProfit > 0,
                  'loss-chip': item.totalProfit < 0,
                  'neutral-chip': item.totalProfit === 0,
                }"
                variant="flat"
              >
                {{ formatPrice(item.totalProfit) }}
              </v-chip>
            </template>

            <template #item.totalRevenueUsdt="{ item }">
              {{ formatPrice(item.totalRevenueUsdt) }}
            </template>

            <template #item.createdAt="{ item }">
              <div class="date-cell">
                <v-icon size="14" class="mr-1" color="#94a3b8">mdi-clock-outline</v-icon>
                {{ formatDate(item.createdAt) }}
              </div>
            </template>
          </v-data-table>

          <!-- Pagination -->
          <div v-if="meta.totalPages > 1" class="pagination-wrapper">
            <v-pagination
              v-model="page"
              :length="meta.totalPages"
              color="primary"
              total-visible="7"
              @update:model-value="fetchTrades"
              class="custom-pagination"
            />
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useApi } from "~/apis";

interface Trade {
  id: string;
  symbol: string;
  buyPrices: number[];
  sellPrice: number;
  totalAmountBuyActual: number;
  totalAmountBuyUsdtSpent: number;
  totalProfit: number;
  totalRevenueUsdt: number;
  createdAt: string;
}

const api = useApi();
const trades = ref<Trade[]>([]);
const loading = ref(false);
const page = ref(1);
const meta = ref({
  total: 0,
  page: 1,
  limit: 15,
  totalPages: 1,
});

const headers = [
  { title: "Symbol", key: "symbol", align: "start" as const },
  { title: "Giá mua", key: "buyPrices", align: "end" as const },
  { title: "Giá bán", key: "sellPrice", align: "end" as const },
  { title: "SL", key: "totalAmountBuyActual", align: "end" as const },
  { title: "Vốn USDT", key: "totalAmountBuyUsdtSpent", align: "end" as const },
  { title: "Lãi/Lỗ", key: "totalProfit", align: "center" as const },
  { title: "Doanh thu", key: "totalRevenueUsdt", align: "end" as const },
  { title: "Ngày tạo", key: "createdAt", align: "center" as const },
];

const totalProfit = computed(() =>
  trades.value.reduce((acc, t) => acc + t.totalProfit, 0)
);

const totalInvested = computed(() =>
  trades.value.reduce((acc, t) => acc + t.totalAmountBuyUsdtSpent, 0)
);

const roiPercent = computed(() =>
  totalInvested.value > 0 ? (totalProfit.value / totalInvested.value) * 100 : 0
);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleString("vi-VN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatNumber = (num?: number) =>
  num !== undefined
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(num)
    : "-";

const formatPrice = (num?: number) =>
  num !== undefined
    ? `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
        num
      )}`
    : "-";

async function fetchTrades() {
  try {
    loading.value = true;
    const res: any = await api.get(
      `binance/histories?page=${page.value}&limit=15`
    );
    trades.value = res.data || [];
    meta.value = res.meta || meta.value;
  } catch (err) {
    console.error("Lỗi khi fetch giao dịch:", err);
    trades.value = [];
  } finally {
    loading.value = false;
  }
}

function refresh() {
  fetchTrades();
}

onMounted(fetchTrades);
</script>

<style scoped>
.transactions-container {
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

/* Summary Cards */
.summary-card {
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

.summary-card:hover {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.15) 0%,
    rgba(167, 139, 250, 0.08) 100%
  );
  transform: translateY(-3px);
  border-color: rgba(167, 139, 250, 0.3);
  box-shadow: 0 8px 20px rgba(124, 58, 237, 0.2);
}

.summary-icon-wrapper {
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

.summary-content {
  position: relative;
  z-index: 1;
}

.summary-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
  margin-bottom: 3px;
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
}

.summary-value.profit {
  color: #10b981;
}

.summary-value.loss {
  color: #ef4444;
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
  color: #a78bfa;
  font-weight: 600;
  border: 1px solid rgba(167, 139, 250, 0.3);
}

.price-text {
  color: #f1f5f9;
  font-weight: 500;
}

.profit-chip {
  background: rgba(16, 185, 129, 0.15) !important;
  color: #10b981 !important;
  font-weight: 600;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.loss-chip {
  background: rgba(239, 68, 68, 0.15) !important;
  color: #ef4444 !important;
  font-weight: 600;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.neutral-chip {
  background: rgba(100, 116, 139, 0.15) !important;
  color: #94a3b8 !important;
  font-weight: 600;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.date-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
}

/* Pagination */
.pagination-wrapper {
  padding: 24px;
  display: flex;
  justify-content: center;
  border-top: 1px solid rgba(167, 139, 250, 0.1);
}

.custom-pagination :deep(.v-pagination__item) {
  background: rgba(167, 139, 250, 0.1);
  color: #f1f5f9;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.custom-pagination :deep(.v-pagination__item:hover) {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
}

.custom-pagination :deep(.v-pagination__item--is-active) {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%) !important;
  color: white !important;
  border-color: transparent;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

/* Scrollbar */
.dark-table :deep(.v-data-table__wrapper::-webkit-scrollbar) {
  height: 8px;
}

.dark-table :deep(.v-data-table__wrapper::-webkit-scrollbar-thumb) {
  background: rgba(167, 139, 250, 0.3);
  border-radius: 4px;
}

.dark-table :deep(.v-data-table__wrapper::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
}

/* Responsive */
@media (max-width: 960px) {
  .transactions-container {
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

  .summary-value {
    font-size: 14px;
  }
}

@media (max-width: 600px) {
  .page-title {
    font-size: 20px;
  }

  .summary-card {
    padding: 8px 10px !important;
  }

  .summary-value {
    font-size: 12px;
  }

  .dark-table :deep(.v-data-table-header th),
  .dark-table :deep(.v-data-table__td) {
    font-size: 12px;
    padding: 10px 8px;
  }
}
</style>
