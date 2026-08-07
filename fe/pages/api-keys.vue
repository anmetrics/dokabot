<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">API Keys</h1>
        <p class="page-subtitle">
          Kết nối tài khoản Binance / Bybit của bạn để bot có thể đặt lệnh.
        </p>
      </div>
      <v-btn class="primary-btn" @click="openDialog">
        <v-icon start size="18">mdi-plus</v-icon>
        Thêm API key
      </v-btn>
    </div>

    <!-- Safety notice: this is the single most security-sensitive screen. -->
    <v-alert type="info" variant="tonal" class="safety-note" border="start">
      <div class="safety-title">Trước khi thêm key</div>
      <ul class="safety-list">
        <li>
          <strong>Tắt quyền rút tiền (Withdraw)</strong> — hệ thống sẽ từ chối key có
          quyền này.
        </li>
        <li>
          Bật <strong>IP allowlist</strong> trên sàn và thêm các IP:
          <code>{{ egressIps }}</code>
        </li>
        <li>
          Secret chỉ hiển thị một lần trên sàn và không bao giờ được hiển thị lại ở đây.
        </li>
      </ul>
    </v-alert>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">
      {{ error }}
    </v-alert>

    <v-skeleton-loader v-if="loading" type="table" class="skeleton" />

    <v-card v-else-if="!accounts.length" class="empty-card" flat>
      <v-icon size="40" color="#64748b">mdi-key-outline</v-icon>
      <p class="empty-title">Chưa có API key nào</p>
      <p class="empty-sub">Thêm key đầu tiên để bắt đầu giao dịch tự động.</p>
    </v-card>

    <v-card v-else class="table-card" flat>
      <v-table density="comfortable" class="key-table">
        <thead>
          <tr>
            <th>Sàn</th>
            <th>Tên</th>
            <th>API Key</th>
            <th>Quyền</th>
            <th>Trạng thái</th>
            <th>Kiểm tra lần cuối</th>
            <th class="text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in accounts" :key="account.id">
            <td>
              <div class="exchange-cell">
                <span class="exchange-name">{{ account.exchange }}</span>
                <v-chip v-if="account.isTestnet" size="x-small" class="testnet-chip">
                  Testnet
                </v-chip>
              </div>
            </td>
            <td>{{ account.label }}</td>
            <td><code class="masked">{{ account.apiKeyMasked }}</code></td>
            <td>
              <v-chip
                v-if="account.permissions?.canTrade"
                size="x-small"
                class="perm-chip"
              >
                Trade
              </v-chip>
              <v-chip
                v-if="account.permissions?.canWithdraw"
                size="x-small"
                color="error"
                class="perm-chip"
              >
                Withdraw
              </v-chip>
            </td>
            <td>
              <v-chip size="small" :color="statusColor(account.status)" variant="tonal">
                {{ statusLabel(account.status) }}
              </v-chip>
              <div v-if="account.lastError" class="row-error">
                {{ account.lastError }}
              </div>
            </td>
            <td class="muted">{{ formatDate(account.lastVerifiedAt) }}</td>
            <td class="text-right">
              <v-btn
                size="small"
                variant="text"
                :loading="verifyingId === account.id"
                @click="onVerify(account)"
              >
                <v-icon size="18">mdi-refresh</v-icon>
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                color="error"
                @click="confirmRevoke(account)"
              >
                <v-icon size="18">mdi-delete-outline</v-icon>
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- ADD DIALOG -->
    <v-dialog v-model="dialog" max-width="520" persistent>
      <v-card class="dialog-card">
        <v-card-title class="dialog-title">Thêm API key</v-card-title>
        <v-card-text>
          <v-alert v-if="formError" type="error" variant="tonal" class="mb-4">
            {{ formError }}
          </v-alert>

          <v-select
            v-model="form.exchange"
            :items="exchanges"
            label="Sàn giao dịch"
            variant="outlined"
            density="comfortable"
          />
          <v-text-field
            v-model="form.label"
            label="Tên gợi nhớ"
            placeholder="VD: Tài khoản chính"
            variant="outlined"
            density="comfortable"
            :maxlength="64"
          />
          <v-text-field
            v-model="form.apiKey"
            label="API Key"
            variant="outlined"
            density="comfortable"
            autocomplete="off"
          />
          <v-text-field
            v-model="form.apiSecret"
            label="API Secret"
            type="password"
            variant="outlined"
            density="comfortable"
            autocomplete="new-password"
            hint="Secret được mã hoá trước khi lưu và không bao giờ được hiển thị lại."
            persistent-hint
          />
          <v-switch
            v-model="form.isTestnet"
            label="Dùng testnet"
            color="primary"
            density="compact"
            hide-details
            class="mt-2"
          />
        </v-card-text>
        <v-card-actions class="dialog-actions">
          <v-spacer />
          <v-btn variant="text" :disabled="submitting" @click="dialog = false">
            Huỷ
          </v-btn>
          <v-btn
            class="primary-btn"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            Kiểm tra &amp; lưu
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- REVOKE CONFIRM -->
    <v-dialog v-model="revokeDialog" max-width="440">
      <v-card class="dialog-card">
        <v-card-title class="dialog-title">Gỡ API key?</v-card-title>
        <v-card-text>
          Bot đang dùng key <strong>{{ pendingRevoke?.label }}</strong> sẽ dừng ngay lập
          tức. Thao tác này không thể hoàn tác — bạn sẽ phải nhập lại key mới.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="revokeDialog = false">Huỷ</v-btn>
          <v-btn color="error" :loading="revoking" @click="onRevoke">Gỡ key</v-btn>
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
import {
  useExchangeAccounts,
  type ExchangeAccount,
  type ExchangeAccountStatus,
} from "~/composables/useExchangeAccounts";

const {
  accounts,
  loading,
  error,
  fetchAccounts,
  createAccount,
  verifyAccount,
  revokeAccount,
  readError,
} = useExchangeAccounts();

const exchanges = ["BINANCE", "BYBIT"];
// Static egress IPs of the execution workers — users paste these into the
// exchange's IP allowlist. Sourced from infrastructure config, not user input.
const egressIps = "—  (liên hệ hỗ trợ để lấy dải IP hiện hành)";

const dialog = ref(false);
const submitting = ref(false);
const formError = ref<string | null>(null);
const verifyingId = ref<string | null>(null);

const revokeDialog = ref(false);
const revoking = ref(false);
const pendingRevoke = ref<ExchangeAccount | null>(null);

const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref<"success" | "error">("success");

const form = reactive({
  exchange: "BINANCE" as "BINANCE" | "BYBIT",
  label: "",
  apiKey: "",
  apiSecret: "",
  isTestnet: false,
});

const canSubmit = computed(
  () =>
    form.label.trim().length > 0 &&
    form.apiKey.trim().length >= 16 &&
    form.apiSecret.trim().length >= 16,
);

const notify = (text: string, color: "success" | "error" = "success") => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const openDialog = () => {
  formError.value = null;
  Object.assign(form, {
    exchange: "BINANCE",
    label: "",
    apiKey: "",
    apiSecret: "",
    isTestnet: false,
  });
  dialog.value = true;
};

const onSubmit = async () => {
  submitting.value = true;
  formError.value = null;
  try {
    await createAccount({
      exchange: form.exchange,
      label: form.label.trim(),
      apiKey: form.apiKey.trim(),
      apiSecret: form.apiSecret.trim(),
      isTestnet: form.isTestnet,
    });
    // Clear the secret from memory as soon as it has been handed to the server.
    form.apiKey = "";
    form.apiSecret = "";
    dialog.value = false;
    notify("Đã thêm API key thành công.");
  } catch (err) {
    formError.value = await readError(err);
  } finally {
    submitting.value = false;
  }
};

const onVerify = async (account: ExchangeAccount) => {
  verifyingId.value = account.id;
  try {
    const updated = await verifyAccount(account.id);
    notify(
      updated.status === "ACTIVE"
        ? "Key hoạt động bình thường."
        : `Key có vấn đề: ${updated.lastError ?? "không xác định"}`,
      updated.status === "ACTIVE" ? "success" : "error",
    );
  } catch (err) {
    notify(await readError(err), "error");
  } finally {
    verifyingId.value = null;
  }
};

const confirmRevoke = (account: ExchangeAccount) => {
  pendingRevoke.value = account;
  revokeDialog.value = true;
};

const onRevoke = async () => {
  if (!pendingRevoke.value) return;
  revoking.value = true;
  try {
    await revokeAccount(pendingRevoke.value.id);
    revokeDialog.value = false;
    notify("Đã gỡ API key.");
  } catch (err) {
    notify(await readError(err), "error");
  } finally {
    revoking.value = false;
  }
};

const statusColor = (status: ExchangeAccountStatus) =>
  status === "ACTIVE" ? "success" : status === "INVALID" ? "error" : "grey";

const statusLabel = (status: ExchangeAccountStatus) =>
  status === "ACTIVE" ? "Hoạt động" : status === "INVALID" ? "Lỗi" : "Đã gỡ";

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";

onMounted(fetchAccounts);
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
  letter-spacing: 0.01em;
  text-transform: none;
}

.safety-note {
  margin-bottom: 20px;
  border-radius: 12px;
}

.safety-title {
  font-weight: 700;
  margin-bottom: 6px;
}

.safety-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.85rem;
  line-height: 1.7;
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

.empty-sub {
  font-size: 0.85rem;
  color: #94a3b8;
}

.key-table {
  background: transparent;
}

.key-table :deep(th) {
  font-size: 11px !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b !important;
  white-space: nowrap;
}

.key-table :deep(td) {
  font-size: 13px;
  vertical-align: middle;
}

.exchange-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.exchange-name {
  font-weight: 600;
}

.testnet-chip {
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
}

.perm-chip {
  margin-right: 4px;
}

.masked {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #94a3b8;
}

.muted {
  color: #94a3b8;
}

.row-error {
  margin-top: 4px;
  font-size: 11px;
  color: #f87171;
  max-width: 260px;
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
