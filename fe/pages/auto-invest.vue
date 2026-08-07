<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Đầu tư tự động</h1>
        <p class="page-subtitle">
          Chọn khẩu vị rủi ro và bật lên. Hệ thống tự chạy một danh mục bot trên BTC và BNB.
        </p>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-alert
      v-if="!loading && !activeAccounts.length"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      Cần một API key đang hoạt động trước khi bật.
      <NuxtLink to="/api-keys" class="link">Thêm API key →</NuxtLink>
    </v-alert>

    <!-- RUNNING -->
    <template v-if="status?.enabled">
      <v-card class="running-card" flat>
        <div class="running-head">
          <div>
            <div class="running-title">
              <span class="dot" />
              Đang chạy · {{ presetName(status.profile) }}
            </div>
            <div class="running-sub">
              {{ status.runningCount }}/{{ status.botCount }} bot ·
              ngân sách {{ Number(status.budgetUsd).toLocaleString("vi-VN") }} USD ·
              {{ status.isPaper ? "Paper" : "Tiền thật" }}
            </div>
          </div>
          <div class="pnl" :class="Number(status.realisedPnl) >= 0 ? 'up' : 'down'">
            {{ Number(status.realisedPnl) >= 0 ? "+" : "" }}{{ status.realisedPnl }} USD
          </div>
        </div>

        <v-table density="compact" class="legs-table">
          <thead>
            <tr>
              <th>Cặp</th>
              <th>Chiến lược</th>
              <th>Khung</th>
              <th class="text-right">Mỗi lệnh</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bot in status.bots" :key="bot.id">
              <td>{{ bot.symbol }}</td>
              <td class="muted">{{ bot.strategyKey }}</td>
              <td class="muted">{{ bot.timeframe }}</td>
              <td class="text-right">{{ Number(bot.allocationUsd).toFixed(0) }} USD</td>
              <td>
                <v-chip
                  size="x-small"
                  :color="bot.status === 'RUNNING' ? 'success' : 'grey'"
                  variant="tonal"
                >
                  {{ bot.status }}
                </v-chip>
                <div v-if="bot.lastError" class="row-error">{{ bot.lastError }}</div>
              </td>
            </tr>
          </tbody>
        </v-table>

        <div class="running-actions">
          <v-btn color="error" variant="tonal" :loading="busy" @click="onDisable">
            <v-icon start size="18">mdi-stop</v-icon> Tắt đầu tư tự động
          </v-btn>
          <span class="note">
            Tắt sẽ dừng các bot nhưng không bán vị thế đang mở — bán ép sẽ chốt lỗ mà bạn
            không yêu cầu.
          </span>
        </div>
      </v-card>
    </template>

    <!-- SETUP -->
    <template v-else>
      <div class="preset-grid">
        <v-card
          v-for="preset in presets"
          :key="preset.profile"
          class="preset-card"
          :class="{ selected: form.profile === preset.profile }"
          flat
          @click="form.profile = preset.profile"
        >
          <div class="preset-head">
            <span class="preset-name">{{ preset.name }}</span>
            <v-icon v-if="form.profile === preset.profile" color="#a78bfa" size="20">
              mdi-check-circle
            </v-icon>
          </div>
          <p class="preset-desc">{{ preset.description }}</p>
          <div class="preset-meta">
            <span>{{ preset.legs.length }} bot</span>
            <span>·</span>
            <span>Dừng ở -{{ preset.maxDrawdownPercent }}%</span>
          </div>
          <p class="preset-risk">{{ preset.riskNote }}</p>
        </v-card>
      </div>

      <v-card v-if="selectedPreset" class="setup-card" flat>
        <div class="setup-title">Danh mục sẽ chạy</div>
        <div class="legs">
          <div v-for="leg in selectedPreset.legs" :key="leg.symbol + leg.strategyKey" class="leg">
            <span class="leg-symbol">{{ leg.symbol }}</span>
            <span class="leg-strategy">{{ leg.strategyKey }} · {{ leg.timeframe }}</span>
            <span class="leg-weight">{{ Math.round(leg.weight * 100) }}%</span>
          </div>
        </div>

        <v-select
          v-model="form.exchangeAccountId"
          :items="accountOptions"
          item-title="title"
          item-value="value"
          label="API key"
          variant="outlined"
          density="comfortable"
          class="mt-4"
        />
        <v-text-field
          v-model.number="form.budgetUsd"
          label="Ngân sách (USD)"
          type="number"
          min="50"
          variant="outlined"
          density="comfortable"
          hint="Chia theo tỷ trọng cho từng bot. Tối thiểu 50 USD."
          persistent-hint
        />
        <v-switch
          v-model="form.isPaper"
          color="primary"
          density="compact"
          hide-details
          class="mt-3"
          :label="form.isPaper ? 'Paper — không dùng tiền thật' : 'Giao dịch bằng tiền thật'"
        />
        <v-alert v-if="!form.isPaper" type="warning" variant="tonal" class="mt-3">
          Hệ thống sẽ đặt lệnh thật trên sàn bằng API key của bạn. Hãy chạy paper vài ngày trước.
        </v-alert>

        <v-btn
          block
          size="large"
          class="enable-btn mt-4"
          :loading="busy"
          :disabled="!canEnable"
          @click="onEnable"
        >
          Bật đầu tư tự động
        </v-btn>
      </v-card>
    </template>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useAutoInvest, type RiskProfile } from "~/composables/useAutoInvest";
import { useExchangeAccounts } from "~/composables/useExchangeAccounts";

const { presets, status, loading, load, enable, disable, readError } = useAutoInvest();
const { accounts, fetchAccounts } = useExchangeAccounts();

const busy = ref(false);
const error = ref<string | null>(null);
const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref<"success" | "error">("success");

const form = reactive({
  profile: "BALANCED" as RiskProfile,
  exchangeAccountId: "",
  budgetUsd: 1000,
  isPaper: true,
});

const activeAccounts = computed(() =>
  accounts.value.filter((a) => a.status === "ACTIVE"),
);
const accountOptions = computed(() =>
  activeAccounts.value.map((a) => ({
    title: `${a.exchange} — ${a.label}${a.isTestnet ? " (testnet)" : ""}`,
    value: a.id,
  })),
);
const selectedPreset = computed(() =>
  presets.value.find((p) => p.profile === form.profile),
);
const canEnable = computed(
  () => !!form.exchangeAccountId && form.budgetUsd >= 50,
);

const presetName = (profile: RiskProfile | null) =>
  presets.value.find((p) => p.profile === profile)?.name ?? profile ?? "";

const notify = (text: string, color: "success" | "error" = "success") => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const onEnable = async () => {
  busy.value = true;
  error.value = null;
  try {
    await enable({ ...form });
    notify("Đã bật đầu tư tự động.");
  } catch (err) {
    error.value = await readError(err);
  } finally {
    busy.value = false;
  }
};

const onDisable = async () => {
  busy.value = true;
  try {
    await disable();
    notify("Đã tắt đầu tư tự động.");
  } catch (err) {
    notify(await readError(err), "error");
  } finally {
    busy.value = false;
  }
};

onMounted(async () => {
  await Promise.all([load(), fetchAccounts()]);
  form.exchangeAccountId = accountOptions.value[0]?.value ?? "";
});
</script>

<style scoped>
.page {
  padding: 20px 24px 80px;
  color: #f1f5f9;
}
.page-head {
  margin-bottom: 20px;
}
.page-title {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.page-subtitle {
  margin-top: 4px;
  font-size: 0.85rem;
  color: #94a3b8;
  max-width: 640px;
}
.link {
  color: #a78bfa;
  margin-left: 6px;
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.preset-card,
.setup-card,
.running-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 12px;
  padding: 16px;
}
.preset-card {
  cursor: pointer;
  transition: all 0.2s ease;
}
.preset-card:hover {
  border-color: rgba(167, 139, 250, 0.3);
}
.preset-card.selected {
  border-color: #a78bfa;
  background: rgba(124, 58, 237, 0.1);
}
.preset-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.preset-name {
  font-weight: 700;
  font-size: 1rem;
}
.preset-desc {
  margin-top: 6px;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.5;
}
.preset-meta {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: #64748b;
}
.preset-risk {
  margin-top: 8px;
  font-size: 11px;
  color: #94a3b8;
  font-style: italic;
}
.setup-title,
.running-title {
  font-weight: 700;
  font-size: 0.95rem;
}
.legs {
  margin-top: 10px;
}
.leg {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-top: 1px solid rgba(167, 139, 250, 0.08);
  font-size: 13px;
}
.leg-symbol {
  font-weight: 600;
  min-width: 84px;
}
.leg-strategy {
  color: #94a3b8;
  font-size: 12px;
  flex: 1;
}
.leg-weight {
  color: #a78bfa;
  font-weight: 600;
}
.enable-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  color: #fff;
  font-weight: 600;
  text-transform: none;
}
.running-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.running-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
}
.running-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}
.pnl {
  font-size: 1.3rem;
  font-weight: 700;
}
.pnl.up {
  color: #4ade80;
}
.pnl.down {
  color: #f87171;
}
.legs-table {
  background: transparent;
  margin-top: 14px;
}
.legs-table :deep(th) {
  font-size: 10px !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b !important;
}
.legs-table :deep(td) {
  font-size: 13px;
}
.muted {
  color: #94a3b8;
}
.row-error {
  font-size: 11px;
  color: #f87171;
  margin-top: 3px;
}
.running-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.note {
  font-size: 11px;
  color: #64748b;
  max-width: 420px;
}
</style>
