<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Bots</h1>
        <p class="page-subtitle">
          Mỗi bot chạy một chiến lược trên một cặp giao dịch bằng một API key.
        </p>
      </div>
      <v-btn
        class="primary-btn"
        :disabled="!accounts.length"
        @click="router.push('/bots/new')"
      >
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

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  useBots,
  useStrategies,
  type Bot,
  type BotStatus,
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

const busyId = ref<string | null>(null);

const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref<"success" | "error">("success");

const notify = (text: string, color: "success" | "error" = "success") => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
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
