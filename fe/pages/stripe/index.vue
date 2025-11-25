<template>
  <v-container class="d-flex justify-center align-center fill-height pa-4">
    <v-card class="pa-6 dark-card" elevation="4">
      <h2 class="text-h5 font-weight-medium text-white mb-6 text-center">
        Buy NFT
      </h2>

      <v-select
        v-model="selectedNFT"
        :items="nfts"
        label="Chọn NFT"
        dense
        outlined
        class="mb-4"
      ></v-select>

      <v-text-field
        v-model.number="quantity"
        label="Số lượng"
        type="number"
        dense
        outlined
        class="mb-4"
      ></v-text-field>

      <v-text-field
        v-model.number="price"
        label="Giá (USD)"
        type="number"
        dense
        outlined
        class="mb-4"
      ></v-text-field>

      <v-radio-group v-model="paymentType" row class="mb-4">
        <v-radio label="Mua 1 lần" value="one_time"></v-radio>
        <v-radio label="Hàng tháng" value="subscription"></v-radio>
      </v-radio-group>

      <v-btn
        color="primary"
        :loading="loading"
        :disabled="!selectedNFT || !quantity || !price || !paymentType"
        @click="buyNFT"
        block
        large
      >
        Pay
      </v-btn>

      <v-snackbar
        v-model="snackbar.show"
        :color="snackbar.color"
        timeout="3000"
      >
        {{ snackbar.message }}
        <template v-slot:actions>
          <v-btn color="white" variant="text" @click="snackbar.show = false"
            >Đóng</v-btn
          >
        </template>
      </v-snackbar>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useApi } from "~/apis";

const api = useApi();

const nfts = ["NFT #1", "NFT #2", "NFT #3"];
const selectedNFT = ref<string | null>(null);
const quantity = ref<number | null>(null);
const price = ref<number | null>(null);
const paymentType = ref<"one_time" | "subscription" | null>(null);

const loading = ref(false);
const snackbar = ref({ show: false, message: "", color: "success" });

// Lấy priceId từ backend nếu mua hàng tháng
async function getSubscriptionPriceId() {
  try {
    const data = await api.post("stripe/subcription-price", {
      name: `${selectedNFT.value} Monthly`,
      amount: price.value,
      interval: "month",
    });
    return data.priceId;
  } catch (err) {
    console.error("Error getting subscription priceId:", err);
    return null;
  }
}

async function buyNFT() {
  if (
    !selectedNFT.value ||
    !quantity.value ||
    !price.value ||
    !paymentType.value
  )
    return;

  loading.value = true;

  try {
    let endpoint = "";
    let payload: any = {
      nftId: selectedNFT.value,
      quantity: quantity.value,
      price: price.value,
    };

    if (paymentType.value === "one_time") {
      endpoint = "stripe/checkout";
    } else if (paymentType.value === "subscription") {
      endpoint = "stripe/subcription";
      const priceId = await getSubscriptionPriceId();
      if (!priceId) throw new Error("Cannot get subscription priceId");
      payload = {
        customerEmail: "user@example.com", // có thể lấy email người dùng
        priceId,
      };
    }

    const data = await api.post(endpoint, payload);
    // Redirect sang Stripe Checkout
    window.location.href = data.url;
  } catch (err: any) {
    snackbar.value = {
      show: true,
      message: err.message || "Payment failed",
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
</style>
