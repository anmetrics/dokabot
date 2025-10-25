<template>
  <v-card class="pa-4 dark-card" elevation="3" max-width="400">
    <h2 class="text-h6 font-weight-medium text-white mb-4">Buy crypto</h2>

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
      class="mb-2"
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

    <!-- Thông báo lỗi -->
    <div v-if="errorMessage" class="text-error mb-2">{{ errorMessage }}</div>
    <div v-if="successMessage" class="text-success mb-2">
      {{ successMessage }}
    </div>

    <!-- Button Buy -->
    <v-btn
      color="primary"
      :loading="loading"
      :disabled="!selectedCoin || (!marketPrice && !price) || !quantity"
      @click="buyCoin"
      block
    >
      Buy
    </v-btn>
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
const errorMessage = ref("");
const successMessage = ref("");

async function buyCoin() {
  if (
    !selectedCoin.value ||
    !quantity.value ||
    (!marketPrice.value && !price.value)
  )
    return;

  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const res = await api.post("binance/buy", {
      symbol: selectedCoin.value,
      quantity: quantity.value,
      price: marketPrice.value ? null : price.value,
      market: marketPrice.value,
    });
    successMessage.value = "Mua thành công!";
    // Reset form
    quantity.value = null;
    price.value = null;
    marketPrice.value = false;
  } catch (err: any) {
    console.error("Buy error:", err);
    errorMessage.value = err.message || "Mua thất bại!";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.dark-card {
  background: linear-gradient(135deg, #0b1620 0%, #1b2535 100%);
  color: #fff;
  border-radius: 12px;
}

.text-error {
  color: #ff5252;
  font-size: 0.85rem;
}

.text-success {
  color: #00e676;
  font-size: 0.85rem;
}
</style>
