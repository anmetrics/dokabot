<template>
  <v-container fluid class="py-10 px-md-16">
    <v-row>
      <!-- Sidebar Tabs -->
      <v-col cols="12" md="3">
        <v-card class="pa-4 rounded-xl sidebar-card">
          <v-tabs
            v-model="activeTab"
            direction="vertical"
            color="primary"
            class="tabs-custom"
          >
            <v-tab value="general">
              <v-icon start>mdi-tune-variant</v-icon> General
            </v-tab>
            <v-tab value="advanced">
              <v-icon start>mdi-cog-outline</v-icon> Advanced
            </v-tab>
            <v-tab value="security">
              <v-icon start>mdi-shield-half-full</v-icon> Security
            </v-tab>
          </v-tabs>
        </v-card>
      </v-col>

      <!-- Main content -->
      <v-col cols="12" md="9">
        <v-card class="pa-8 rounded-xl main-card">
          <v-tabs-window v-model="activeTab">
            <!-- General Settings -->
            <v-tabs-window-item value="general">
              <v-card-title class="section-title">
                <v-icon color="primary" class="mr-2">mdi-tune-variant</v-icon>
                General Settings
              </v-card-title>

              <v-divider class="divider my-6" />

              <!-- Trading Switches -->
              <div class="group-box mb-8">
                <div class="group-header">
                  <v-icon color="cyan lighten-3" size="22" class="mr-2">
                    mdi-lightning-bolt
                  </v-icon>
                  <span>Trading Switches</span>
                </div>
                <v-row dense>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="localSettings.enableBuy"
                      color="primary"
                      inset
                      :label="`Mua: ${localSettings.enableBuy ? 'Bật' : 'Tắt'}`"
                      hide-details
                      class="switch-custom"
                      @update:modelValue="updateSetting('ENABLE_BUY', $event!)"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <v-switch
                      v-model="localSettings.enableSell"
                      color="primary"
                      inset
                      :label="`Bán: ${
                        localSettings.enableSell ? 'Bật' : 'Tắt'
                      }`"
                      hide-details
                      class="switch-custom"
                      @update:modelValue="updateSetting('ENABLE_SELL', $event!)"
                    />
                  </v-col>
                </v-row>
              </div>

              <!-- Price Settings -->
              <div class="group-box mb-8" v-if="sortedNormalSettings.length">
                <div class="group-header">
                  <v-icon color="amber lighten-3" size="22" class="mr-2">
                    mdi-currency-usd
                  </v-icon>
                  <span>Price Settings</span>
                </div>
                <v-row dense>
                  <v-col
                    cols="12"
                    md="4"
                    v-for="item in sortedNormalSettings"
                    :key="item.id"
                  >
                    <v-text-field
                      v-model="item.value"
                      :label="item.key"
                      color="primary"
                      variant="outlined"
                      density="compact"
                      type="number"
                      class="mb-4 text-field-custom"
                      @update:modelValue="updateSetting(item.key, $event)"
                    />
                  </v-col>
                </v-row>
              </div>

              <!-- Mini Price Settings -->
              <div class="group-box" v-if="sortedMiniSettings.length">
                <div class="group-header">
                  <v-icon color="purple lighten-3" size="22" class="mr-2">
                    mdi-scale-balance
                  </v-icon>
                  <span>Mini Price Settings</span>
                </div>
                <v-row dense>
                  <v-col
                    cols="12"
                    md="4"
                    v-for="item in sortedMiniSettings"
                    :key="item.id"
                  >
                    <v-text-field
                      v-model="item.value"
                      :label="item.key"
                      color="secondary"
                      variant="outlined"
                      density="compact"
                      type="number"
                      class="mb-4 text-field-custom"
                      @update:modelValue="updateSetting(item.key, $event)"
                    />
                  </v-col>
                </v-row>
              </div>

              <!-- Loading -->
              <v-row v-if="loading" justify="center" class="py-10">
                <v-progress-circular
                  indeterminate
                  color="primary"
                  size="40"
                  width="4"
                />
              </v-row>

              <!-- Empty -->
              <v-row
                v-if="!loading && settings.length === 0"
                justify="center"
                class="py-10"
              >
                <v-col cols="12" class="text-center text-grey text-h6">
                  Không có dữ liệu cài đặt
                </v-col>
              </v-row>

              <!-- Save Button -->
              <div class="text-right mt-6" v-if="settings.length > 0">
                <v-btn
                  color="primary"
                  @click="saveAllSettings"
                  :loading="saving"
                  :disabled="!hasChanges"
                  variant="elevated"
                  class="save-btn"
                >
                  <v-icon start>mdi-content-save</v-icon>
                  Lưu tất cả
                </v-btn>
              </div>
            </v-tabs-window-item>

            <!-- Advanced -->
            <v-tabs-window-item value="advanced">
              <v-card-title class="section-title">
                <v-icon color="primary" class="mr-2">mdi-cog-outline</v-icon>
                Advanced Settings
              </v-card-title>
              <v-divider class="divider my-6" />
              <p class="text-grey">
                Advanced settings will be implemented here.
              </p>
            </v-tabs-window-item>

            <!-- Security -->
            <v-tabs-window-item value="security">
              <v-card-title class="section-title">
                <v-icon color="primary" class="mr-2"
                  >mdi-shield-half-full</v-icon
                >
                Security Settings
              </v-card-title>
              <v-divider class="divider my-6" />
              <p class="text-grey">
                Security settings will be implemented here.
              </p>
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Snackbar -->
          <v-snackbar
            v-model="snackbar.show"
            :color="snackbar.color"
            timeout="3000"
            rounded="pill"
            location="top"
          >
            {{ snackbar.message }}
            <template #actions>
              <v-btn
                color="white"
                variant="text"
                @click="snackbar.show = false"
              >
                Đóng
              </v-btn>
            </template>
          </v-snackbar>
        </v-card>
      </v-col>
    </v-row>
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
const initialSettings = ref<SettingItem[]>([]);
const localSettings = ref({
  enableBuy: false,
  enableSell: false,
});
const loading = ref(true);
const saving = ref(false);
const activeTab = ref("general");

// Snackbar
const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

const assetOrder = ["BTC", "BNB", "SOL", "USDT"];

const normalPriceSettings = computed(() =>
  settings.value.filter(
    (s) =>
      !["ENABLE_BUY", "ENABLE_SELL"].includes(s.key) && !s.key.includes("_MINI")
  )
);

const miniPriceSettings = computed(() =>
  settings.value.filter((s) => s.key.includes("_MINI"))
);

function sortByAssetOrder(items: SettingItem[]) {
  return [...items].sort((a, b) => {
    const aIndex = assetOrder.findIndex((x) => a.key.includes(x));
    const bIndex = assetOrder.findIndex((x) => b.key.includes(x));
    return aIndex - bIndex;
  });
}

const sortedNormalSettings = computed(() =>
  sortByAssetOrder(normalPriceSettings.value)
);
const sortedMiniSettings = computed(() =>
  sortByAssetOrder(miniPriceSettings.value)
);

const hasChanges = computed(() => {
  if (settings.value.length !== initialSettings.value.length) return true;
  return settings.value.some((setting, index) => {
    const initial = initialSettings.value[index];
    return (
      setting.key !== initial.key ||
      setting.value !== initial.value ||
      setting.id !== initial.id
    );
  });
});

function updateSetting(key: string, value: string | boolean) {
  const setting = settings.value.find((s) => s.key === key);
  if (setting) setting.value = value;
}

async function fetchSettings() {
  loading.value = true;
  try {
    const res = await api.get<SettingItem[]>("binance/settings");
    settings.value = res.map((s) => ({
      ...s,
      value:
        s.key === "ENABLE_BUY" || s.key === "ENABLE_SELL"
          ? s.value === "true"
          : s.value,
    }));
    initialSettings.value = JSON.parse(JSON.stringify(settings.value));
    localSettings.value.enableBuy =
      settings.value.find((s) => s.key === "ENABLE_BUY")?.value === true;
    localSettings.value.enableSell =
      settings.value.find((s) => s.key === "ENABLE_SELL")?.value === true;
  } catch (err) {
    settings.value = [];
  } finally {
    loading.value = false;
  }
}

async function saveAllSettings() {
  if (!hasChanges.value) return;
  saving.value = true;
  try {
    const payload = settings.value.reduce(
      (acc, s) => ({
        ...acc,
        [s.key]:
          s.key === "ENABLE_BUY" || s.key === "ENABLE_SELL"
            ? String(s.value)
            : s.value,
      }),
      {}
    );
    await api.patch("binance/settings", payload);
    initialSettings.value = JSON.parse(JSON.stringify(settings.value));
    snackbar.value = {
      show: true,
      message: "Lưu cài đặt thành công!",
      color: "success",
    };
  } catch (err) {
    snackbar.value = {
      show: true,
      message: "Lưu cài đặt thất bại!",
      color: "error",
    };
  } finally {
    saving.value = false;
  }
}

onMounted(fetchSettings);
</script>

<style scoped>
.sidebar-card {
  background: linear-gradient(135deg, #0e1628, #182236);
  color: #fff;
  border-radius: 16px;
  height: 100%;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.main-card {
  background: linear-gradient(145deg, #111a2b 0%, #1b263a 100%);
  color: #fff;
}

.section-title {
  display: flex;
  align-items: center;
  font-weight: 700;
  color: #fff;
  font-size: 1.2rem;
}

.divider {
  border-color: rgba(255, 255, 255, 0.08);
}

.group-box {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.group-header {
  display: flex;
  align-items: center;
  color: #9ec6ff;
  font-weight: 600;
  margin-bottom: 16px;
  letter-spacing: 0.3px;
}

.tabs-custom :deep(.v-tab) {
  color: #cfd8dc;
  font-weight: 500;
  border-radius: 10px;
  justify-content: flex-start;
  padding: 12px 14px;
  transition: all 0.25s ease;
}

.tabs-custom :deep(.v-tab--active) {
  background: linear-gradient(90deg, #42a5f5, #1e88e5);
  color: #fff !important;
}

.tabs-custom :deep(.v-tab:hover) {
  background: rgba(255, 255, 255, 0.06);
}

.text-field-custom :deep(.v-field) {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  transition: 0.25s ease;
}

.text-field-custom :deep(.v-field--focused) {
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.5);
}

.text-field-custom :deep(.v-field__input) {
  color: #fff !important;
  font-weight: 500;
}

.text-field-custom :deep(.v-label) {
  color: rgba(200, 200, 200, 0.7) !important;
}

.switch-custom :deep(.v-label) {
  color: #fff !important;
  font-weight: 500;
}

.save-btn {
  background: linear-gradient(90deg, #42a5f5, #1e88e5) !important;
  color: white !important;
  border-radius: 10px;
  font-weight: 600;
  text-transform: none;
}
</style>
