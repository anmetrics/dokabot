<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Tổng quan</h1>
        <p class="page-subtitle">{{ email || "Đang tải…" }}</p>
      </div>
      <v-btn variant="tonal" :loading="loading" @click="reload">
        <v-icon start size="18">mdi-refresh</v-icon> Tải lại
      </v-btn>
    </div>

    <div class="stat-grid">
      <v-card v-for="stat in stats" :key="stat.label" class="stat-card" flat>
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-value" :class="stat.tone">{{ stat.value }}</div>
        <div class="stat-hint">{{ stat.hint }}</div>
      </v-card>
    </div>

    <!-- Nothing works without a connected exchange account, so that is the first
         thing a new user is pointed at. -->
    <v-alert
      v-if="!loading && !accounts.length"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Bắt đầu bằng cách kết nối API key sàn.
      <NuxtLink to="/api-keys" class="link">Thêm API key →</NuxtLink>
    </v-alert>
    <v-alert
      v-else-if="!loading && !bots.length"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Bạn đã có API key. Tạo bot đầu tiên — mặc định chạy paper, không dùng tiền thật.
      <NuxtLink to="/bots" class="link">Tạo bot →</NuxtLink>
    </v-alert>

    <div class="panel-grid">
      <v-card class="panel" flat>
        <div class="panel-head">
          <span class="panel-title">Bot đang chạy</span>
          <NuxtLink to="/bots" class="link">Tất cả →</NuxtLink>
        </div>
        <p v-if="!runningBots.length" class="empty">Chưa có bot nào đang chạy.</p>
        <div v-for="bot in runningBots" :key="bot.id" class="row">
          <div>
            <div class="row-main">{{ bot.symbol }} · {{ bot.timeframe }}</div>
            <div class="row-sub">{{ bot.strategyKey }}</div>
          </div>
          <v-chip size="x-small" :color="bot.isPaper ? undefined : 'warning'" variant="tonal">
            {{ bot.isPaper ? "Paper" : "Tiền thật" }}
          </v-chip>
        </div>
      </v-card>

      <v-card class="panel" flat>
        <div class="panel-head">
          <span class="panel-title">Lệnh gần đây</span>
          <NuxtLink to="/orders" class="link">Tất cả →</NuxtLink>
        </div>
        <p v-if="!recentOrders.length" class="empty">Chưa có lệnh nào.</p>
        <div v-for="order in recentOrders" :key="order.id" class="row">
          <div>
            <div class="row-main">
              <span :class="order.side === 'BUY' ? 'buy' : 'sell'">{{ order.side }}</span>
              {{ order.symbol }}
            </div>
            <div class="row-sub">{{ formatDate(order.createdAt) }}</div>
          </div>
          <v-chip size="x-small" :color="stateColor(order.state)" variant="tonal">
            {{ order.state }}
          </v-chip>
        </div>
      </v-card>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useApi } from "~/apis";
import { useBots, useOrders, type OrderState } from "~/composables/useTrading";
import { useExchangeAccounts } from "~/composables/useExchangeAccounts";

const api = useApi();
const { bots, fetchBots } = useBots();
const { orders, fetchOrders } = useOrders();
const { accounts, fetchAccounts } = useExchangeAccounts();

const email = ref("");
const loading = ref(true);

const runningBots = computed(() => bots.value.filter((b) => b.status === "RUNNING"));
const recentOrders = computed(() => orders.value.slice(0, 6));

const filledOrders = computed(() =>
  orders.value.filter((o) => o.state === "FILLED" || o.state === "PARTIALLY_FILLED"),
);

/** Realised PnL from closed fills: sell proceeds minus buy cost. */
const realisedPnl = computed(() =>
  filledOrders.value.reduce((total, order) => {
    const notional = Number(order.filledQuantity) * Number(order.averagePrice);
    return order.side === "SELL" ? total + notional : total - notional;
  }, 0),
);

const stats = computed(() => [
  {
    label: "API key",
    value: String(accounts.value.length),
    hint: accounts.value.filter((a) => a.status === "ACTIVE").length + " đang hoạt động",
    tone: "",
  },
  {
    label: "Bot",
    value: String(bots.value.length),
    hint: runningBots.value.length + " đang chạy",
    tone: "",
  },
  {
    label: "Lệnh",
    value: String(orders.value.length),
    hint: filledOrders.value.length + " đã khớp",
    tone: "",
  },
  {
    label: "Lãi/lỗ đã thực hiện",
    value: realisedPnl.value.toFixed(2) + " USD",
    hint: "Chỉ tính lệnh đã khớp",
    tone: realisedPnl.value >= 0 ? "up" : "down",
  },
]);

const reload = async () => {
  loading.value = true;
  try {
    await Promise.all([fetchBots(), fetchOrders(), fetchAccounts()]);
  } finally {
    loading.value = false;
  }
};

const stateColor = (state: OrderState) =>
  state === "FILLED"
    ? "success"
    : state === "REJECTED" || state === "EXPIRED"
      ? "error"
      : state === "CANCELED"
        ? "grey"
        : "info";

const formatDate = (value: string) => new Date(value).toLocaleString("vi-VN");

onMounted(async () => {
  const me = await api.get<{ email: string }>("auth/me").catch(() => null);
  email.value = me?.email ?? "";
  await reload();
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
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card,
.panel {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 12px;
  padding: 16px;
}
.stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 700;
}
.stat-value {
  margin-top: 6px;
  font-size: 1.5rem;
  font-weight: 700;
}
.stat-value.up {
  color: #4ade80;
}
.stat-value.down {
  color: #f87171;
}
.stat-hint {
  margin-top: 2px;
  font-size: 11px;
  color: #94a3b8;
}
.panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 14px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.panel-title {
  font-weight: 600;
  font-size: 0.95rem;
}
.link {
  color: #a78bfa;
  font-size: 12px;
  text-decoration: none;
}
.empty {
  font-size: 13px;
  color: #64748b;
  padding: 12px 0;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 0;
  border-top: 1px solid rgba(167, 139, 250, 0.08);
}
.row-main {
  font-size: 13px;
  font-weight: 600;
}
.row-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
.buy {
  color: #4ade80;
}
.sell {
  color: #f87171;
}
</style>
