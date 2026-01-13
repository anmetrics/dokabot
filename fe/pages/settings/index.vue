<template>
  <v-container fluid class="settings-container">
    <v-row justify="center">
      <v-col cols="12" xl="10">
        <!-- Page Header -->
        <div class="page-header mb-6">
          <div class="d-flex align-center gap-3">
            <div class="header-icon-wrapper">
              <v-icon size="28" color="white">mdi-cog-outline</v-icon>
            </div>
            <div>
              <h1 class="page-title">Cài đặt hệ thống</h1>
              <p class="page-subtitle">
                Quản lý cấu hình giao dịch và tham số hệ thống
              </p>
            </div>
          </div>
          <v-btn
            v-if="hasChanges"
            @click="saveAllSettings"
            :loading="saving"
            class="save-all-btn"
          >
            <v-icon start>mdi-content-save</v-icon>
            Lưu tất cả
          </v-btn>
        </div>

        <!-- Settings Layout with Sidebar -->
        <v-row>
          <!-- Left Sidebar Navigation -->
          <v-col cols="12" md="3">
            <v-card class="sidebar-card">
              <div class="sidebar-header">
                <v-icon size="20" color="#a78bfa">mdi-view-list</v-icon>
                <span class="sidebar-title">Danh mục</span>
              </div>
              <v-list class="sidebar-nav">
                <v-list-item
                  v-for="tab in tabs"
                  :key="tab.value"
                  :class="{ 'nav-item-active': activeTab === tab.value }"
                  class="nav-item"
                  @click="activeTab = tab.value"
                >
                  <template #prepend>
                    <div class="nav-icon-wrapper" :style="{ background: activeTab === tab.value ? tab.gradient : 'rgba(167, 139, 250, 0.1)' }">
                      <v-icon size="20" :color="activeTab === tab.value ? 'white' : tab.color">{{ tab.icon }}</v-icon>
                    </div>
                  </template>
                  <v-list-item-title class="nav-title">
                    {{ tab.title }}
                  </v-list-item-title>
                  <template #append>
                    <v-icon v-if="activeTab === tab.value" size="16" color="#a78bfa">mdi-chevron-right</v-icon>
                  </template>
                </v-list-item>
              </v-list>
            </v-card>
          </v-col>

          <!-- Main Content Area -->
          <v-col cols="12" md="9">
            <!-- General Settings Tab -->
            <div v-if="activeTab === 'general'" class="content-wrapper">
              <!-- Root Settings -->
              <v-card class="settings-card mb-6">
                <div class="card-header">
                  <div class="d-flex align-center gap-3">
                    <div class="section-icon-wrapper root-icon">
                      <v-icon size="24" color="white">mdi-tune-variant</v-icon>
                    </div>
                    <div>
                      <h2 class="section-title">Cài đặt chính</h2>
                      <p class="section-subtitle">Cấu hình giao dịch cơ bản</p>
                    </div>
                  </div>
                </div>

                <v-card-text class="pa-6">
                  <!-- Enable Switches Row -->
                  <v-row class="mb-4">
                    <v-col cols="12" sm="6" md="4">
                      <div class="switch-card">
                        <div class="switch-header">
                          <v-icon size="20" color="#10b981">mdi-shopping</v-icon>
                          <span class="switch-label">Chế độ mua</span>
                        </div>
                        <v-switch
                          :model-value="getBool('ENABLE_BUY')"
                          @update:modelValue="updateSetting('ENABLE_BUY', $event!)"
                          color="success"
                          inset
                          hide-details
                          class="switch-custom"
                        >
                          <template #label>
                            <span :class="getBool('ENABLE_BUY') ? 'switch-on' : 'switch-off'">
                              {{ getBool('ENABLE_BUY') ? 'Bật' : 'Tắt' }}
                            </span>
                          </template>
                        </v-switch>
                      </div>
                    </v-col>

                    <v-col cols="12" sm="6" md="4">
                      <div class="switch-card">
                        <div class="switch-header">
                          <v-icon size="20" color="#ef4444">mdi-cash-multiple</v-icon>
                          <span class="switch-label">Chế độ bán</span>
                        </div>
                        <v-switch
                          :model-value="getBool('ENABLE_SELL')"
                          @update:modelValue="updateSetting('ENABLE_SELL', $event!)"
                          color="error"
                          inset
                          hide-details
                          class="switch-custom"
                        >
                          <template #label>
                            <span :class="getBool('ENABLE_SELL') ? 'switch-on' : 'switch-off'">
                              {{ getBool('ENABLE_SELL') ? 'Bật' : 'Tắt' }}
                            </span>
                          </template>
                        </v-switch>
                      </div>
                    </v-col>

                    <v-col cols="12" sm="6" md="4">
                      <div class="switch-card">
                        <div class="switch-header">
                          <v-icon size="20" color="#f59e0b">mdi-chart-timeline-variant</v-icon>
                          <span class="switch-label">Futures</span>
                        </div>
                        <v-switch
                          :model-value="getBool('ENABLE_FUTURE')"
                          @update:modelValue="updateSetting('ENABLE_FUTURE', $event!)"
                          color="warning"
                          inset
                          hide-details
                          class="switch-custom"
                        >
                          <template #label>
                            <span :class="getBool('ENABLE_FUTURE') ? 'switch-on' : 'switch-off'">
                              {{ getBool('ENABLE_FUTURE') ? 'Bật' : 'Tắt' }}
                            </span>
                          </template>
                        </v-switch>
                      </div>
                    </v-col>
                  </v-row>

                  <v-divider class="my-6"></v-divider>

                  <!-- Price Settings -->
                  <h3 class="subsection-title mb-4">Giá mua tối đa</h3>
                  <v-row>
                    <v-col
                      v-for="item in rootFields"
                      :key="item.key"
                      cols="12"
                      sm="6"
                      md="4"
                    >
                      <v-text-field
                        v-model="item.value"
                        :label="item.key"
                        variant="outlined"
                        density="comfortable"
                        type="number"
                        class="input-field"
                        @update:modelValue="updateSetting(item.key, $event)"
                      >
                        <template #prepend-inner>
                          <v-icon size="18" color="#a78bfa">mdi-currency-usd</v-icon>
                        </template>
                      </v-text-field>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>

              <!-- PAXG Settings -->
              <v-card v-if="paxgSettings.length" class="settings-card mb-6">
                <div class="card-header">
                  <div class="d-flex align-center gap-3">
                    <div class="section-icon-wrapper paxg-icon">
                      <v-icon size="24" color="white">mdi-gold</v-icon>
                    </div>
                    <div>
                      <h2 class="section-title">PAXG Settings</h2>
                      <p class="section-subtitle">Cấu hình giao dịch vàng số</p>
                    </div>
                  </div>
                </div>

                <v-card-text class="pa-6">
                  <v-row>
                    <v-col
                      v-for="item in paxgSettings"
                      :key="item.key"
                      cols="12"
                      sm="6"
                      md="4"
                    >
                      <v-text-field
                        v-model="item.value"
                        :label="item.key"
                        variant="outlined"
                        density="comfortable"
                        type="number"
                        class="input-field"
                        @update:modelValue="updateSetting(item.key, $event)"
                      >
                        <template #prepend-inner>
                          <v-icon size="18" color="#f59e0b">mdi-gold</v-icon>
                        </template>
                      </v-text-field>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </div>

            <!-- Mini Settings Tab -->
            <div v-if="activeTab === 'mini'" class="content-wrapper">
              <!-- Mini Settings -->
              <v-card v-if="miniSettings.length" class="settings-card mb-6">
                <div class="card-header">
                  <div class="d-flex align-center gap-3">
                    <div class="section-icon-wrapper mini-icon">
                      <v-icon size="24" color="white">mdi-scale-balance</v-icon>
                    </div>
                    <div>
                      <h2 class="section-title">Mini Settings</h2>
                      <p class="section-subtitle">Cấu hình giao dịch mini</p>
                    </div>
                  </div>
                </div>

                <v-card-text class="pa-6">
                  <!-- Mini Enable Switches -->
                  <v-row class="mb-4">
                    <v-col cols="12" sm="6">
                      <div class="switch-card">
                        <div class="switch-header">
                          <v-icon size="20" color="#a78bfa">mdi-shopping</v-icon>
                          <span class="switch-label">Mini - Mua</span>
                        </div>
                        <v-switch
                          :model-value="getBool('ENABLE_BUY_MINI')"
                          @update:modelValue="updateSetting('ENABLE_BUY_MINI', $event!)"
                          color="secondary"
                          inset
                          hide-details
                          class="switch-custom"
                        >
                          <template #label>
                            <span :class="getBool('ENABLE_BUY_MINI') ? 'switch-on' : 'switch-off'">
                              {{ getBool('ENABLE_BUY_MINI') ? 'Bật' : 'Tắt' }}
                            </span>
                          </template>
                        </v-switch>
                      </div>
                    </v-col>

                    <v-col cols="12" sm="6">
                      <div class="switch-card">
                        <div class="switch-header">
                          <v-icon size="20" color="#a78bfa">mdi-cash-multiple</v-icon>
                          <span class="switch-label">Mini - Bán</span>
                        </div>
                        <v-switch
                          :model-value="getBool('ENABLE_SELL_MINI')"
                          @update:modelValue="updateSetting('ENABLE_SELL_MINI', $event!)"
                          color="secondary"
                          inset
                          hide-details
                          class="switch-custom"
                        >
                          <template #label>
                            <span :class="getBool('ENABLE_SELL_MINI') ? 'switch-on' : 'switch-off'">
                              {{ getBool('ENABLE_SELL_MINI') ? 'Bật' : 'Tắt' }}
                            </span>
                          </template>
                        </v-switch>
                      </div>
                    </v-col>
                  </v-row>

                  <v-divider class="my-6"></v-divider>

                  <!-- Mini Fields -->
                  <v-row>
                    <v-col
                      v-for="item in [...miniCommonFields, ...miniSpecificFields]"
                      :key="item.key"
                      cols="12"
                      sm="6"
                      md="4"
                    >
                      <v-text-field
                        v-model="item.value"
                        :label="item.key"
                        variant="outlined"
                        density="comfortable"
                        type="number"
                        class="input-field"
                        @update:modelValue="updateSetting(item.key, $event)"
                      >
                        <template #prepend-inner>
                          <v-icon size="18" color="#a78bfa">mdi-currency-usd</v-icon>
                        </template>
                      </v-text-field>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>

              <!-- Super Mini Settings -->
              <v-card v-if="superMiniSettings.length" class="settings-card mb-6">
                <div class="card-header">
                  <div class="d-flex align-center gap-3">
                    <div class="section-icon-wrapper supermini-icon">
                      <v-icon size="24" color="white">mdi-rocket-launch</v-icon>
                    </div>
                    <div>
                      <h2 class="section-title">Super Mini Settings</h2>
                      <p class="section-subtitle">Cấu hình giao dịch super mini</p>
                    </div>
                  </div>
                </div>

                <v-card-text class="pa-6">
                  <!-- Super Mini Enable Switches -->
                  <v-row class="mb-4">
                    <v-col cols="12" sm="6">
                      <div class="switch-card">
                        <div class="switch-header">
                          <v-icon size="20" color="#ec4899">mdi-shopping</v-icon>
                          <span class="switch-label">Super Mini - Mua</span>
                        </div>
                        <v-switch
                          :model-value="getBool('ENABLE_BUY_SUPERMINI')"
                          @update:modelValue="updateSetting('ENABLE_BUY_SUPERMINI', $event!)"
                          color="pink"
                          inset
                          hide-details
                          class="switch-custom"
                        >
                          <template #label>
                            <span :class="getBool('ENABLE_BUY_SUPERMINI') ? 'switch-on' : 'switch-off'">
                              {{ getBool('ENABLE_BUY_SUPERMINI') ? 'Bật' : 'Tắt' }}
                            </span>
                          </template>
                        </v-switch>
                      </div>
                    </v-col>

                    <v-col cols="12" sm="6">
                      <div class="switch-card">
                        <div class="switch-header">
                          <v-icon size="20" color="#ec4899">mdi-cash-multiple</v-icon>
                          <span class="switch-label">Super Mini - Bán</span>
                        </div>
                        <v-switch
                          :model-value="getBool('ENABLE_SELL_SUPERMINI')"
                          @update:modelValue="updateSetting('ENABLE_SELL_SUPERMINI', $event!)"
                          color="pink"
                          inset
                          hide-details
                          class="switch-custom"
                        >
                          <template #label>
                            <span :class="getBool('ENABLE_SELL_SUPERMINI') ? 'switch-on' : 'switch-off'">
                              {{ getBool('ENABLE_SELL_SUPERMINI') ? 'Bật' : 'Tắt' }}
                            </span>
                          </template>
                        </v-switch>
                      </div>
                    </v-col>
                  </v-row>

                  <v-divider class="my-6"></v-divider>

                  <!-- Super Mini Fields -->
                  <v-row>
                    <v-col
                      v-for="item in superMiniFields"
                      :key="item.key"
                      cols="12"
                      sm="6"
                      md="4"
                    >
                      <v-text-field
                        v-model="item.value"
                        :label="item.key"
                        variant="outlined"
                        density="comfortable"
                        type="number"
                        class="input-field"
                        @update:modelValue="updateSetting(item.key, $event)"
                      >
                        <template #prepend-inner>
                          <v-icon size="18" color="#ec4899">mdi-currency-usd</v-icon>
                        </template>
                      </v-text-field>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </div>

            <!-- Security Settings Tab -->
            <div v-if="activeTab === 'security'" class="content-wrapper">
              <v-card class="settings-card">
                <div class="card-header">
                  <div class="d-flex align-center gap-3">
                    <div class="section-icon-wrapper security-icon">
                      <v-icon size="24" color="white">mdi-shield-lock</v-icon>
                    </div>
                    <div>
                      <h2 class="section-title">Cài đặt bảo mật</h2>
                      <p class="section-subtitle">Quản lý xác thực và quyền truy cập</p>
                    </div>
                  </div>
                </div>

                <v-card-text class="pa-6">
                  <div class="empty-state">
                    <v-icon size="80" color="#64748b">mdi-shield-lock-outline</v-icon>
                    <h3 class="empty-title">Sắp ra mắt</h3>
                    <p class="empty-subtitle">
                      Chức năng cài đặt bảo mật đang được phát triển
                    </p>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <!-- Advanced Settings Tab -->
            <div v-if="activeTab === 'advanced'" class="content-wrapper">
              <v-card class="settings-card">
                <div class="card-header">
                  <div class="d-flex align-center gap-3">
                    <div class="section-icon-wrapper advanced-icon">
                      <v-icon size="24" color="white">mdi-cog-outline</v-icon>
                    </div>
                    <div>
                      <h2 class="section-title">Cài đặt nâng cao</h2>
                      <p class="section-subtitle">Tùy chỉnh hệ thống chuyên sâu</p>
                    </div>
                  </div>
                </div>

                <v-card-text class="pa-6">
                  <div class="empty-state">
                    <v-icon size="80" color="#64748b">mdi-tools</v-icon>
                    <h3 class="empty-title">Sắp ra mắt</h3>
                    <p class="empty-subtitle">
                      Các tùy chỉnh nâng cao đang được phát triển
                    </p>
                  </div>
                </v-card-text>
              </v-card>
            </div>

            <!-- Save Button Bottom -->
            <div v-if="hasChanges" class="text-center mt-6">
              <v-btn
                @click="saveAllSettings"
                :loading="saving"
                size="large"
                class="save-bottom-btn"
              >
                <v-icon start>mdi-check-circle</v-icon>
                Lưu tất cả thay đổi
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <!-- Snackbar -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
      location="top"
    >
      {{ snackbar.message }}
      <template #actions>
        <v-btn variant="text" @click="snackbar.show = false">Đóng</v-btn>
      </template>
    </v-snackbar>
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

// Sidebar Tabs
const tabs = [
  {
    value: "general",
    title: "Cài đặt chung",
    icon: "mdi-tune-variant",
    color: "#7c3aed",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
  },
  {
    value: "mini",
    title: "Cài đặt Mini",
    icon: "mdi-scale-balance",
    color: "#a78bfa",
    gradient: "linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)",
  },
  {
    value: "security",
    title: "Bảo mật",
    icon: "mdi-shield-lock",
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  },
  {
    value: "advanced",
    title: "Nâng cao",
    icon: "mdi-cog-outline",
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  },
];

// Keys
const ROOT_KEYS = [
  "ENABLE_BUY",
  "ENABLE_SELL",
  "ENABLE_FUTURE",
  "MAX_BNB_PRICE",
  "MAX_SOL_PRICE",
  "MAX_BTC_PRICE",
  "DCA_WHEN_DROP_PERCENT",
];
const PAXG_KEYS = ["MAX_PAXG_PRICE", "PAXG_BUY_AMOUNT"];
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

// Computed groups
const rootSettings = computed(() =>
  settings.value
    .filter((s) => ROOT_KEYS.includes(s.key))
    .sort((a, b) => ROOT_KEYS.indexOf(a.key) - ROOT_KEYS.indexOf(b.key))
);
const paxgSettings = computed(() =>
  settings.value
    .filter((s) => PAXG_KEYS.includes(s.key))
    .sort((a, b) => PAXG_KEYS.indexOf(a.key) - PAXG_KEYS.indexOf(b.key))
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

// Sub-fields
const rootFields = computed(() =>
  rootSettings.value.filter((s) => !s.key.startsWith("ENABLE"))
);
const miniCommonFields = computed(() =>
  miniSettings.value.filter((s) =>
    ["MAX_BNB_PRICE_MINI", "MAX_SOL_PRICE_MINI", "MAX_BTC_PRICE_MINI"].includes(
      s.key
    )
  )
);
const miniSpecificFields = computed(() =>
  miniSettings.value.filter(
    (s) =>
      ![
        "MAX_BNB_PRICE_MINI",
        "MAX_SOL_PRICE_MINI",
        "MAX_BTC_PRICE_MINI",
      ].includes(s.key) && !s.key.startsWith("ENABLE")
  )
);
const superMiniFields = computed(() =>
  superMiniSettings.value.filter((s) => !s.key.startsWith("ENABLE"))
);

// Helpers
function getBool(key: string) {
  const s = settings.value.find((x) => x.key === key);
  return s?.value === true || s?.value === "true";
}

function updateSetting(key: string, value: string | boolean) {
  const s = settings.value.find((x) => x.key === key);
  if (s) s.value = value;
}

// Fetch settings
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

// Save all
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
      message: "✅ Lưu cài đặt thành công!",
      color: "success",
    };
  } catch {
    snackbar.value = {
      show: true,
      message: "❌ Lưu cài đặt thất bại!",
      color: "error",
    };
  } finally {
    saving.value = false;
  }
}

onMounted(fetchSettings);
</script>

<style scoped>
.settings-container {
  max-width: 1400px;
  padding: 24px;
}

/* Page Header */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
}

.header-icon-wrapper {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #94a3b8;
  margin: 4px 0 0 0;
}

/* Sidebar */
.sidebar-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
  position: sticky;
  top: 24px;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  background: rgba(167, 139, 250, 0.05);
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
}

.sidebar-nav {
  background: transparent;
  padding: 8px;
}

.nav-item {
  border-radius: 12px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  padding: 12px 16px !important;
  min-height: 60px;
}

.nav-item:hover {
  background: rgba(167, 139, 250, 0.08);
  border-color: rgba(167, 139, 250, 0.2);
}

.nav-item-active {
  background: rgba(124, 58, 237, 0.15) !important;
  border-color: rgba(167, 139, 250, 0.3) !important;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
}

.nav-icon-wrapper {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  transition: all 0.3s ease;
}

.nav-title {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.nav-item-active .nav-title {
  color: #a78bfa;
}

/* Content Wrapper */
.content-wrapper {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Settings Card */
.settings-card {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
}

.settings-card:hover {
  border-color: rgba(167, 139, 250, 0.2);
  box-shadow: 0 8px 24px rgba(124, 58, 237, 0.15);
}

.card-header {
  padding: 24px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  background: rgba(167, 139, 250, 0.03);
}

.section-icon-wrapper {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.root-icon {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
}

.paxg-icon {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.mini-icon {
  background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%);
}

.supermini-icon {
  background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
}

.security-icon {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.advanced-icon {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  margin: 0;
}

.section-subtitle {
  font-size: 13px;
  color: #94a3b8;
  margin: 4px 0 0 0;
}

.subsection-title {
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
}

/* Switch Card */
.switch-card {
  background: rgba(167, 139, 250, 0.05);
  border: 1px solid rgba(167, 139, 250, 0.15);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s ease;
}

.switch-card:hover {
  background: rgba(167, 139, 250, 0.08);
  border-color: rgba(167, 139, 250, 0.3);
}

.switch-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.switch-label {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.switch-custom :deep(.v-label) {
  font-size: 14px;
  font-weight: 600;
}

.switch-on {
  color: #10b981;
}

.switch-off {
  color: #64748b;
}

/* Input Field */
.input-field :deep(.v-field) {
  background: rgba(167, 139, 250, 0.05);
  border: 1px solid rgba(167, 139, 250, 0.15);
  color: #f1f5f9;
  transition: all 0.3s ease;
}

.input-field :deep(.v-field:hover) {
  background: rgba(167, 139, 250, 0.08);
  border-color: rgba(167, 139, 250, 0.3);
}

.input-field :deep(.v-field--focused) {
  background: rgba(167, 139, 250, 0.1);
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.1);
}

.input-field :deep(.v-label) {
  color: #94a3b8;
  font-weight: 500;
  font-size: 13px;
}

.input-field :deep(.v-field__input) {
  color: #f1f5f9;
  font-weight: 600;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 24px;
}

.empty-title {
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  margin-top: 20px;
  margin-bottom: 8px;
}

.empty-subtitle {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

/* Save Buttons */
.save-all-btn,
.save-bottom-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%) !important;
  color: white !important;
  text-transform: none;
  font-weight: 700;
  border-radius: 12px;
  font-size: 15px;
  padding: 12px 32px !important;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
  transition: all 0.3s ease;
}

.save-all-btn:hover,
.save-bottom-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
}

.save-bottom-btn {
  font-size: 16px;
  padding: 16px 48px !important;
}

/* Responsive */
@media (max-width: 960px) {
  .settings-container {
    padding: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .header-icon-wrapper {
    width: 48px;
    height: 48px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .save-all-btn {
    width: 100%;
  }

  .sidebar-card {
    position: relative;
    top: 0;
    margin-bottom: 24px;
  }

  .card-header {
    padding: 20px;
  }

  .section-title {
    font-size: 18px;
  }
}

@media (max-width: 600px) {
  .page-title {
    font-size: 20px;
  }

  .section-title {
    font-size: 16px;
  }

  .card-header {
    padding: 16px;
  }

  .switch-card {
    padding: 12px;
  }

  .save-bottom-btn {
    width: 100%;
    font-size: 15px;
    padding: 14px 24px !important;
  }
}
</style>
