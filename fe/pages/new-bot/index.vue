<template>
  <div class="new-bot-page">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="text-center mb-10">
        <h1 class="text-4xl md:text-5xl font-black text-white mb-4">
          <span
            class="bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-600 bg-clip-text text-transparent"
          >
            Tạo Trading Bot Mới
          </span>
        </h1>
        <p class="text-grey-lighten-1 text-lg">
          Chỉ mất 60 giây để bot của bạn kiếm tiền 24/7
        </p>
      </div>

      <!-- Stepper -->
      <v-stepper v-model="step" class="mb-8" elevation="0">
        <v-stepper-header>
          <v-stepper-item
            title="API Exchange"
            value="1"
            :complete="step > 1"
            color="#ff006e"
          >
            <v-icon>mdi-key-chain</v-icon>
          </v-stepper-item>
          <v-divider />
          <v-stepper-item
            title="Cấu hình Bot"
            value="2"
            :complete="step > 2"
            color="#ff006e"
          >
            <v-icon>mdi-robot-excited-outline</v-icon>
          </v-stepper-item>
        </v-stepper-header>
      </v-stepper>

      <!-- Bước 1: API Key + Secret Key -->
      <v-card v-if="step === 1" class="step-card" elevation="20">
        <v-card-title class="text-h5 font-bold text-center pb-8">
          <v-icon size="48" color="#ff006e" class="mb-4"
            >mdi-shield-key-outline</v-icon
          >
          <br />
          Kết nối sàn giao dịch
        </v-card-title>

        <v-card-text class="px-8">
          <v-select
            v-model="exchange"
            :items="exchanges"
            label="Chọn sàn giao dịch"
            prepend-inner-icon="mdi-bank"
            variant="outlined"
            class="mb-6"
            color="#ff006e"
          />

          <v-text-field
            v-model="form.apiKey"
            label="API Key"
            prepend-inner-icon="mdi-key-variant"
            variant="outlined"
            :type="showApi ? 'text' : 'password'"
            :append-inner-icon="showApi ? 'mdi-eye' : 'mdi-eye-off'"
            @click:append-inner="showApi = !showApi"
            class="mb-6"
            color="#ff006e"
            placeholder="Nhập API Key của bạn"
          />

          <v-text-field
            v-model="form.secretKey"
            label="Secret Key"
            prepend-inner-icon="mdi-shield-lock"
            variant="outlined"
            :type="showSecret ? 'text' : 'password'"
            :append-inner-icon="showSecret ? 'mdi-eye' : 'mdi-eye-off'"
            @click:append-inner="showSecret = !showSecret"
            color="#ff006e"
            placeholder="Nhập Secret Key của bạn"
          />

          <v-alert type="warning" variant="tonal" class="mt-6">
            <strong>Lưu ý bảo mật:</strong> Chúng tôi không lưu trữ API Key của
            bạn. Tất cả được mã hóa end-to-end và chỉ dùng để chạy bot.
          </v-alert>
        </v-card-text>

        <v-card-actions class="pa-8">
          <v-spacer />
          <v-btn
            size="x-large"
            color="#ff006e"
            variant="elevated"
            :disabled="!form.apiKey || !form.secretKey || !exchange"
            @click="step = 2"
            class="px-10 font-bold"
          >
            Tiếp theo
            <v-icon end>mdi-arrow-right-bold</v-icon>
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- Bước 2: Cấu hình Bot -->
      <v-card v-if="step === 2" class="step-card" elevation="20">
        <v-card-title class="text-h5 font-bold text-center pb-8">
          <v-icon size="48" color="#00e5ff" class="mb-4"
            >mdi-robot-happy-outline</v-icon
          >
          <br />
          Cấu hình chiến lược giao dịch
        </v-card-title>

        <v-card-text class="px-8">
          <v-text-field
            v-model="form.botName"
            label="Tên Bot (ví dụ: DCA Beast SOL)"
            prepend-inner-icon="mdi-label-heart-outline"
            variant="outlined"
            class="mb-6"
            color="#00e5ff"
          />

          <v-select
            v-model="form.strategy"
            :items="strategies"
            label="Chọn chiến lược"
            prepend-inner-icon="mdi-brain"
            variant="outlined"
            class="mb-6"
            color="#ff006e"
            item-title="name"
            item-value="value"
            return-object
          >
            <template v-slot:item="{ item, props }">
              <v-list-item v-bind="props">
                <v-list-item-title>
                  <strong>{{ item.raw.name }}</strong>
                </v-list-item-title>
                <v-list-item-subtitle>{{ item.raw.desc }}</v-list-item-subtitle>
              </v-list-item>
            </template>
          </v-select>

          <!-- Cấu hình riêng theo từng strategy -->
          <div v-if="form.strategy">
            <!-- DCA Strategy -->
            <div v-if="form.strategy.value === 'dca'">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.dca.baseOrder"
                    label="Lệnh cơ bản (USDT)"
                    type="number"
                    prefix="$"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.dca.safetyOrders"
                    label="Số lệnh an toàn"
                    type="number"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.dca.priceDeviation"
                    label="Độ lệch giá (%)"
                    type="number"
                    suffix="%"
                    variant="outlined"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.dca.pair"
                    :items="pairs"
                    label="Cặp giao dịch"
                    variant="outlined"
                  />
                </v-col>
              </v-row>
            </div>

            <!-- Grid Strategy -->
            <div v-if="form.strategy.value === 'grid'">
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.grid.lowerPrice"
                    label="Giá thấp nhất"
                    type="number"
                    prefix="$"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.grid.upperPrice"
                    label="Giá cao nhất"
                    type="number"
                    prefix="$"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.grid.gridCount"
                    label="Số lưới"
                    type="number"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.grid.amountPerGrid"
                    label="Số tiền mỗi lưới (USDT)"
                    type="number"
                    prefix="$"
                  />
                </v-col>
              </v-row>
            </div>

            <!-- Arbitrage -->
            <div v-if="form.strategy.value === 'arbitrage'">
              <v-alert type="info" variant="tonal">
                Bot sẽ tự động tìm cơ hội chênh lệch giá giữa các sàn và thực
                hiện giao dịch tức thì.
              </v-alert>
              <v-text-field
                v-model="form.arbitrage.minProfit"
                label="Lợi nhuận tối thiểu (%)"
                type="number"
                suffix="%"
                class="mt-4"
              />
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="pa-8">
          <v-btn variant="text" @click="step = 1">Quay lại</v-btn>
          <v-spacer />
          <v-btn
            size="x-large"
            color="#00e5ff"
            variant="elevated"
            class="px-12 font-bold text-black"
            :loading="creating"
            @click="createBot"
          >
            <v-icon start>mdi-rocket-launch</v-icon>
            Khởi chạy Bot ngay!
          </v-btn>
        </v-card-actions>
      </v-card>

      <!-- Success Animation -->
      <div v-if="botCreated" class="text-center mt-12">
        <v-icon
          size="120"
          color="#00e5ff"
          class="mb-6 animate__animated animate__bounceIn"
        >
          mdi-check-circle-outline
        </v-icon>
        <h2 class="text-3xl font-bold text-white mb-4">
          Bot đã được tạo thành công!
        </h2>
        <v-btn size="large" color="#ff006e" @click="goToMyBot">
          Xem tất cả Bot của tôi
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const step = ref(1);
const showApi = ref(false);
const showSecret = ref(false);
const creating = ref(false);
const botCreated = ref(false);

const exchange = ref("binance");
const exchanges = ["binance", "bybit", "okx", "gate.io", "kucoin", "mexc"];

const pairs = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "DOGE/USDT",
];

const form = ref({
  apiKey: "",
  secretKey: "",
  botName: "",
  strategy: null as any,
  dca: {
    baseOrder: 100,
    safetyOrders: 10,
    priceDeviation: 2,
    pair: "BTC/USDT",
  },
  grid: {
    lowerPrice: 50000,
    upperPrice: 70000,
    gridCount: 20,
    amountPerGrid: 50,
  },
  arbitrage: { minProfit: 0.5 },
});

const strategies = [
  {
    name: "DCA (Dollar Cost Averaging)",
    value: "dca",
    desc: "Mua dần khi giá giảm – chiến lược an toàn nhất",
  },
  {
    name: "Grid Trading",
    value: "grid",
    desc: "Kiếm lời từ biến động giá trong kênh",
  },
  {
    name: "Triangular Arbitrage",
    value: "arbitrage",
    desc: "Kiếm lợi từ chênh lệch giá giữa các cặp",
  },
  {
    name: "Martingale Pro",
    value: "martingale",
    desc: "Tăng vốn khi thua – rủi ro cao, lợi nhuận khủng",
  },
  {
    name: "Sniper Bot",
    value: "sniper",
    desc: "Bắt đáy/chốt đỉnh tự động theo volume",
  },
];

const createBot = async () => {
  creating.value = true;
  // Giả lập tạo bot
  await new Promise((resolve) => setTimeout(resolve, 3000));
  creating.value = false;
  botCreated.value = true;
};

const goToMyBot = () => {
  navigateTo("/my-bot");
};
</script>

<style scoped>
.new-bot-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0e1a 0%, #1e1b4b 50%, #2d0b3d 100%);
  padding: 40px 20px;
}

.step-card {
  background: linear-gradient(
    145deg,
    rgba(30, 35, 60, 0.8),
    rgba(20, 25, 50, 0.9)
  );
  border-radius: 24px !important;
  border: 1px solid rgba(255, 0, 110, 0.3);
  backdrop-filter: blur(16px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.v-stepper-header {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  padding: 12px;
}

.animate__bounceIn {
  animation: bounceIn 1.5s;
}
</style>
