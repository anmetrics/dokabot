<template>
  <v-container fluid class="pa-6">
    <v-card class="pa-6 rounded-xl" color="#1e1e1e">
      <!-- Tiêu đề -->
      <v-card-title class="text-h5 font-weight-bold text-white">
        Cài đặt hệ thống
      </v-card-title>

      <v-divider class="my-4" />

      <!-- ENABLED switch riêng biệt -->
      <div v-if="!loading && enabledSetting" class="d-flex align-center mb-6">
        <v-icon color="primary" size="28" class="mr-2">mdi-power</v-icon>
        <v-switch
          v-model="enabledSetting.value"
          color="primary"
          inset
          :label="`Hệ thống: ${enabledSetting.value ? 'Bật' : 'Tắt'}`"
          hide-details
          class="text-white"
        />
      </div>

      <v-divider class="mb-4" />

      <!-- Các settings còn lại -->
      <v-row dense v-if="!loading">
        <v-col cols="12" md="6" v-for="item in filteredSettings" :key="item.id">
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
        v-if="!loading && filteredSettings.length === 0"
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
import { ref, computed, onMounted } from "vue";
import { useApi } from "~/apis";

interface SettingItem {
  id: string;
  key: string;
  value: string | boolean;
}

const api = useApi();
const settings = ref<SettingItem[]>([]);
const loading = ref(true);
const saving = ref(false);

// Lọc riêng ENABLED
const enabledSetting = computed(() =>
  settings.value.find((s) => s.key === "ENABLED")
);
const filteredSettings = computed(() =>
  settings.value.filter((s) => s.key !== "ENABLED")
);

async function fetchSettings() {
  loading.value = true;
  try {
    const res = await api.get<SettingItem[]>("binance/settings");

    settings.value = res.map((s) => ({
      ...s,
      value: s.key === "ENABLED" ? s.value === "true" : s.value, // convert boolean cho ENABLED
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
      (acc, s) => ({
        ...acc,
        [s.key]: s.key === "ENABLED" ? String(s.value) : s.value,
      }),
      {}
    );
    await api.post("settings", payload);
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

.v-switch .v-label {
  color: #fff !important;
}
</style>
