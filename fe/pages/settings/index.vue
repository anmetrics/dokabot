<template>
  <v-container fluid class="pa-6">
    <v-card class="pa-6 rounded-xl" color="#1e1e1e">
      <v-card-title class="text-h5 font-weight-bold text-white">
        Cài đặt hệ thống
      </v-card-title>
      <v-divider class="my-4" />

      <v-row dense>
        <v-col
          cols="12"
          md="6"
          v-for="(item, index) in settings"
          :key="item.key"
        >
          <v-text-field
            v-model="item.value"
            :label="item.key"
            color="primary"
            variant="outlined"
            dense
            class="mb-4"
          />
        </v-col>
      </v-row>

      <!-- Nút save chung -->
      <div class="text-right mt-4">
        <v-btn
          color="primary"
          @click="saveAllSettings"
          :loading="loading"
          variant="elevated"
        >
          <v-icon start>mdi-content-save</v-icon>
          Lưu tất cả
        </v-btn>
      </div>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface SettingItem {
  key: string;
  value: string;
}

// ⚡ Mock API
const settings = ref<SettingItem[]>([]);
const loading = ref(false);

// Lấy settings từ API
async function fetchSettings() {
  // Giả lập fetch API
  const res: SettingItem[] = await new Promise((resolve) =>
    setTimeout(
      () =>
        resolve([
          { key: "API_KEY_BINANCE", value: "123456" },
          { key: "MAX_DCA_TIMES", value: "7" },
          { key: "BASE_BUY_USDT", value: "50" },
        ]),
      500
    )
  );
  settings.value = res;
}

// Save tất cả settings
async function saveAllSettings() {
  loading.value = true;
  try {
    // Gọi API update tất cả
    await new Promise((resolve) => setTimeout(resolve, 800));
    console.log("Saved all settings:", settings.value);
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

onMounted(fetchSettings);
</script>

<style scoped>
.v-card {
  background-color: #1e1e1e !important;
  color: #fff;
  border: 1px solid #2c2c2c;
}

.v-text-field input {
  color: #fff !important;
}

.v-text-field label {
  color: #aaa !important;
}
</style>
