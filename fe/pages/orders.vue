<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Lệnh</h1>
        <p class="page-subtitle">
          {{ botId ? "Lệnh của một bot" : "Toàn bộ lệnh gần đây" }}
        </p>
      </div>
      <v-btn variant="tonal" :loading="loading" @click="reload">
        <v-icon start size="18">mdi-refresh</v-icon> Tải lại
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-skeleton-loader v-if="loading" type="table" />

    <v-card v-else-if="!orders.length" class="empty-card" flat>
      <v-icon size="40" color="#64748b">mdi-format-list-bulleted</v-icon>
      <p class="empty-title">Chưa có lệnh nào</p>
    </v-card>

    <v-card v-else class="table-card" flat>
      <v-table density="comfortable" class="order-table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Cặp</th>
            <th>Chiều</th>
            <th class="text-right">Khối lượng</th>
            <th class="text-right">Đã khớp</th>
            <th class="text-right">Giá TB</th>
            <th>Trạng thái</th>
            <th class="text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.id">
            <td class="muted">{{ formatDate(order.createdAt) }}</td>
            <td>
              {{ order.symbol }}
              <v-chip v-if="order.isPaper" size="x-small" class="paper-chip">
                Paper
              </v-chip>
            </td>
            <td>
              <span :class="order.side === 'BUY' ? 'buy' : 'sell'">
                {{ order.side }}
              </span>
              <span class="type">{{ order.type }}</span>
            </td>
            <td class="text-right num">{{ trim(order.quantity) }}</td>
            <td class="text-right num">{{ trim(order.filledQuantity) }}</td>
            <td class="text-right num">{{ trim(order.averagePrice) }}</td>
            <td>
              <v-chip size="small" :color="stateColor(order.state)" variant="tonal">
                {{ order.state }}
              </v-chip>
              <div v-if="order.lastError" class="row-error">{{ order.lastError }}</div>
            </td>
            <td class="text-right">
              <v-btn
                size="small"
                variant="text"
                :loading="busyId === order.id"
                @click="onSync(order)"
              >
                <v-icon size="18">mdi-refresh</v-icon>
              </v-btn>
              <v-btn
                v-if="isLive(order.state)"
                size="small"
                variant="text"
                color="error"
                :loading="busyId === order.id"
                @click="onCancel(order)"
              >
                <v-icon size="18">mdi-close</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useOrders, type Order, type OrderState } from "~/composables/useTrading";

const route = useRoute();
const botId = computed(() => (route.query.botId as string) || undefined);

const { orders, loading, error, fetchOrders, syncOrder, cancelOrder, readError } =
  useOrders();

const busyId = ref<string | null>(null);
const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref<"success" | "error">("success");

const notify = (text: string, color: "success" | "error" = "success") => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const reload = () => fetchOrders(botId.value);

const isLive = (state: OrderState) =>
  ["PENDING", "NEW", "PARTIALLY_FILLED"].includes(state);

const onSync = async (order: Order) => {
  busyId.value = order.id;
  try {
    const updated = await syncOrder(order.id);
    notify(`Trạng thái hiện tại: ${updated.state}`);
  } catch (err) {
    notify(await readError(err), "error");
  } finally {
    busyId.value = null;
  }
};

const onCancel = async (order: Order) => {
  busyId.value = order.id;
  try {
    await cancelOrder(order.id);
    notify("Đã huỷ lệnh.");
  } catch (err) {
    notify(await readError(err), "error");
  } finally {
    busyId.value = null;
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

/** Trims the trailing zeros DECIMAL(38,18) brings back from the database. */
const trim = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? String(Number(n.toFixed(8))) : value;
};

const formatDate = (value: string) => new Date(value).toLocaleString("vi-VN");

onMounted(reload);
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
.table-card,
.empty-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 12px;
  overflow: hidden;
}
.empty-card {
  padding: 48px 24px;
  text-align: center;
}
.empty-title {
  margin-top: 12px;
  font-weight: 600;
}
.order-table {
  background: transparent;
}
.order-table :deep(th) {
  font-size: 11px !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b !important;
  white-space: nowrap;
}
.order-table :deep(td) {
  font-size: 13px;
  vertical-align: middle;
}
.num {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.buy {
  color: #4ade80;
  font-weight: 600;
}
.sell {
  color: #f87171;
  font-weight: 600;
}
.type {
  margin-left: 6px;
  font-size: 11px;
  color: #64748b;
}
.paper-chip {
  margin-left: 6px;
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}
.muted {
  color: #94a3b8;
  white-space: nowrap;
}
.row-error {
  margin-top: 4px;
  font-size: 11px;
  color: #f87171;
  max-width: 260px;
}
</style>
