<script setup lang="ts">
import { ref, computed } from 'vue'

// Import các file SVG từ thư mục assets/icons
import btcSvg from '@/assets/svg/btc.svg?raw'
import usdtSvg from '@/assets/svg/usdt.svg?raw'
import dokaSvg from '@/assets/svg/doka.svg?raw'

// Ánh xạ symbol với nội dung SVG
const iconMap: { [key: string]: string } = {
  BTC: btcSvg,
  USDT: usdtSvg,
  DOKA: dokaSvg
}

const assetStore = useAssetStore()
const { asset } = storeToRefs(assetStore)
await assetStore.getAsset()

const assets = ref([
  {
    name: 'Tether',
    symbol: 'USDT',
    balance: parseFloat(Number(asset.value?.totalUsdt).toFixed(10)),
    price: parseFloat(Number(asset.value?.totalUsdt).toFixed(10)) // Correct: 1 USDT = $1
  },
  {
    name: 'Dokasan',
    symbol: 'DOKA',
    balance: parseFloat(Number(asset.value?.totalDoka).toFixed(10)),
    price: parseFloat(Number(Number(asset.value?.totalDoka) * 0.2).toFixed(10)) // Corrected: 1 DOKA = $0.2
  }
])

const goToDeposit = () => {
  navigateTo('/transactions')
}
</script>

<template>
  <v-container fluid class="page-assets">
    <v-row justify="center" align="center" class="my-6">
      <v-col cols="12" sm="3">
        <v-btn
          block
          class="text-white custom-btn"
          style="background: linear-gradient(45deg, #4caf50, #81c784)"
          rounded="lg"
          @click="goToDeposit"
        >
          Deposit
          <v-icon right size="x-large">mdi-cash-plus</v-icon>
        </v-btn>
      </v-col>
    </v-row>
    <v-card class="elevation-0 pa-4" rounded="lg">
      <v-data-table
        :headers="[
          { title: 'Asset', key: 'name' },
          { title: 'Balance', key: 'balance' },
          { title: 'Price', key: 'price' }
        ]"
        :items="assets"
        class="elevation-0"
        hide-default-footer
      >
        <template #[`item.name`]="{ item }">
          <v-list-item>
            <v-list-item-avatar size="32">
              <!-- Sử dụng v-html để render SVG từ file -->
              <div
                style="width: 24px; height: 24px"
                v-html="iconMap[item.raw.symbol]"
              />
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ item.raw.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ item.raw.symbol }}</v-list-item-subtitle>
            </v-list-item-content>
          </v-list-item>
        </template>

        <template #[`item.balance`]="{ item }">
          <span>{{ item.raw.balance }} {{ item.raw.symbol }}</span>
        </template>

        <template #[`item.price`]="{ item }">
          <span>
            ${{
              item.raw.price.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })
            }}
          </span>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<style scoped lang="scss">
.page-assets {
  background: #f0f4f8;
  min-height: 100vh;
  padding: 16px;
}

.v-data-table {
  border-radius: 8px !important;
}

.v-list-item {
  min-height: 48px !important;
}

.v-btn {
  text-transform: none !important;
}

.v-data-table :deep(.v-data-table__td) {
  padding: 8px 16px !important;
}

.custom-btn {
  font-size: 1.2rem !important;
  padding: 20px 12px !important; /* Increased vertical padding for more height */
  min-height: 28px !important; /* Set a minimum height for the buttons */
  transition: all 0.2s ease;
}

.custom-btn:hover {
  transform: translateY(-1px);
}

.text-white {
  color: white !important;
}
</style>
