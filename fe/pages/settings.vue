<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Cài đặt</h1>
        <p class="page-subtitle">Mặc định cho bot mới, quy tắc giá, bảo mật và thông báo.</p>
      </div>
      <div class="head-actions">
        <v-chip
          v-if="settings?.tradingPaused"
          color="warning"
          variant="tonal"
          size="small"
        >
          <v-icon start size="14">mdi-pause</v-icon> Đang tạm dừng giao dịch
        </v-chip>
        <v-btn class="primary-btn" :loading="saving" :disabled="!dirty" @click="onSave">
          Lưu thay đổi
        </v-btn>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-tabs v-model="tab" class="tabs" density="comfortable">
      <v-tab value="trading">Giao dịch</v-tab>
      <v-tab value="symbols">Quy tắc theo cặp</v-tab>
      <v-tab value="security">Bảo mật</v-tab>
      <v-tab value="notifications">Thông báo</v-tab>
      <v-tab value="activity">Hoạt động</v-tab>
    </v-tabs>

    <v-skeleton-loader v-if="loading || !draft" type="article" class="mt-4" />

    <v-window v-else v-model="tab" class="window">
      <!-- GIAO DỊCH -->
      <v-window-item value="trading">
        <div class="cards">
          <section class="card">
            <h2 class="card-title">Mặc định cho bot mới</h2>
            <p class="card-sub">
              Áp dụng khi tạo bot mà không nhập giá trị riêng. Bot đang chạy không bị ảnh hưởng.
            </p>
            <div class="grid-3">
              <v-text-field
                v-model.number="draft.defaultOrderSizeUsd"
                label="Giá trị mỗi lệnh"
                type="number"
                suffix="USD"
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model.number="draft.defaultTakeProfitPercent"
                label="Chốt lời"
                type="number"
                step="0.1"
                suffix="%"
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model.number="draft.defaultStopLossPercent"
                label="Cắt lỗ"
                type="number"
                step="0.1"
                suffix="%"
                variant="outlined"
                density="comfortable"
              />
            </div>
          </section>

          <section class="card">
            <h2 class="card-title">Giới hạn tài khoản</h2>
            <p class="card-sub">
              Trần cứng áp cho toàn bộ bot của bạn, độc lập với cấu hình từng bot.
            </p>
            <div class="grid-3">
              <v-text-field
                v-model.number="draft.maxConcurrentBots"
                label="Số bot tối đa"
                type="number"
                min="1"
                max="200"
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model.number="draft.defaultMaxLossUsd"
                label="Ngưỡng dừng bot mặc định"
                type="number"
                suffix="USD"
                hint="Bot tự dừng khi lỗ thực tế vượt mức này."
                persistent-hint
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model.number="draft.maxDailyLossUsd"
                label="Lỗ tối đa mỗi ngày"
                type="number"
                suffix="USD"
                variant="outlined"
                density="comfortable"
              />
            </div>

            <div class="pause-row">
              <div>
                <div class="pause-title">Tạm dừng toàn bộ giao dịch</div>
                <p class="pause-sub">
                  Bot vẫn giữ nguyên cấu hình nhưng không đặt lệnh mới. Vị thế đang mở không bị bán.
                </p>
              </div>
              <v-switch
                v-model="draft.tradingPaused"
                color="warning"
                density="compact"
                hide-details
              />
            </div>
          </section>
        </div>
      </v-window-item>

      <!-- QUY TẮC THEO CẶP -->
      <v-window-item value="symbols">
        <section class="card">
          <div class="card-head-row">
            <div>
              <h2 class="card-title">Quy tắc giá theo cặp</h2>
              <p class="card-sub">
                Trần và sàn giá áp cho mọi bot giao dịch cặp đó. Để 0 nghĩa là không giới hạn.
                Thêm bao nhiêu cặp tuỳ ý.
              </p>
            </div>
            <v-btn size="small" variant="tonal" @click="addRule">
              <v-icon start size="16">mdi-plus</v-icon> Thêm cặp
            </v-btn>
          </div>

          <p v-if="!draft.symbolRules.length" class="empty">
            Chưa có quy tắc nào. Bot sẽ chỉ tuân theo khoảng giá cấu hình riêng của nó.
          </p>

          <div v-else class="rules">
            <div class="rules-head">
              <span>Cặp</span>
              <span>Mua từ</span>
              <span>Mua đến</span>
              <span>Bán từ</span>
              <span>Bán đến</span>
              <span>Bật</span>
              <span></span>
            </div>
            <div v-for="(rule, index) in draft.symbolRules" :key="index" class="rule-row">
              <v-combobox
                v-model="rule.symbol"
                :items="commonSymbols"
                density="compact"
                variant="outlined"
                hide-details
                placeholder="BTCUSDT"
                @update:model-value="rule.symbol = String(rule.symbol || '').toUpperCase()"
              />
              <v-text-field
                v-model.number="rule.minBuyPrice"
                type="number"
                min="0"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-text-field
                v-model.number="rule.maxBuyPrice"
                type="number"
                min="0"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-text-field
                v-model.number="rule.minSellPrice"
                type="number"
                min="0"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-text-field
                v-model.number="rule.maxSellPrice"
                type="number"
                min="0"
                density="compact"
                variant="outlined"
                hide-details
              />
              <v-switch v-model="rule.enabled" color="primary" density="compact" hide-details />
              <v-btn icon size="x-small" variant="text" @click="draft.symbolRules.splice(index, 1)">
                <v-icon size="18">mdi-close</v-icon>
              </v-btn>
            </div>
          </div>

          <v-alert type="info" variant="tonal" density="compact" class="mt-4">
            Lệnh cắt lỗ luôn được thực hiện bất kể quy tắc giá bán — nếu không, một sàn giá
            sẽ khiến vị thế không bao giờ đóng được.
          </v-alert>
        </section>
      </v-window-item>

      <!-- BẢO MẬT -->
      <v-window-item value="security">
        <div class="cards">
          <section class="card">
            <h2 class="card-title">Đổi mật khẩu</h2>
            <p class="card-sub">
              Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác — kể cả thiết bị bạn không kiểm soát.
            </p>
            <v-alert v-if="passwordError" type="error" variant="tonal" class="mb-3">
              {{ passwordError }}
            </v-alert>
            <div class="grid-2">
              <v-text-field
                v-model="password.current"
                label="Mật khẩu hiện tại"
                type="password"
                autocomplete="current-password"
                variant="outlined"
                density="comfortable"
              />
              <v-text-field
                v-model="password.next"
                label="Mật khẩu mới"
                type="password"
                autocomplete="new-password"
                hint="Tối thiểu 12 ký tự, có chữ hoa, chữ thường và số"
                persistent-hint
                variant="outlined"
                density="comfortable"
              />
            </div>
            <v-btn
              class="primary-btn mt-3"
              :loading="changingPassword"
              :disabled="!password.current || password.next.length < 12"
              @click="onChangePassword"
            >
              Đổi mật khẩu
            </v-btn>
          </section>

          <section class="card">
            <h2 class="card-title">Phiên đăng nhập</h2>
            <p class="card-sub">Thiết bị nào không phải của bạn thì kết thúc phiên đó.</p>
            <div v-for="session in sessions" :key="session.id" class="session">
              <div>
                <div class="session-agent">{{ shortAgent(session.userAgent) }}</div>
                <div class="session-meta">
                  {{ session.ip || "—" }} · {{ formatDate(session.createdAt) }}
                </div>
              </div>
              <v-btn size="small" variant="text" color="error" @click="onRevoke(session.id)">
                Kết thúc
              </v-btn>
            </div>
          </section>
        </div>
      </v-window-item>

      <!-- THÔNG BÁO -->
      <v-window-item value="notifications">
        <section class="card">
          <h2 class="card-title">Thông báo</h2>
          <p class="card-sub">Nhận cảnh báo khi có việc đáng chú ý xảy ra với bot.</p>
          <v-switch
            v-model="draft.notifyOnFill"
            label="Khi lệnh khớp"
            color="primary"
            density="compact"
            hide-details
          />
          <v-switch
            v-model="draft.notifyOnError"
            label="Khi bot gặp lỗi"
            color="primary"
            density="compact"
            hide-details
          />
          <v-switch
            v-model="draft.notifyOnBotStopped"
            label="Khi bot bị dừng tự động (chạm ngưỡng lỗ)"
            color="primary"
            density="compact"
            hide-details
          />
          <v-text-field
            v-model="draft.telegramChatId"
            label="Telegram Chat ID"
            variant="outlined"
            density="comfortable"
            class="mt-4"
            hint="Nhắn /start cho bot Telegram để lấy Chat ID của bạn."
            persistent-hint
          />
          <v-alert type="warning" variant="tonal" density="compact" class="mt-4">
            Kênh gửi thông báo chưa được nối — tuỳ chọn ở đây được lưu nhưng chưa có tin nào
            được gửi đi.
          </v-alert>
        </section>
      </v-window-item>

      <!-- HOẠT ĐỘNG -->
      <v-window-item value="activity">
        <section class="card">
          <h2 class="card-title">Nhật ký hoạt động</h2>
          <p class="card-sub">Mọi thao tác liên quan tới bảo mật và tiền bạc trên tài khoản.</p>
          <v-table density="compact" class="activity-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Hành động</th>
                <th>IP</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in activity" :key="entry.id">
                <td class="muted">{{ formatDate(entry.createdAt) }}</td>
                <td>{{ entry.action }}</td>
                <td class="muted">{{ entry.ip || "—" }}</td>
                <td>
                  <v-chip size="x-small" :color="entry.success ? 'success' : 'error'" variant="tonal">
                    {{ entry.success ? "OK" : "Thất bại" }}
                  </v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </section>
      </v-window-item>
    </v-window>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="4000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  emptyRule,
  useSettings,
  type UserSettings,
} from "~/composables/useSettings";

const {
  settings,
  sessions,
  activity,
  loading,
  load,
  save,
  changePassword,
  revokeSession,
  readError,
} = useSettings();

const commonSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "PAXGUSDT",
];

const tab = ref("trading");
const saving = ref(false);
const error = ref<string | null>(null);
const changingPassword = ref(false);
const passwordError = ref<string | null>(null);

const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref<"success" | "error">("success");

const password = reactive({ current: "", next: "" });

/**
 * Edits happen on a local copy so nothing reaches the server until Save.
 * Numbers arrive as strings from DECIMAL columns, so they are coerced once here
 * rather than at every input.
 */
const draft = ref<UserSettings | null>(null);

const toDraft = (value: UserSettings): UserSettings => ({
  ...value,
  defaultOrderSizeUsd: Number(value.defaultOrderSizeUsd) as unknown as string,
  defaultTakeProfitPercent: Number(value.defaultTakeProfitPercent) as unknown as string,
  defaultStopLossPercent: Number(value.defaultStopLossPercent) as unknown as string,
  defaultMaxLossUsd: (value.defaultMaxLossUsd === null
    ? null
    : Number(value.defaultMaxLossUsd)) as unknown as string,
  maxDailyLossUsd: (value.maxDailyLossUsd === null
    ? null
    : Number(value.maxDailyLossUsd)) as unknown as string,
  symbolRules: JSON.parse(JSON.stringify(value.symbolRules ?? [])),
});

watch(settings, (value) => {
  if (value) draft.value = toDraft(value);
});

const dirty = computed(
  () =>
    !!draft.value &&
    !!settings.value &&
    JSON.stringify(draft.value) !== JSON.stringify(toDraft(settings.value)),
);

const notify = (text: string, color: "success" | "error" = "success") => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const addRule = () => draft.value?.symbolRules.push(emptyRule());

const onSave = async () => {
  if (!draft.value) return;
  saving.value = true;
  error.value = null;
  try {
    await save({
      defaultOrderSizeUsd: Number(draft.value.defaultOrderSizeUsd),
      defaultTakeProfitPercent: Number(draft.value.defaultTakeProfitPercent),
      defaultStopLossPercent: Number(draft.value.defaultStopLossPercent),
      defaultMaxLossUsd: draft.value.defaultMaxLossUsd
        ? Number(draft.value.defaultMaxLossUsd)
        : undefined,
      maxDailyLossUsd: draft.value.maxDailyLossUsd
        ? Number(draft.value.maxDailyLossUsd)
        : undefined,
      maxConcurrentBots: Number(draft.value.maxConcurrentBots),
      tradingPaused: draft.value.tradingPaused,
      symbolRules: draft.value.symbolRules.filter((r) => r.symbol),
      notifyOnFill: draft.value.notifyOnFill,
      notifyOnError: draft.value.notifyOnError,
      notifyOnBotStopped: draft.value.notifyOnBotStopped,
      telegramChatId: draft.value.telegramChatId || undefined,
    } as any);
    notify("Đã lưu cài đặt.");
  } catch (err) {
    error.value = await readError(err);
  } finally {
    saving.value = false;
  }
};

const onChangePassword = async () => {
  changingPassword.value = true;
  passwordError.value = null;
  try {
    await changePassword(password.current, password.next);
    password.current = "";
    password.next = "";
    notify("Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.");
    await load();
  } catch (err) {
    passwordError.value = await readError(err);
  } finally {
    changingPassword.value = false;
  }
};

const onRevoke = async (id: string) => {
  try {
    await revokeSession(id);
    notify("Đã kết thúc phiên.");
  } catch (err) {
    notify(await readError(err), "error");
  }
};

/** Browser and OS are all a user needs to recognise their own device. */
const shortAgent = (agent: string | null) => {
  if (!agent) return "Thiết bị không xác định";
  const browser =
    /(Edg|Chrome|Firefox|Safari)\/[\d.]+/.exec(agent)?.[1] ?? "Trình duyệt";
  const os =
    /\((Windows|Macintosh|Linux|iPhone|Android)[^)]*\)/.exec(agent)?.[1] ?? "";
  return [browser, os].filter(Boolean).join(" · ");
};

const formatDate = (value: string) => new Date(value).toLocaleString("vi-VN");

onMounted(load);
</script>

<style scoped>
.page {
  padding: 20px 24px 80px;
  color: #f1f5f9;
  max-width: 1200px;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.page-subtitle {
  margin-top: 4px;
  font-size: 0.85rem;
  color: #94a3b8;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.primary-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  color: #fff;
  font-weight: 600;
  text-transform: none;
}
.tabs {
  border-bottom: 1px solid rgba(167, 139, 250, 0.12);
}
.window {
  margin-top: 16px;
  background: transparent;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 12px;
  padding: 18px;
}
.card-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.card-title {
  font-size: 1rem;
  font-weight: 700;
}
.card-sub {
  margin-top: 3px;
  margin-bottom: 14px;
  font-size: 12px;
  color: #94a3b8;
  max-width: 620px;
  line-height: 1.5;
}
.grid-2,
.grid-3 {
  display: grid;
  gap: 14px;
}
.grid-2 {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}
.grid-3 {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
.pause-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(167, 139, 250, 0.1);
}
.pause-title {
  font-weight: 600;
  font-size: 13px;
}
.pause-sub {
  margin-top: 2px;
  font-size: 11px;
  color: #94a3b8;
  max-width: 520px;
}
.empty {
  font-size: 13px;
  color: #64748b;
  padding: 16px 0;
}
.rules {
  margin-top: 6px;
  overflow-x: auto;
}
.rules-head,
.rule-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr 62px 40px;
  gap: 8px;
  align-items: center;
  min-width: 760px;
}
.rules-head {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 700;
  padding-bottom: 6px;
}
.rule-row {
  padding: 6px 0;
  border-top: 1px solid rgba(167, 139, 250, 0.08);
}
.session {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid rgba(167, 139, 250, 0.08);
}
.session-agent {
  font-size: 13px;
  font-weight: 600;
}
.session-meta {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}
.activity-table {
  background: transparent;
}
.activity-table :deep(th) {
  font-size: 10px !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b !important;
}
.activity-table :deep(td) {
  font-size: 12px;
}
.muted {
  color: #94a3b8;
  white-space: nowrap;
}
</style>
