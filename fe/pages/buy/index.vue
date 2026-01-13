<template>
  <v-container fluid class="buy-container">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8" xl="6">
        <!-- Page Header -->
        <div class="page-header mb-6">
          <div class="d-flex align-center gap-3">
            <div class="header-icon-wrapper">
              <v-icon size="28" color="white">mdi-cash-plus</v-icon>
            </div>
            <div>
              <h1 class="page-title">Mua Crypto</h1>
              <p class="page-subtitle">
                Mua cryptocurrency nhanh chóng và dễ dàng
              </p>
            </div>
          </div>
        </div>

        <v-row>
          <!-- Main Form -->
          <v-col cols="12" md="7">
            <v-card class="buy-card">
              <div class="card-header">
                <h3 class="card-title">Thông tin giao dịch</h3>
              </div>

              <v-card-text class="pa-6">
                <!-- Chọn Coin -->
                <div class="form-group mb-5">
                  <label class="form-label">Chọn cryptocurrency</label>
                  <v-select
                    v-model="selectedCoin"
                    :items="coinOptions"
                    item-title="label"
                    item-value="value"
                    variant="outlined"
                    density="comfortable"
                    class="coin-select"
                    placeholder="Chọn coin muốn mua"
                  >
                    <template #prepend-inner>
                      <v-icon color="#a78bfa" size="20"
                        >mdi-bitcoin</v-icon
                      >
                    </template>
                  </v-select>
                </div>

                <!-- Market Price Toggle -->
                <v-card
                  class="market-price-card mb-5"
                  @click="marketPrice = !marketPrice"
                >
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center gap-3">
                      <v-icon
                        :color="marketPrice ? '#10b981' : '#64748b'"
                        size="24"
                      >
                        mdi-chart-line-variant
                      </v-icon>
                      <div>
                        <div class="market-label">Mua giá thị trường</div>
                        <div class="market-desc">
                          Giao dịch ngay lập tức với giá tốt nhất
                        </div>
                      </div>
                    </div>
                    <v-switch
                      v-model="marketPrice"
                      color="success"
                      hide-details
                      inset
                    ></v-switch>
                  </div>
                </v-card>

                <!-- Giá (nếu không phải market price) -->
                <div v-if="!marketPrice" class="form-group mb-5">
                  <label class="form-label">Giá mua (USDT)</label>
                  <v-text-field
                    v-model.number="price"
                    type="number"
                    variant="outlined"
                    density="comfortable"
                    placeholder="Nhập giá mong muốn"
                    class="price-input"
                  >
                    <template #prepend-inner>
                      <v-icon color="#f59e0b" size="20"
                        >mdi-currency-usd</v-icon
                      >
                    </template>
                  </v-text-field>
                </div>

                <!-- Số lượng -->
                <div class="form-group mb-6">
                  <label class="form-label">Số lượng</label>
                  <v-text-field
                    v-model.number="quantity"
                    type="number"
                    variant="outlined"
                    density="comfortable"
                    placeholder="Nhập số lượng"
                    class="quantity-input"
                  >
                    <template #prepend-inner>
                      <v-icon color="#3b82f6" size="20"
                        >mdi-numeric</v-icon
                      >
                    </template>
                  </v-text-field>
                </div>

                <!-- Button Buy -->
                <v-btn
                  color="primary"
                  :loading="loading"
                  :disabled="!canBuy"
                  @click="buyCoin"
                  block
                  size="large"
                  class="buy-btn"
                >
                  <v-icon start>mdi-cart-plus</v-icon>
                  Mua ngay
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Summary Card -->
          <v-col cols="12" md="5">
            <v-card class="summary-card sticky-card">
              <div class="card-header">
                <h3 class="card-title">Tổng quan giao dịch</h3>
              </div>

              <v-card-text class="pa-6">
                <div class="summary-item">
                  <span class="summary-label">Coin</span>
                  <span class="summary-value">
                    {{ selectedCoin || "-" }}
                  </span>
                </div>

                <v-divider class="my-4"></v-divider>

                <div class="summary-item">
                  <span class="summary-label">Loại giao dịch</span>
                  <v-chip
                    :color="marketPrice ? 'success' : 'info'"
                    size="small"
                    class="summary-chip"
                  >
                    {{ marketPrice ? "Thị trường" : "Giới hạn" }}
                  </v-chip>
                </div>

                <v-divider class="my-4"></v-divider>

                <div class="summary-item" v-if="!marketPrice">
                  <span class="summary-label">Giá mua</span>
                  <span class="summary-value">
                    {{ price ? `${price.toLocaleString()} USDT` : "-" }}
                  </span>
                </div>

                <v-divider class="my-4" v-if="!marketPrice"></v-divider>

                <div class="summary-item">
                  <span class="summary-label">Số lượng</span>
                  <span class="summary-value">
                    {{ quantity || "-" }}
                  </span>
                </div>

                <v-divider class="my-4"></v-divider>

                <div class="summary-item total-item">
                  <span class="summary-label">Tổng giá trị</span>
                  <span class="summary-total">
                    {{
                      totalValue
                        ? `~${totalValue.toLocaleString()} USDT`
                        : "-"
                    }}
                  </span>
                </div>

                <!-- Info Alert -->
                <v-alert
                  type="info"
                  variant="tonal"
                  class="mt-4 info-alert"
                  density="compact"
                >
                  <template #prepend>
                    <v-icon size="20">mdi-information</v-icon>
                  </template>
                  Giao dịch sẽ được thực hiện ngay lập tức sau khi xác nhận
                </v-alert>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
      location="top"
    >
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn variant="text" @click="snackbar.show = false"> Đóng </v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useApi } from "~/apis";

const api = useApi();

const coinOptions = [
  { label: "SOL - Solana", value: "SOL" },
  { label: "BTC - Bitcoin", value: "BTC" },
  { label: "BNB - Binance Coin", value: "BNB" },
];

const selectedCoin = ref<string | null>(null);
const price = ref<number | null>(null);
const quantity = ref<number | null>(null);
const marketPrice = ref(true);
const loading = ref(false);

const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

const canBuy = computed(() => {
  return (
    selectedCoin.value &&
    quantity.value &&
    quantity.value > 0 &&
    (marketPrice.value || (price.value && price.value > 0))
  );
});

const totalValue = computed(() => {
  if (!quantity.value) return null;
  if (marketPrice.value) return null;
  if (!price.value) return null;
  return quantity.value * price.value;
});

async function buyCoin() {
  if (!canBuy.value) return;

  loading.value = true;

  try {
    await api.post("binance/buy", {
      symbol: selectedCoin.value,
      quantity: quantity.value,
      price: marketPrice.value ? null : price.value,
      market: marketPrice.value,
    });

    snackbar.value = {
      show: true,
      message: "✅ Mua thành công!",
      color: "success",
    };

    // Reset form
    quantity.value = null;
    price.value = null;
  } catch (err: any) {
    console.error("Buy error:", err);
    snackbar.value = {
      show: true,
      message: `❌ ${err.message || "Mua thất bại!"}`,
      color: "error",
    };
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.buy-container {
  max-width: 1400px;
  padding: 24px;
}

/* Page Header */
.page-header {
  margin-bottom: 24px;
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

/* Cards */
.buy-card,
.summary-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.card-header {
  padding: 24px 24px 0 24px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  padding-bottom: 16px;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

/* Form */
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
  margin-bottom: 8px;
}

/* Market Price Card */
.market-price-card {
  background: rgba(167, 139, 250, 0.05);
  border: 1px solid rgba(167, 139, 250, 0.15);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.market-price-card:hover {
  background: rgba(167, 139, 250, 0.08);
  border-color: rgba(167, 139, 250, 0.3);
  transform: translateY(-2px);
}

.market-label {
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
}

.market-desc {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}

/* Buy Button */
.buy-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%) !important;
  color: white;
  font-weight: 600;
  font-size: 16px;
  border-radius: 12px;
  text-transform: none;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
  transition: all 0.3s ease;
}

.buy-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
}

.buy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Summary */
.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  font-size: 14px;
  color: #94a3b8;
  font-weight: 500;
}

.summary-value {
  font-size: 15px;
  color: #f1f5f9;
  font-weight: 600;
}

.summary-chip {
  font-weight: 600;
  font-size: 12px;
}

.total-item {
  padding: 16px;
  background: rgba(124, 58, 237, 0.08);
  border-radius: 12px;
  border: 1px solid rgba(167, 139, 250, 0.2);
}

.summary-total {
  font-size: 20px;
  color: #a78bfa;
  font-weight: 700;
}

.info-alert {
  background: rgba(59, 130, 246, 0.1) !important;
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  font-size: 12px;
}

.sticky-card {
  position: sticky;
  top: 80px;
}

/* Responsive */
@media (max-width: 960px) {
  .buy-container {
    padding: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .sticky-card {
    position: relative;
    top: 0;
  }
}

@media (max-width: 600px) {
  .page-header {
    margin-bottom: 20px;
  }

  .header-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .page-title {
    font-size: 20px;
  }

  .card-header {
    padding: 20px 20px 12px 20px;
  }
}
</style>
