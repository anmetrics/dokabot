<template>
  <v-card class="pa-6 dark-card mx-auto" elevation="4">
    <h2 class="text-h5 font-weight-medium text-white mb-6 text-center">
      Mua Coin
    </h2>

    <!-- Chọn Coin -->
    <v-select
      v-model="selectedCoin"
      :items="coins"
      label="Chọn coin"
      dense
      outlined
      class="mb-4"
    ></v-select>

    <!-- Giá -->
    <v-text-field
      v-if="!marketPrice"
      v-model.number="price"
      label="Giá (USDT)"
      type="number"
      dense
      outlined
      class="mb-3"
    ></v-text-field>

    <v-checkbox
      v-model="marketPrice"
      label="Mua giá thị trường"
      dense
      class="mb-4"
    ></v-checkbox>

    <!-- Số lượng -->
    <v-text-field
      v-model.number="quantity"
      label="Số lượng"
      type="number"
      dense
      outlined
      class="mb-4"
    ></v-text-field>

    <!-- Button Buy -->
    <v-btn
      color="primary"
      :loading="loading"
      :disabled="!selectedCoin || (!marketPrice && !price) || !quantity"
      @click="buyCoin"
      block
      large
      class="mb-4"
    >
      Buy
    </v-btn>

    <!-- Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
      rounded="pill"
      top
    >
      {{ snackbar.message }}
      <template v-slot:actions>
        <v-btn color="white" variant="text" @click="snackbar.show = false">
          Đóng
        </v-btn>
      </template>
    </v-snackbar>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "~/apis";

const api = useApi();

const coins = ["SOL", "BTC", "BNB"];
const selectedCoin = ref<string | null>(null);
const price = ref<number | null>(null);
const quantity = ref<number | null>(null);
const marketPrice = ref(false);

const loading = ref(false);

// Snackbar state
const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

async function buyCoin() {
  if (
    !selectedCoin.value ||
    !quantity.value ||
    (!marketPrice.value && !price.value)
  )
    return;

  loading.value = true;

  try {
    await api.post("binance/buy", {
      symbol: selectedCoin.value,
      quantity: quantity.value,
      price: marketPrice.value ? null : price.value,
      market: marketPrice.value,
    });

    // Hiển thị snackbar success
    snackbar.value = {
      show: true,
      message: "Mua thành công!",
      color: "success",
    };

    // Reset form
    quantity.value = null;
    price.value = null;
    marketPrice.value = false;
  } catch (err: any) {
    console.error("Buy error:", err);

    // Hiển thị snackbar lỗi
    snackbar.value = {
      show: true,
      message: err.message || "Mua thất bại!",
      color: "error",
    };
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.dark-card {
  background: linear-gradient(135deg, #0b1620 0%, #1b2535 100%);
  color: #fff;
  border-radius: 16px;
  max-width: 500px;
  width: 90%;
  margin: 0 auto;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

:deep(.v-snackbar__wrapper) {
  font-weight: 500;
}
</style>
