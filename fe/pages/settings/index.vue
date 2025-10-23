<template>
  <v-container fluid class="pa-6">
    <v-card class="pa-6 rounded-xl" color="#1e1e1e">
      <v-card-title class="text-h5 font-weight-bold text-white">
        Cài đặt hệ thống
      </v-card-title>

      <v-divider class="my-4" />

      <v-row dense v-if="!loading">
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

      <!-- Loading -->
      <v-row v-if="loading" justify="center" class="py-8">
        <v-col cols="12" class="text-center">
          <v-progress-circular indeterminate color="primary" />
        </v-col>
      </v-row>

      <!-- Empty -->
      <v-row
        v-if="!loading && settings.length === 0"
        justify="center"
        class="py-8"
      >
        <v-col cols="12" class="text-center text-grey">
          Không có dữ liệu cài đặt
        </v-col>
      </v-row>

      <!-- Nút save -->
      <div class="text-right mt-4" v-if="settings.length > 0">
        <v-btn
          color="primary"
          @click="saveAllSettings"
          :loading="saving"
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
import { useApi } from "~/apis"; // Giống như trong màn logs

interface SettingItem {
  key: string;
  value: string;
}

const api = useApi();
const settings = ref<SettingItem[]>([]);
const loading = ref(true);
const saving = ref(false);

async function fetchSettings() {
  loading.value = true;
  try {
    const res = await api.get<Record<string, string>>("binance/settings"); // gọi /settings
    // Chuyển object thành array để dễ render
    settings.value = Object.entries(res || {}).map(([key, value]) => ({
      key,
      value,
    }));
  } catch (err) {
    console.error("Fetch settings failed:", err);
    settings.value = [];
  } finally {
    loading.value = false;
  }
}

async function saveAllSettings() {
  saving.value = true;
  try {
    const payload = settings.value.reduce(
      (acc, s) => ({ ...acc, [s.key]: s.value }),
      {}
    );
    await api.post("settings", payload); // gọi POST /settings để cập nhật
  } catch (err) {
    console.error("Save settings failed:", err);
  } finally {
    saving.value = false;
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
