<template>
  <v-container fluid class="settings-page pa-4">
    <div class="settings-wrapper">
      <!-- Compact Header -->
      <div class="settings-header">
        <div class="header-left">
          <v-icon size="20" color="#a78bfa">mdi-cog</v-icon>
          <span class="header-title">Cài đặt</span>
        </div>
        <v-btn
          v-if="hasChanges"
          @click="saveAllSettings"
          :loading="saving"
          size="small"
          variant="flat"
          class="save-btn"
        >
          <v-icon size="16" start>mdi-check</v-icon>
          Lưu
        </v-btn>
      </div>

      <!-- Tabs Navigation -->
      <div class="tabs-nav">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="['tab-btn', { active: activeTab === tab.value }]"
          @click="activeTab = tab.value"
        >
          <v-icon size="16">{{ tab.icon }}</v-icon>
          <span>{{ tab.title }}</span>
        </button>
      </div>

      <!-- Content -->
      <div class="settings-content">
        <!-- General Tab -->
        <div v-if="activeTab === 'general'" class="tab-content">
          <!-- Trading Toggles -->
          <div class="section">
            <div class="section-header">
              <span class="section-title">Chế độ giao dịch</span>
            </div>
            <div class="toggle-grid">
              <label class="toggle-item">
                <div class="toggle-info">
                  <v-icon size="14" :color="getBool('ENABLE_BUY') ? '#10b981' : '#64748b'">mdi-cart</v-icon>
                  <span>Mua</span>
                </div>
                <v-switch
                  :model-value="getBool('ENABLE_BUY')"
                  @update:modelValue="updateSetting('ENABLE_BUY', $event!)"
                  color="success"
                  density="compact"
                  hide-details
                />
              </label>
              <label class="toggle-item">
                <div class="toggle-info">
                  <v-icon size="14" :color="getBool('ENABLE_SELL') ? '#ef4444' : '#64748b'">mdi-cash</v-icon>
                  <span>Bán</span>
                </div>
                <v-switch
                  :model-value="getBool('ENABLE_SELL')"
                  @update:modelValue="updateSetting('ENABLE_SELL', $event!)"
                  color="error"
                  density="compact"
                  hide-details
                />
              </label>
              <label class="toggle-item">
                <div class="toggle-info">
                  <v-icon size="14" :color="getBool('ENABLE_FUTURE') ? '#f59e0b' : '#64748b'">mdi-chart-line</v-icon>
                  <span>Futures</span>
                </div>
                <v-switch
                  :model-value="getBool('ENABLE_FUTURE')"
                  @update:modelValue="updateSetting('ENABLE_FUTURE', $event!)"
                  color="warning"
                  density="compact"
                  hide-details
                />
              </label>
            </div>
          </div>

          <!-- Price Limits -->
          <div class="section">
            <div class="section-header">
              <span class="section-title">Giá mua tối đa</span>
            </div>
            <div class="input-grid">
              <div v-for="item in rootFields" :key="item.key" class="input-item">
                <label class="input-label">{{ formatLabel(item.key) }}</label>
                <input
                  v-model="item.value"
                  type="number"
                  class="input-field"
                  @input="updateSetting(item.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>

          <!-- PAXG -->
          <div v-if="paxgSettings.length" class="section">
            <div class="section-header">
              <span class="section-title">PAXG</span>
              <v-icon size="14" color="#f59e0b">mdi-gold</v-icon>
            </div>
            <div class="input-grid">
              <div v-for="item in paxgSettings" :key="item.key" class="input-item">
                <label class="input-label">{{ formatLabel(item.key) }}</label>
                <input
                  v-model="item.value"
                  type="number"
                  class="input-field"
                  @input="updateSetting(item.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Mini Tab -->
        <div v-if="activeTab === 'mini'" class="tab-content">
          <!-- Mini Settings -->
          <div class="section">
            <div class="section-header">
              <span class="section-title">Mini</span>
            </div>
            <div class="toggle-grid mb-3">
              <label class="toggle-item">
                <div class="toggle-info">
                  <v-icon size="14" :color="getBool('ENABLE_BUY_MINI') ? '#a78bfa' : '#64748b'">mdi-cart</v-icon>
                  <span>Mua Mini</span>
                </div>
                <v-switch
                  :model-value="getBool('ENABLE_BUY_MINI')"
                  @update:modelValue="updateSetting('ENABLE_BUY_MINI', $event!)"
                  color="secondary"
                  density="compact"
                  hide-details
                />
              </label>
              <label class="toggle-item">
                <div class="toggle-info">
                  <v-icon size="14" :color="getBool('ENABLE_SELL_MINI') ? '#a78bfa' : '#64748b'">mdi-cash</v-icon>
                  <span>Bán Mini</span>
                </div>
                <v-switch
                  :model-value="getBool('ENABLE_SELL_MINI')"
                  @update:modelValue="updateSetting('ENABLE_SELL_MINI', $event!)"
                  color="secondary"
                  density="compact"
                  hide-details
                />
              </label>
            </div>
            <div class="input-grid">
              <div v-for="item in [...miniCommonFields, ...miniSpecificFields]" :key="item.key" class="input-item">
                <label class="input-label">{{ formatLabel(item.key) }}</label>
                <input
                  v-model="item.value"
                  type="number"
                  class="input-field"
                  @input="updateSetting(item.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>

                  </div>

        <!-- ICT Tab -->
        <div v-if="activeTab === 'ict'" class="tab-content">
          <div class="section">
            <div class="section-header">
              <span class="section-title">ICT Strategy</span>
              <v-icon size="14" color="#06b6d4">mdi-chart-timeline-variant-shimmer</v-icon>
            </div>
            <div class="toggle-grid mb-3">
              <label class="toggle-item">
                <div class="toggle-info">
                  <v-icon size="14" :color="getBool('ENABLE_BUY_ICT') ? '#06b6d4' : '#64748b'">mdi-cart</v-icon>
                  <span>Mua ICT</span>
                </div>
                <v-switch
                  :model-value="getBool('ENABLE_BUY_ICT')"
                  @update:modelValue="updateSetting('ENABLE_BUY_ICT', $event!)"
                  color="cyan"
                  density="compact"
                  hide-details
                />
              </label>
              <label class="toggle-item">
                <div class="toggle-info">
                  <v-icon size="14" :color="getBool('ENABLE_SELL_ICT') ? '#06b6d4' : '#64748b'">mdi-cash</v-icon>
                  <span>Bán ICT</span>
                </div>
                <v-switch
                  :model-value="getBool('ENABLE_SELL_ICT')"
                  @update:modelValue="updateSetting('ENABLE_SELL_ICT', $event!)"
                  color="cyan"
                  density="compact"
                  hide-details
                />
              </label>
            </div>
            <div class="input-grid">
              <div v-for="item in ictFields" :key="item.key" class="input-item">
                <label class="input-label">{{ formatLabel(item.key) }}</label>
                <input
                  v-model="item.value"
                  type="number"
                  class="input-field"
                  @input="updateSetting(item.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Security Tab -->
        <div v-if="activeTab === 'security'" class="tab-content">
          <div class="empty-state">
            <v-icon size="32" color="#475569">mdi-shield-lock-outline</v-icon>
            <span>Sắp ra mắt</span>
          </div>
        </div>

        <!-- Advanced Tab -->
        <div v-if="activeTab === 'advanced'" class="tab-content">
          <div class="empty-state">
            <v-icon size="32" color="#475569">mdi-cog-outline</v-icon>
            <span>Sắp ra mắt</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="2000" location="top">
      {{ snackbar.message }}
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

const tabs = [
  { value: "general", title: "Chung", icon: "mdi-tune" },
  { value: "mini", title: "Mini", icon: "mdi-scale-balance" },
  { value: "ict", title: "ICT", icon: "mdi-chart-timeline-variant-shimmer" },
  { value: "security", title: "Bảo mật", icon: "mdi-shield-lock" },
  { value: "advanced", title: "Nâng cao", icon: "mdi-cog" },
];

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
const ICT_KEYS = [
  "ENABLE_BUY_ICT",
  "ENABLE_SELL_ICT",
  "MAX_BNB_PRICE_ICT",
  "MAX_SOL_PRICE_ICT",
  "MAX_BTC_PRICE_ICT",
  "DCA_WHEN_DROP_PERCENT_ICT",
  "ICT_BUY_AMOUNT",
];

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
const ictSettings = computed(() =>
  settings.value
    .filter((s) => ICT_KEYS.includes(s.key))
    .sort((a, b) => ICT_KEYS.indexOf(a.key) - ICT_KEYS.indexOf(b.key))
);

const rootFields = computed(() => rootSettings.value.filter((s) => !s.key.startsWith("ENABLE")));
const miniCommonFields = computed(() =>
  miniSettings.value.filter((s) =>
    ["MAX_BNB_PRICE_MINI", "MAX_SOL_PRICE_MINI", "MAX_BTC_PRICE_MINI"].includes(s.key)
  )
);
const miniSpecificFields = computed(() =>
  miniSettings.value.filter(
    (s) =>
      !["MAX_BNB_PRICE_MINI", "MAX_SOL_PRICE_MINI", "MAX_BTC_PRICE_MINI"].includes(s.key) &&
      !s.key.startsWith("ENABLE")
  )
);
const ictFields = computed(() => ictSettings.value.filter((s) => !s.key.startsWith("ENABLE")));

function getBool(key: string) {
  const s = settings.value.find((x) => x.key === key);
  return s?.value === true || s?.value === "true";
}

function updateSetting(key: string, value: string | boolean) {
  const s = settings.value.find((x) => x.key === key);
  if (s) s.value = value;
}

function formatLabel(key: string): string {
  const labels: Record<string, string> = {
    MAX_BNB_PRICE: "BNB",
    MAX_SOL_PRICE: "SOL",
    MAX_BTC_PRICE: "BTC",
    DCA_WHEN_DROP_PERCENT: "DCA Drop %",
    MAX_PAXG_PRICE: "Giá tối đa",
    PAXG_BUY_AMOUNT: "Số lượng mua",
    MAX_BNB_PRICE_MINI: "BNB",
    MAX_SOL_PRICE_MINI: "SOL",
    MAX_BTC_PRICE_MINI: "BTC",
    DCA_WHEN_DROP_PERCENT_MINI: "DCA Drop %",
    MINI_BUY_AMOUNT: "Số lượng",
    // ICT
    MAX_BNB_PRICE_ICT: "BNB",
    MAX_SOL_PRICE_ICT: "SOL",
    MAX_BTC_PRICE_ICT: "BTC",
    DCA_WHEN_DROP_PERCENT_ICT: "DCA Drop %",
    ICT_BUY_AMOUNT: "Số lượng",
  };
  return labels[key] || key;
}

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
    snackbar.value = { show: true, message: "Đã lưu", color: "success" };
  } catch {
    snackbar.value = { show: true, message: "Lỗi!", color: "error" };
  } finally {
    saving.value = false;
  }
}

onMounted(fetchSettings);
</script>

<style scoped>
.settings-page {
  display: flex;
  justify-content: center;
  min-height: 100vh;
  background: #0f172a;
}

.settings-wrapper {
  width: 100%;
  max-width: 560px;
  padding: 8px 0;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #1e293b;
  border-radius: 10px;
  margin-bottom: 12px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
}

.save-btn {
  background: linear-gradient(135deg, #7c3aed, #a78bfa) !important;
  color: white !important;
  font-size: 12px;
  font-weight: 600;
  text-transform: none;
  border-radius: 6px;
  padding: 0 12px !important;
  height: 28px !important;
}

.tabs-nav {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #1e293b;
  border-radius: 8px;
  margin-bottom: 12px;
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
}

.tab-btn.active {
  background: #334155;
  color: #f1f5f9;
}

.settings-content {
  background: #1e293b;
  border-radius: 10px;
  overflow: hidden;
}

.tab-content {
  padding: 16px;
}

.section {
  margin-bottom: 20px;
}

.section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #334155;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #0f172a;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-item:hover {
  background: #1a2744;
}

.toggle-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toggle-info span {
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
}

.input-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.input-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-label {
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
}

.input-field {
  width: 100%;
  padding: 8px 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.input-field:hover {
  border-color: #475569;
}

.input-field:focus {
  outline: none;
  border-color: #7c3aed;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: #475569;
  font-size: 13px;
}

/* Compact switch */
:deep(.v-switch) {
  transform: scale(0.8);
  transform-origin: right center;
}

@media (max-width: 600px) {
  .settings-wrapper {
    padding: 0;
  }

  .toggle-grid {
    grid-template-columns: 1fr;
  }

  .input-grid {
    grid-template-columns: 1fr;
  }

  .tabs-nav {
    overflow-x: auto;
  }

  .tab-btn {
    white-space: nowrap;
  }
}

@media (max-width: 768px) {
  .settings-wrapper {
    padding: 8px;
  }

  .page-title {
    font-size: 20px;
  }

  .tabs-nav {
    gap: 6px;
    padding: 4px;
  }

  .tab-btn {
    padding: 8px 12px;
    font-size: 11px;
    min-height: 40px;
  }

  .section-title {
    font-size: 13px;
  }

  .input-label {
    font-size: 12px;
  }

  .input-field {
    padding: 8px 10px;
    font-size: 12px;
  }

  .toggle-item {
    padding: 12px;
  }

  .toggle-label {
    font-size: 13px;
  }

  .toggle-description {
    font-size: 11px;
  }
}

@media (max-width: 480px) {
  .settings-wrapper {
    padding: 6px;
  }

  .page-title {
    font-size: 18px;
  }

  .tabs-nav {
    gap: 4px;
    padding: 3px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .tab-btn {
    padding: 6px 10px;
    font-size: 10px;
    min-height: 36px;
    white-space: nowrap;
  }

  .section-title {
    font-size: 12px;
    margin-bottom: 10px;
  }

  .input-label {
    font-size: 11px;
  }

  .input-field {
    padding: 8px;
    font-size: 11px;
    min-height: 44px;
  }

  .toggle-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .input-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .toggle-item {
    padding: 10px;
  }

  .toggle-label {
    font-size: 12px;
  }

  .toggle-description {
    font-size: 10px;
  }

  :deep(.v-switch) {
    transform: scale(1);
    min-width: 44px;
    min-height: 44px;
  }

  .empty-state {
    padding: 30px 15px;
    font-size: 12px;
  }
}
</style>
