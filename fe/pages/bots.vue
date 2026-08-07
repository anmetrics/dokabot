<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Bots</h1>
        <p class="page-subtitle">
          Mỗi bot chạy một chiến lược trên một cặp giao dịch bằng một API key.
        </p>
      </div>
      <v-btn class="primary-btn" :disabled="!accounts.length" @click="openDialog">
        <v-icon start size="18">mdi-plus</v-icon>
        Tạo bot
      </v-btn>
    </div>

    <v-alert
      v-if="!accountsLoading && !accounts.length"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      Bạn cần thêm API key trước khi tạo bot.
      <NuxtLink to="/api-keys" class="link">Thêm API key →</NuxtLink>
    </v-alert>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-skeleton-loader v-if="loading" type="table" />

    <v-card v-else-if="!bots.length" class="empty-card" flat>
      <v-icon size="40" color="#64748b">mdi-robot-outline</v-icon>
      <p class="empty-title">Chưa có bot nào</p>
      <p class="empty-sub">Tạo bot đầu tiên — mặc định chạy ở chế độ paper.</p>
    </v-card>

    <div v-else class="bot-grid">
      <v-card v-for="bot in bots" :key="bot.id" class="bot-card" flat>
        <div class="bot-head">
          <div>
            <div class="bot-symbol">
              {{ bot.symbol }}
              <span class="bot-tf">{{ bot.timeframe }}</span>
            </div>
            <div class="bot-strategy">{{ strategyName(bot.strategyKey) }}</div>
          </div>
          <v-chip size="small" :color="statusColor(bot.status)" variant="tonal">
            {{ statusLabel(bot.status) }}
          </v-chip>
        </div>

        <div class="bot-meta">
          <v-chip v-if="bot.isPaper" size="x-small" class="paper-chip">Paper</v-chip>
          <v-chip v-else size="x-small" color="warning" variant="tonal">
            Tiền thật
          </v-chip>
          <span v-if="bot.maxLossUsd" class="meta-text">
            Giới hạn lỗ: {{ bot.maxLossUsd }} USD
          </span>
        </div>

        <p v-if="bot.lastError" class="bot-error">{{ bot.lastError }}</p>

        <div class="bot-actions">
          <v-btn
            v-if="bot.status !== 'RUNNING'"
            size="small"
            variant="tonal"
            color="success"
            :loading="busyId === bot.id"
            @click="run(bot, 'start')"
          >
            <v-icon start size="16">mdi-play</v-icon> Chạy
          </v-btn>
          <v-btn
            v-else
            size="small"
            variant="tonal"
            color="warning"
            :loading="busyId === bot.id"
            @click="run(bot, 'pause')"
          >
            <v-icon start size="16">mdi-pause</v-icon> Tạm dừng
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            :loading="busyId === bot.id"
            @click="run(bot, 'stop')"
          >
            Dừng
          </v-btn>
          <v-spacer />
          <v-btn size="small" variant="text" @click="viewOrders(bot)">
            <v-icon size="18">mdi-format-list-bulleted</v-icon>
          </v-btn>
          <v-btn size="small" variant="text" color="error" @click="remove(bot)">
            <v-icon size="18">mdi-delete-outline</v-icon>
          </v-btn>
        </div>
      </v-card>
    </div>

    <v-dialog v-model="dialog" max-width="520" persistent>
      <v-card class="dialog-card">
        <v-card-title class="dialog-title">Tạo bot</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" variant="tonal" class="mb-4">
            {{ formError }}
          </v-alert>

          <v-select
            v-model="form.exchangeAccountId"
            :items="accountOptions"
            item-title="title"
            item-value="value"
            label="API key"
            variant="outlined"
            density="comfortable"
          />
          <v-select
            v-model="form.strategyKey"
            :items="strategyOptions"
            item-title="title"
            item-value="value"
            label="Chiến lược"
            variant="outlined"
            density="comfortable"
            @update:model-value="onStrategyChange"
          />
          <p v-if="selectedStrategy" class="strategy-desc">
            {{ selectedStrategy.description }}
          </p>
          <v-text-field
            v-model="form.symbol"
            label="Cặp giao dịch"
            placeholder="BTCUSDT"
            variant="outlined"
            density="comfortable"
            @update:model-value="form.symbol = form.symbol.toUpperCase()"
          />
          <v-select
            v-model="form.timeframe"
            :items="timeframes"
            label="Khung thời gian"
            variant="outlined"
            density="comfortable"
          />
          <v-text-field
            v-model="form.maxLossUsd"
            label="Giới hạn lỗ (USD)"
            placeholder="100"
            variant="outlined"
            density="comfortable"
            hint="Bot tự dừng khi lỗ thực tế vượt mức này."
            persistent-hint
          />
          <!-- Settings form is generated from the strategy's own parameter spec,
               so adding a strategy on the server needs no front-end change. -->
          <div v-if="selectedStrategy" class="params-block">
            <div class="params-title">Thông số chiến lược</div>
            <template v-for="param in selectedStrategy.params" :key="param.key">
              <v-text-field
                v-if="param.type === 'number'"
                v-model.number="config[param.key]"
                :label="param.label + (param.unit ? ` (${param.unit})` : '')"
                type="number"
                :min="param.min"
                :max="param.max"
                :step="param.step ?? 1"
                :hint="param.help"
                persistent-hint
                variant="outlined"
                density="compact"
                class="mb-3"
              />
              <v-switch
                v-else-if="param.type === 'boolean'"
                v-model="config[param.key]"
                :label="param.label"
                :hint="param.help"
                persistent-hint
                color="primary"
                density="compact"
                class="mb-2"
              />
              <v-select
                v-else
                v-model="config[param.key]"
                :items="param.options"
                item-title="label"
                item-value="value"
                :label="param.label"
                :hint="param.help"
                persistent-hint
                variant="outlined"
                density="compact"
                class="mb-3"
              />
            </template>
          </div>

          <v-switch
            v-model="form.isPaper"
            color="primary"
            density="compact"
            hide-details
            class="mt-3"
            :label="form.isPaper ? 'Paper trading (không dùng tiền thật)' : 'Giao dịch bằng tiền thật'"
          />
          <v-alert v-if="!form.isPaper" type="warning" variant="tonal" class="mt-3">
            Bot sẽ đặt lệnh thật trên sàn. Hãy chạy paper trước khi bật chế độ này.
          </v-alert>
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-spacer />
          <v-btn variant="text" :disabled="submitting" @click="dialog = false">Huỷ</v-btn>
          <v-btn
            class="primary-btn"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            Tạo bot
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  useBots,
  useStrategies,
  type Bot,
  type BotStatus,
  type StrategyInfo,
} from "~/composables/useTrading";
import { useExchangeAccounts } from "~/composables/useExchangeAccounts";

const router = useRouter();
const { bots, loading, error, fetchBots, createBot, setStatus, deleteBot, readError } =
  useBots();
const {
  accounts,
  loading: accountsLoading,
  fetchAccounts,
} = useExchangeAccounts();

const { strategies, fetchStrategies, defaultsFor } = useStrategies();
const timeframes = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"];

const dialog = ref(false);
const submitting = ref(false);
const formError = ref<string | null>(null);
const busyId = ref<string | null>(null);

const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref<"success" | "error">("success");

/** Current strategy's settings, keyed by param. Rebuilt when the strategy changes. */
const config = ref<Record<string, any>>({});

const form = reactive({
  exchangeAccountId: "",
  strategyKey: "",
  symbol: "",
  timeframe: "5m",
  maxLossUsd: "",
  isPaper: true,
});

const strategyOptions = computed(() =>
  strategies.value.map((s) => ({ title: s.name, value: s.key })),
);

const selectedStrategy = computed<StrategyInfo | undefined>(() =>
  strategies.value.find((s) => s.key === form.strategyKey),
);

const onStrategyChange = () => {
  // Each strategy has its own parameters; carrying the previous ones over would
  // send settings the server will reject.
  config.value = selectedStrategy.value ? defaultsFor(selectedStrategy.value) : {};
};

const accountOptions = computed(() =>
  accounts.value
    .filter((a) => a.status === "ACTIVE")
    .map((a) => ({
      title: `${a.exchange} — ${a.label}${a.isTestnet ? " (testnet)" : ""}`,
      value: a.id,
    })),
);

const canSubmit = computed(
  () =>
    !!form.exchangeAccountId &&
    !!form.strategyKey &&
    /^[A-Z0-9]{5,20}$/.test(form.symbol),
);

const notify = (text: string, color: "success" | "error" = "success") => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const openDialog = () => {
  formError.value = null;
  form.exchangeAccountId = accountOptions.value[0]?.value ?? "";
  form.strategyKey = form.strategyKey || strategies.value[0]?.key || "";
  onStrategyChange();
  form.symbol = "";
  form.maxLossUsd = "";
  form.isPaper = true;
  dialog.value = true;
};

const onSubmit = async () => {
  submitting.value = true;
  formError.value = null;
  try {
    await createBot({
      exchangeAccountId: form.exchangeAccountId,
      strategyKey: form.strategyKey,
      symbol: form.symbol,
      timeframe: form.timeframe,
      isPaper: form.isPaper,
      maxLossUsd: form.maxLossUsd || undefined,
      config: config.value,
    });
    dialog.value = false;
    notify("Đã tạo bot.");
  } catch (err) {
    formError.value = await readError(err);
  } finally {
    submitting.value = false;
  }
};

const run = async (bot: Bot, action: "start" | "pause" | "stop") => {
  busyId.value = bot.id;
  try {
    await setStatus(bot.id, action);
  } catch (err) {
    notify(await readError(err), "error");
  } finally {
    busyId.value = null;
  }
};

const remove = async (bot: Bot) => {
  try {
    await deleteBot(bot.id);
    notify("Đã xoá bot.");
  } catch (err) {
    notify(await readError(err), "error");
  }
};

const viewOrders = (bot: Bot) => router.push(`/orders?botId=${bot.id}`);

const statusColor = (status: BotStatus) =>
  status === "RUNNING"
    ? "success"
    : status === "ERROR"
      ? "error"
      : status === "PAUSED"
        ? "warning"
        : "grey";

const statusLabel = (status: BotStatus) =>
  ({
    DRAFT: "Nháp",
    RUNNING: "Đang chạy",
    PAUSED: "Tạm dừng",
    STOPPED: "Đã dừng",
    ERROR: "Lỗi",
  })[status];

const strategyName = (key: string) =>
  strategies.value.find((s) => s.key === key)?.name ?? key;

onMounted(async () => {
  await Promise.all([fetchBots(), fetchAccounts(), fetchStrategies()]);
});
</script>

<style scoped>
.page {
  padding: 20px 24px 80px;
  color: #f1f5f9;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
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
}
.primary-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  color: #fff;
  font-weight: 600;
  text-transform: none;
}
.link {
  color: #a78bfa;
  margin-left: 6px;
}
.bot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
.bot-card,
.empty-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 12px;
  padding: 16px;
}
.empty-card {
  padding: 48px 24px;
  text-align: center;
}
.empty-title {
  margin-top: 12px;
  font-weight: 600;
}
.empty-sub {
  font-size: 0.85rem;
  color: #94a3b8;
}
.bot-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.bot-symbol {
  font-weight: 700;
  font-size: 1rem;
}
.bot-tf {
  margin-left: 6px;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}
.bot-strategy {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
}
.bot-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.paper-chip {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}
.meta-text {
  font-size: 11px;
  color: #94a3b8;
}
.bot-error {
  margin-top: 10px;
  font-size: 11px;
  color: #f87171;
}
.bot-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
}
.strategy-desc {
  margin: -8px 0 16px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}
.params-block {
  margin-top: 8px;
  padding: 14px;
  border: 1px solid rgba(167, 139, 250, 0.15);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.4);
}
.params-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-bottom: 12px;
}
.dialog-card {
  background: #1e293b;
  color: #f1f5f9;
  border-radius: 14px;
}
.dialog-title {
  font-size: 1.05rem;
  font-weight: 700;
  padding-top: 18px;
}
.dialog-actions {
  padding: 8px 16px 16px;
}
</style>
