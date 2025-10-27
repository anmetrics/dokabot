<template>
  <v-container fluid class="py-10 px-md-16">
    <v-row>
      <!-- Sidebar -->
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
            <!-- ========== GENERAL SETTINGS ========== -->
            <v-tabs-window-item value="general">
              <v-card-title class="section-title">
                <v-icon color="primary" class="mr-2">mdi-tune-variant</v-icon>
                General Settings
              </v-card-title>
              <v-divider class="divider my-6" />

              <!-- 🟩 ROOT SETTINGS -->
              <div class="group-box mb-8" v-if="rootSettings.length">
                <div class="group-header">
                  <v-icon color="amber lighten-3" size="22" class="mr-2">
                    mdi-currency-usd
                  </v-icon>
                  <span>Root Settings</span>
                </div>

                <!-- ENABLE Switchers -->
                <v-row>
                  <v-col cols="12" md="6" class="py-2">
                    <v-switch
                      :model-value="getBool('ENABLE_BUY')"
                      @update:modelValue="updateSetting('ENABLE_BUY', $event!)"
                      color="primary"
                      inset
                      :label="`Mua: ${getBool('ENABLE_BUY') ? 'Bật' : 'Tắt'}`"
                      hide-details
                      class="switch-custom"
                    />
                  </v-col>
                  <v-col cols="12" md="6" class="py-2">
                    <v-switch
                      :model-value="getBool('ENABLE_SELL')"
                      color="primary"
                      inset
                      :label="`Bán: ${getBool('ENABLE_SELL') ? 'Bật' : 'Tắt'}`"
                      hide-details
                      class="switch-custom"
                      @update:modelValue="updateSetting('ENABLE_SELL', $event!)"
                    />
                  </v-col>
                </v-row>

                <!-- Other Fields -->
                <v-row>
                  <v-col
                    v-for="item in rootFields"
                    :key="item.key"
                    cols="12"
                    md="4"
                    class="py-2"
                  >
                    <v-text-field
                      v-model="item.value"
                      :label="item.key"
                      color="primary"
                      variant="outlined"
                      density="compact"
                      type="number"
                      class="text-field-custom"
                      @update:modelValue="updateSetting(item.key, $event)"
                    />
                  </v-col>
                </v-row>
              </div>

              <!-- 🟪 MINI + SUPER MINI SETTINGS (COMBINED) -->
              <div
                class="group-box mb-8"
                v-if="miniSettings.length || superMiniSettings.length"
              >
                <div class="group-header mb-10">
                  <v-icon color="purple lighten-3" size="22" class="mr-2">
                    mdi-rocket-launch
                  </v-icon>
                  <span>Mini & Super Mini Settings</span>
                </div>

                <!-- 🌐 COMMON MINI FIELDS -->
                <v-row v-if="miniCommonFields.length">
                  <v-col
                    v-for="item in miniCommonFields"
                    :key="item.key"
                    cols="12"
                    md="4"
                    class="py-2"
                  >
                    <v-text-field
                      v-model="item.value"
                      :label="item.key"
                      color="secondary"
                      variant="outlined"
                      density="compact"
                      type="number"
                      class="text-field-custom"
                      @update:modelValue="updateSetting(item.key, $event)"
                    />
                  </v-col>
                </v-row>

                <!-- 🟪 MINI SETTINGS -->
                <div v-if="miniSettings.length" class="mt-8">
                  <div class="group-header" style="color: #ce93d8">
                    <v-icon color="secondary" size="22" class="mr-2">
                      mdi-scale-balance
                    </v-icon>
                    <span>Mini Settings</span>
                  </div>
                  <v-row>
                    <v-col cols="12" md="6" class="py-2">
                      <v-switch
                        :model-value="getBool('ENABLE_BUY_MINI')"
                        color="#ce93d8"
                        inset
                        :label="`Mua: ${
                          getBool('ENABLE_BUY_MINI') ? 'Bật' : 'Tắt'
                        }`"
                        hide-details
                        class="switch-custom"
                        @update:modelValue="
                          updateSetting('ENABLE_BUY_MINI', $event!)
                        "
                      />
                    </v-col>
                    <v-col cols="12" md="6" class="py-2">
                      <v-switch
                        :model-value="getBool('ENABLE_SELL_MINI')"
                        color="#ce93d8"
                        inset
                        :label="`Bán: ${
                          getBool('ENABLE_SELL_MINI') ? 'Bật' : 'Tắt'
                        }`"
                        hide-details
                        class="switch-custom"
                        @update:modelValue="
                          updateSetting('ENABLE_SELL_MINI', $event!)
                        "
                      />
                    </v-col>
                  </v-row>

                  <v-row>
                    <v-col
                      v-for="item in miniSpecificFields"
                      :key="item.key"
                      cols="12"
                      md="4"
                      class="py-2"
                    >
                      <v-text-field
                        v-model="item.value"
                        :label="item.key"
                        color="secondary"
                        variant="outlined"
                        density="compact"
                        type="number"
                        class="text-field-custom"
                        @update:modelValue="updateSetting(item.key, $event)"
                      />
                    </v-col>
                  </v-row>
                </div>

                <!-- 🟥 SUPER MINI SETTINGS -->
                <div v-if="superMiniSettings.length" class="mt-8">
                  <div class="group-header" style="color: #f48fb1">
                    <v-icon color="pink" size="22" class="mr-2">
                      mdi-rocket-launch
                    </v-icon>
                    <span>Super Mini Settings</span>
                  </div>

                  <v-row>
                    <v-col cols="12" md="6" class="py-2">
                      <v-switch
                        :model-value="getBool('ENABLE_BUY_SUPERMINI')"
                        color="pink"
                        inset
                        :label="`Mua: ${
                          getBool('ENABLE_BUY_SUPERMINI') ? 'Bật' : 'Tắt'
                        }`"
                        hide-details
                        class="switch-custom"
                        @update:modelValue="
                          updateSetting('ENABLE_BUY_SUPERMINI', $event!)
                        "
                      />
                    </v-col>
                    <v-col cols="12" md="6" class="py-2">
                      <v-switch
                        :model-value="getBool('ENABLE_SELL_SUPERMINI')"
                        color="pink"
                        inset
                        :label="`Bán: ${
                          getBool('ENABLE_SELL_SUPERMINI') ? 'Bật' : 'Tắt'
                        }`"
                        hide-details
                        class="switch-custom"
                        @update:modelValue="
                          updateSetting('ENABLE_SELL_SUPERMINI', $event!)
                        "
                      />
                    </v-col>
                  </v-row>

                  <v-row>
                    <v-col
                      v-for="item in superMiniFields"
                      :key="item.key"
                      cols="12"
                      md="4"
                      class="py-2"
                    >
                      <v-text-field
                        v-model="item.value"
                        :label="item.key"
                        color="pink"
                        variant="outlined"
                        density="compact"
                        type="number"
                        class="text-field-custom"
                        @update:modelValue="updateSetting(item.key, $event)"
                      />
                    </v-col>
                  </v-row>
                </div>
              </div>

              <!-- Save Button -->
              <div class="text-right mt-8" v-if="settings.length">
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

            <!-- Other tabs -->
            <v-tabs-window-item value="advanced">
              <v-card-title class="section-title">
                <v-icon color="primary" class="mr-2">mdi-cog-outline</v-icon>
                Advanced Settings
              </v-card-title>
              <v-divider class="divider my-6" />
              <p class="text-grey">Advanced settings here.</p>
            </v-tabs-window-item>

            <v-tabs-window-item value="security">
              <v-card-title class="section-title">
                <v-icon color="primary" class="mr-2"
                  >mdi-shield-half-full</v-icon
                >
                Security Settings
              </v-card-title>
              <v-divider class="divider my-6" />
              <p class="text-grey">Security settings here.</p>
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
const loading = ref(true);
const saving = ref(false);
const activeTab = ref("general");

const snackbar = ref({
  show: false,
  message: "",
  color: "success",
});

// 🧩 Nhóm key theo định nghĩa
const ROOT_KEYS = [
  "ENABLE_BUY",
  "ENABLE_SELL",
  "MAX_BNB_PRICE",
  "MAX_SOL_PRICE",
  "MAX_BTC_PRICE",
  "DCA_WHEN_DROP_PERCENT",
];
const MINI_KEYS = [
  "ENABLE_BUY_MINI",
  "ENABLE_SELL_MINI",
  "MAX_BNB_PRICE_MINI",
  "MAX_SOL_PRICE_MINI",
  "MAX_BTC_PRICE_MINI",
  "DCA_WHEN_DROP_PERCENT_MINI",
  "MINI_BUY_AMOUNT",
];
const SUPER_MINI_KEYS = [
  "ENABLE_BUY_SUPERMINI",
  "ENABLE_SELL_SUPERMINI",
  "MAX_BNB_PRICE_SUPERMINI",
  "MAX_SOL_PRICE_SUPERMINI",
  "MAX_BTC_PRICE_SUPERMINI",
  "DCA_WHEN_DROP_PERCENT_SUPERMINI",
  "SUPER_MINI_BUY_AMOUNT",
];

// 🧮 Phân loại setting
const rootSettings = computed(() =>
  settings.value
    .filter((s) => ROOT_KEYS.includes(s.key))
    .sort((a, b) => ROOT_KEYS.indexOf(a.key) - ROOT_KEYS.indexOf(b.key))
);
const miniSettings = computed(() =>
  settings.value
    .filter((s) => MINI_KEYS.includes(s.key))
    .sort((a, b) => MINI_KEYS.indexOf(a.key) - MINI_KEYS.indexOf(b.key))
);
const superMiniSettings = computed(() =>
  settings.value
    .filter((s) => SUPER_MINI_KEYS.includes(s.key))
    .sort(
      (a, b) => SUPER_MINI_KEYS.indexOf(a.key) - SUPER_MINI_KEYS.indexOf(b.key)
    )
);

// 🧩 Field cho Mini & Super Mini
const miniCommonFields = computed(() =>
  miniSettings.value
    .filter((s) =>
      [
        "MAX_BNB_PRICE_MINI",
        "MAX_SOL_PRICE_MINI",
        "MAX_BTC_PRICE_MINI",
      ].includes(s.key)
    )
    .sort(
      (a, b) =>
        [
          "MAX_BNB_PRICE_MINI",
          "MAX_SOL_PRICE_MINI",
          "MAX_BTC_PRICE_MINI",
        ].indexOf(a.key) -
        [
          "MAX_BNB_PRICE_MINI",
          "MAX_SOL_PRICE_MINI",
          "MAX_BTC_PRICE_MINI",
        ].indexOf(b.key)
    )
);
const miniSpecificFields = computed(() =>
  miniSettings.value
    .filter(
      (s) =>
        ![
          "MAX_BNB_PRICE_MINI",
          "MAX_SOL_PRICE_MINI",
          "MAX_BTC_PRICE_MINI",
        ].includes(s.key) && !s.key.startsWith("ENABLE")
    )
    .sort(
      (a, b) =>
        ["DCA_WHEN_DROP_PERCENT_MINI", "MINI_BUY_AMOUNT"].indexOf(a.key) -
        ["DCA_WHEN_DROP_PERCENT_MINI", "MINI_BUY_AMOUNT"].indexOf(b.key)
    )
);
const superMiniFields = computed(() =>
  superMiniSettings.value
    .filter((s) => !s.key.startsWith("ENABLE"))
    .sort(
      (a, b) =>
        [
          "MAX_BNB_PRICE_SUPERMINI",
          "MAX_SOL_PRICE_SUPERMINI",
          "MAX_BTC_PRICE_SUPERMINI",
          "DCA_WHEN_DROP_PERCENT_SUPERMINI",
          "SUPER_MINI_BUY_AMOUNT",
        ].indexOf(a.key) -
        [
          "MAX_BNB_PRICE_SUPERMINI",
          "MAX_SOL_PRICE_SUPERMINI",
          "MAX_BTC_PRICE_SUPERMINI",
          "DCA_WHEN_DROP_PERCENT_SUPERMINI",
          "SUPER_MINI_BUY_AMOUNT",
        ].indexOf(b.key)
    )
);
const rootFields = computed(() =>
  rootSettings.value
    .filter((s) => !s.key.startsWith("ENABLE"))
    .sort(
      (a, b) =>
        [
          "MAX_BNB_PRICE",
          "MAX_SOL_PRICE",
          "MAX_BTC_PRICE",
          "DCA_WHEN_DROP_PERCENT",
        ].indexOf(a.key) -
        [
          "MAX_BNB_PRICE",
          "MAX_SOL_PRICE",
          "MAX_BTC_PRICE",
          "DCA_WHEN_DROP_PERCENT",
        ].indexOf(b.key)
    )
);

// ✅ Helpers
function getBool(key: string) {
  const s = settings.value.find((x) => x.key === key);
  return s?.value === true || s?.value === "true";
}

function updateSetting(key: string, value: string | boolean) {
  const s = settings.value.find((x) => x.key === key);
  if (s) s.value = value;
}

// 🔄 Fetch API
async function fetchSettings() {
  loading.value = true;
  try {
    const res = await api.get<SettingItem[]>("binance/settings");
    settings.value = res.map((s) => ({
      ...s,
      value: s.key.startsWith("ENABLE_") ? s.value === "true" : s.value,
    }));
    initialSettings.value = JSON.parse(JSON.stringify(settings.value));
  } finally {
    loading.value = false;
  }
}

// 💾 Save all
const hasChanges = computed(
  () => JSON.stringify(settings.value) !== JSON.stringify(initialSettings.value)
);

async function saveAllSettings() {
  saving.value = true;
  try {
    const payload = settings.value.reduce(
      (acc, s) => ({
        ...acc,
        [s.key]: s.key.startsWith("ENABLE_") ? String(s.value) : s.value,
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
  } catch {
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
}
.main-card {
  background: linear-gradient(145deg, #111a2b 0%, #1b263a 100%);
  color: #fff;
}
.group-box {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.group-header {
  display: flex;
  align-items: center;
  color: #9ec6ff;
  font-weight: 600;
  margin-bottom: 20px;
}
.switch-custom :deep(.v-label) {
  color: #fff !important;
  font-weight: 500;
}
.text-field-custom :deep(.v-field) {
  background: rgba(255, 255, 255, 0.05);
  margin-bottom: 8px;
}
.save-btn {
  background: linear-gradient(90deg, #42a5f5, #1e88e5) !important;
  color: #fff !important;
}
</style>
