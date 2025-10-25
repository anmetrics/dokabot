<template>
  <v-container fluid class="py-10">
    <v-row>
      <!-- Left-side Tabs -->
      <v-col cols="12" md="3">
        <v-card class="pa-4 rounded-xl dark-card" style="height: 100%">
          <v-tabs
            v-model="activeTab"
            direction="vertical"
            color="primary"
            class="tabs-custom"
          >
            <v-tab value="general">General</v-tab>
            <v-tab value="advanced">Advanced</v-tab>
            <v-tab value="security">Security</v-tab>
          </v-tabs>
        </v-card>
      </v-col>

      <!-- Tab Content -->
      <v-col cols="12" md="9">
        <v-card class="pa-8 rounded-xl dark-card">
          <v-tabs-window v-model="activeTab">
            <!-- General Tab Content -->
            <v-tabs-window-item value="general">
              <!-- Tiêu đề -->
              <v-card-title class="text-sm-h6 font-weight-bold text-white">
                General Settings
              </v-card-title>

              <v-divider class="my-6 divider" />

              <!-- Switch: ENABLE_BUY + ENABLE_SELL -->
              <v-row dense v-if="!loading">
                <v-col cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-icon color="primary" size="28" class="mr-3">
                      mdi-cart-arrow-down
                    </v-icon>
                    <v-switch
                      v-model="localSettings.enableBuy"
                      color="primary"
                      inset
                      :label="`Mua: ${localSettings.enableBuy ? 'Bật' : 'Tắt'}`"
                      hide-details
                      class="text-white switch-custom"
                      @update:modelValue="updateSetting('ENABLE_BUY', $event!)"
                    />
                  </div>
                </v-col>

                <v-col cols="12" md="6">
                  <div class="d-flex align-center mb-4">
                    <v-icon color="primary" size="28" class="mr-3">
                      mdi-cash-multiple
                    </v-icon>
                    <v-switch
                      v-model="localSettings.enableSell"
                      color="primary"
                      inset
                      :label="`Bán: ${
                        localSettings.enableSell ? 'Bật' : 'Tắt'
                      }`"
                      hide-details
                      class="text-white switch-custom"
                      @update:modelValue="updateSetting('ENABLE_SELL', $event!)"
                    />
                  </div>
                </v-col>
              </v-row>

              <v-divider class="my-6 divider" />

              <!-- Các setting giá -->
              <v-row dense v-if="!loading">
                <v-col
                  cols="12"
                  md="4"
                  v-for="item in priceSettings"
                  :key="item.id"
                >
                  <v-text-field
                    v-model="item.value"
                    :label="item.key"
                    color="primary"
                    variant="outlined"
                    dense
                    type="number"
                    class="mb-4 text-field-custom"
                    @update:modelValue="updateSetting(item.key, $event)"
                  />
                </v-col>
              </v-row>

              <!-- Loading -->
              <v-row v-if="loading" justify="center" class="py-10">
                <v-col cols="12" class="text-center">
                  <v-progress-circular
                    indeterminate
                    color="primary"
                    size="40"
                    width="4"
                  />
                </v-col>
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

              <!-- Nút save -->
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

            <!-- Advanced Tab Content -->
            <v-tabs-window-item value="advanced">
              <v-card-title class="text-sm-h6 font-weight-bold text-white">
                Advanced Settings
              </v-card-title>
              <v-divider class="my-6 divider" />
              <v-row dense>
                <v-col cols="12">
                  <p class="text-grey">
                    Advanced settings will be implemented here.
                  </p>
                </v-col>
              </v-row>
            </v-tabs-window-item>

            <!-- Security Tab Content -->
            <v-tabs-window-item value="security">
              <v-card-title class="text-sm-h6 font-weight-bold text-white">
                Security Settings
              </v-card-title>
              <v-divider class="my-6 divider" />
              <v-row dense>
                <v-col cols="12">
                  <p class="text-grey">
                    Security settings will be implemented here.
                  </p>
                </v-col>
              </v-row>
            </v-tabs-window-item>
          </v-tabs-window>

          <!-- Snackbar thông báo -->
          <v-snackbar
            v-model="snackbar.show"
            :color="snackbar.color"
            timeout="3000"
            rounded="pill"
            location="top"
          >
            {{ snackbar.message }}
            <template v-slot:actions>
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
const activeTab = ref("general"); // Default tab

// Trạng thái snackbar
const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

// Computed cho price settings
const priceSettings = computed(() =>
  settings.value.filter((s) => !["ENABLE_BUY", "ENABLE_SELL"].includes(s.key))
);

// Computed to check if there are changes
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

// Cập nhật state khi input thay đổi
function updateSetting(key: string, value: string | boolean) {
  const setting = settings.value.find((s) => s.key === key);
  if (setting) {
    setting.value = value;
  } else {
    settings.value.push({ id: `temp-${Date.now()}`, key, value });
  }
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
    console.error("Fetch settings failed:", err);
    settings.value = [];
    initialSettings.value = [];
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
    console.error("Save settings failed:", err);
    snackbar.value = {
      show: true,
      message: "Lưu cài đặt thất bại, vui lòng thử lại!",
      color: "error",
    };
  } finally {
    saving.value = false;
  }
}

onMounted(fetchSettings);
</script>

<style scoped>
/* Card styling */
.dark-card {
  background: linear-gradient(135deg, #0a1420 0%, #18222f 100%);
  color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.dark-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(30, 136, 229, 0.2);
}

/* Divider styling */
.divider {
  border-color: rgba(255, 255, 255, 0.1);
}

/* Tabs styling */
.tabs-custom :deep(.v-tab) {
  color: #ffffff !important;
  text-transform: none;
  font-weight: 500;
  justify-content: flex-start;
  padding: 12px 16px;
  border-radius: 8px;
  transition: background 0.3s ease;
}

.tabs-custom :deep(.v-tab--active) {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
  color: #ffffff !important;
}

.tabs-custom :deep(.v-tab:hover) {
  background: rgba(255, 255, 255, 0.1);
}

/* Switch styling */
.switch-custom {
  transition: all 0.3s ease;
}

.switch-custom :deep(.v-label) {
  color: #ffffff !important;
  font-weight: 500;
  font-size: 16px;
}

.switch-custom :deep(.v-switch__thumb) {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
}

.switch-custom :deep(.v-switch__track) {
  background: rgba(255, 255, 255, 0.1);
}

/* Text field styling */
.text-field-custom :deep(.v-field) {
  background: linear-gradient(135deg, #263c65 0%, #2a2a3a 100%);
  border-radius: 8px;
}

.text-field-custom :deep(.v-field__input) {
  color: #ffffff !important;
  font-weight: 500;
}

.text-field-custom :deep(.v-label) {
  color: rgba(200, 200, 200, 0.7) !important;
  font-weight: 500;
}

.text-field-custom :deep(.v-field__outline) {
  color: rgba(255, 255, 255, 0.2);
}

.text-field-custom :deep(.v-field--focused .v-field__outline) {
  color: #4fc3f7 !important;
}

/* Save button */
.save-btn {
  background: linear-gradient(90deg, #4fc3f7 0%, #2196f3 100%) !important;
  color: #ffffff;
  border-radius: 8px;
  text-transform: none;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.save-btn:hover:not(.v-btn--disabled) {
  background: linear-gradient(90deg, #64b5f6 0%, #42a5f5 100%) !important;
  transform: translateY(-2px);
}

.save-btn.v-btn--disabled {
  background: rgba(255, 255, 255, 0.1) !important;
  color: rgba(255, 255, 255, 0.5) !important;
}

/* Loading animation */
:deep(.v-progress-circular) {
  color: #4fc3f7;
}

/* Text styling */
.text-grey {
  color: rgba(200, 200, 200, 0.7);
}

/* Snackbar styling */
:deep(.v-snackbar__wrapper) {
  border-radius: 12px !important;
  font-weight: 500;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .dark-card {
    padding: 16px;
  }
  .text-h4 {
    font-size: 1.5rem !important;
  }
  .switch-custom :deep(.v-label) {
    font-size: 14px;
  }
  .text-field-custom :deep(.v-label) {
    font-size: 14px;
  }
  .tabs-custom :deep(.v-tab) {
    font-size: 14px;
    padding: 10px 12px;
  }
}

/* Scrollbar styling */
:deep(.v-container::-webkit-scrollbar) {
  width: 8px;
}

:deep(.v-container::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

:deep(.v-container::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
}
</style>
