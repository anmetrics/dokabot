<script setup>
import { ref } from "vue";

// Giả lập trạng thái chọn gói
const selectedPlan = ref("pro");
const isYearly = ref(true);

const plans = [
  {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    priceYearly: 0,
    description: "Dành cho người mới bắt đầu",
    features: [
      "1 bot chạy cùng lúc",
      "Grid trading cơ bản",
      "Hỗ trợ 3 sàn (Binance, Bybit, OKX)",
      "Cộng đồng Telegram",
      "Báo cáo hàng tuần",
    ],
    recommended: false,
    color: "grey-darken-1",
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 29,
    priceYearly: 290,
    description: "Phù hợp với trader chuyên nghiệp",
    features: [
      "5 bot chạy đồng thời",
      "DCA, Grid, Futures Bot",
      "Backtesting không giới hạn",
      "API Priority hỗ trợ 24/7",
      "Copy trade từ top trader",
      "Không quảng cáo",
      "Báo cáo chi tiết realtime",
    ],
    recommended: true,
    color: "primary",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 99,
    priceYearly: 990,
    description: "Dành cho team & quỹ lớn",
    features: [
      "Bot không giới hạn",
      "Tất cả tính năng Pro",
      "White-label bot (thương hiệu riêng)",
      "Dedicated server VPS",
      "Quản lý nhiều tài khoản",
      "Hỗ trợ VIP 1-1",
      "Tích hợp AI dự đoán",
    ],
    recommended: false,
    color: "purple-darken-1",
  },
];

const getPrice = (plan) => {
  return isYearly ? plan.priceYearly : plan.priceMonthly;
};

const getSaving = (plan) => {
  if (!isYearly || plan.priceYearly === 0) return null;
  const saved = plan.priceMonthly * 12 - plan.priceYearly;
  const percent = Math.round((saved / (plan.priceMonthly * 12)) * 100);
  return `Tiết kiệm ${percent}%`;
};
</script>

<template>
  <v-container fluid class="py-16">
    <div class="text-center mb-12">
      <h1 class="text-h3 font-weight-bold mb-4">Chọn gói phù hợp với bạn</h1>
      <p class="text-h6 text-medium-emphasis">
        Tăng tốc lợi nhuận với bot crypto tự động mạnh mẽ nhất 2025
      </p>

      <!-- Toggle Monthly / Yearly -->
      <div class="d-flex align-center justify-center mt-8 gap-4">
        <span class="text-subtitle-1">Thanh toán hàng tháng</span>
        <v-switch v-model="isYearly" color="primary" hide-details inset>
          <template v-slot:label>
            <div class="d-flex align-center gap-3">
              <span :class="{ 'text-grey': isYearly }">Hàng tháng</span>
              <v-chip
                v-if="isYearly"
                color="green-darken-2"
                size="small"
                class="px-3"
              >
                Tiết kiệm tới 20%
              </v-chip>
              <span :class="{ 'text-primary': isYearly }">Hàng năm</span>
            </div>
          </template>
        </v-switch>
      </div>
    </div>

    <!-- Pricing Cards -->
    <v-row justify="center" class="mt-8">
      <v-col v-for="plan in plans" :key="plan.id" cols="12" sm="8" md="4">
        <v-card
          :color="plan.recommended ? 'surface' : ''"
          :elevation="plan.recommended ? 24 : 8"
          class="rounded-xl position-relative overflow-hidden"
          :class="{ 'border-3 border-primary': plan.recommended }"
          height="100%"
        >
          <!-- Recommended Badge -->
          <div
            v-if="plan.recommended"
            class="text-center py-2 bg-primary text-white text-subtitle-1 font-weight-bold"
          >
            PHỔ BIẾN NHẤT
          </div>

          <v-card-text class="pt-8 pb-6 text-center">
            <h3 class="text-h5 font-weight-bold mb-2">{{ plan.name }}</h3>
            <p class="text-medium-emphasis mb-6">{{ plan.description }}</p>

            <!-- Price -->
            <div class="d-flex align-baseline justify-center mb-4">
              <span class="text-h2 font-weight-black">
                ${{ getPrice(plan).toLocaleString() }}
              </span>
              <span class="text-h6 text-grey ml-2">
                {{ plan.priceYearly === 0 ? "" : isYearly ? "/năm" : "/tháng" }}
              </span>
            </div>

            <!-- Saving badge -->
            <v-chip
              v-if="getSaving(plan)"
              color="green-darken-1"
              text-color="white"
              class="mb-6"
            >
              {{ getSaving(plan) }}
            </v-chip>

            <!-- Features -->
            <v-list class="bg-transparent" density="comfortable">
              <v-list-item
                v-for="(feature, i) in plan.features"
                :key="i"
                class="px-0"
              >
                <template v-slot:prepend>
                  <v-icon color="success" size="small">mdi-check-circle</v-icon>
                </template>
                <v-list-item-title class="text-left">
                  {{ feature }}
                </v-list-item-title>
              </v-list-item>
            </v-list>

            <!-- Action Button -->
            <v-btn
              :color="plan.recommended ? 'primary' : 'grey-darken-2'"
              size="x-large"
              block
              rounded="pill"
              class="mt-6 text-subtitle-1 font-weight-bold"
              :variant="selectedPlan === plan.id ? 'flat' : 'elevated'"
              @click="selectedPlan = plan.id"
            >
              {{
                plan.priceMonthly === 0 ? "Bắt đầu miễn phí" : "Chọn gói này"
              }}
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Trust badges -->
    <div class="text-center mt-16">
      <p class="text-subtitle-1 text-medium-emphasis mb-6">
        Hơn 15,000+ trader đang sử dụng bot của chúng tôi
      </p>
      <v-row justify="center" align="center">
        <v-col cols="auto">
          <v-avatar size="64">
            <v-img src="/icons/binance.svg" alt="Binance"></v-img>
          </v-avatar>
        </v-col>
        <v-col cols="auto">
          <v-avatar size="64">
            <v-img src="/icons/bybit.svg" alt="Bybit"></v-img>
          </v-avatar>
        </v-col>
        <v-col cols="auto">
          <v-avatar size="64">
            <v-img src="/icons/okx.svg" alt="OKX"></v-img>
          </v-avatar>
        </v-col>
        <v-col cols="auto">
          <v-avatar size="64">
            <v-img src="/icons/gateio.svg" alt="Gate.io"></v-img>
          </v-avatar>
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<style scoped>
.border-3 {
  border-width: 3px !important;
}
.gap-4 {
  gap: 1rem;
}
</style>
