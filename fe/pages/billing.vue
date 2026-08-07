<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Gói cước</h1>
        <p class="page-subtitle">
          Thanh toán bằng USDT trên BNB Smart Chain. Tự động gia hạn hàng tháng, huỷ lúc nào cũng được.
        </p>
      </div>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <v-skeleton-loader v-if="loading || !plan" type="article" />

    <template v-else>
      <!-- ĐANG DÙNG PRO -->
      <v-card v-if="subscription?.isPro" class="active-card" flat>
        <div class="active-head">
          <div>
            <div class="active-title">
              <span class="dot" /> Đang dùng gói Pro
            </div>
            <div class="active-sub">
              Chu kỳ hiện tại đến {{ formatDate(subscription.currentPeriodEnd) }}
              <template v-if="subscription.status === 'GRACE'">
                · đang trong thời gian ân hạn
              </template>
              <template v-else-if="subscription.status === 'CANCELLED'">
                · đã huỷ gia hạn, dùng hết chu kỳ này
              </template>
            </div>
          </div>
          <div class="active-price">{{ proTier?.priceUsd }} USDT / tháng</div>
        </div>

        <v-alert
          v-if="subscription.status === 'GRACE'"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3"
        >
          Chưa thu được phí kỳ này — thường là do ví hết USDT hoặc hết hạn mức approve.
          Bạn còn {{ plan.graceDays }} ngày ân hạn.
        </v-alert>

        <div class="active-actions">
          <v-btn
            variant="tonal"
            color="error"
            :loading="busy"
            @click="onUnsubscribe"
          >
            Huỷ gia hạn
          </v-btn>
          <span class="note">
            Huỷ sẽ chặn lần trừ tiền tiếp theo. Bạn vẫn dùng Pro tới hết chu kỳ đã trả.
          </span>
        </div>
      </v-card>

      <!-- CHỌN GÓI -->
      <div v-else class="tier-grid">
        <v-card v-for="tier in plan.tiers" :key="tier.tier" class="tier-card" :class="{ pro: tier.tier === 'PRO' }" flat>
          <div class="tier-name">{{ tier.tier === "PRO" ? "Pro" : "Miễn phí" }}</div>
          <div class="tier-price">
            <span class="amount">{{ tier.priceUsd }}</span>
            <span class="unit">USDT / tháng</span>
          </div>
          <ul class="tier-features">
            <li v-for="feature in tier.features" :key="feature">
              <v-icon size="14" :color="tier.tier === 'PRO' ? '#a78bfa' : '#64748b'">
                mdi-check
              </v-icon>
              {{ feature }}
            </li>
          </ul>
          <div v-if="tier.tier === 'FREE'" class="tier-current">Gói hiện tại</div>
        </v-card>
      </div>

      <!-- CÁC BƯỚC THANH TOÁN -->
      <v-card v-if="!subscription?.isPro" class="steps-card" flat>
        <h2 class="steps-title">Ba bước để bật Pro</h2>
        <p class="steps-sub">
          Không cần nạp tiền vào hệ thống. Bạn cấp quyền cho hợp đồng trừ đúng
          {{ proTier?.priceUsd }} USDT mỗi 30 ngày, tiền vẫn nằm trong ví bạn.
        </p>

        <v-alert v-if="!plan.contractAddress" type="warning" variant="tonal" class="mb-4">
          Hợp đồng thanh toán chưa được cấu hình trên máy chủ này
          (<code>BILLING_CONTRACT_ADDRESS</code>). Các bước dưới chỉ để xem trước.
        </v-alert>

        <!-- 1 -->
        <div class="step" :class="{ done: !!verifiedWallet }">
          <span class="step-num">1</span>
          <div class="step-body">
            <div class="step-title">Kết nối và xác minh ví</div>
            <p class="step-sub">
              Bạn ký một tin nhắn để chứng minh sở hữu ví. Ký không tốn gas và không
              cho phép chuyển tiền.
            </p>
            <div v-if="verifiedWallet" class="wallet-ok">
              <v-icon size="16" color="#4ade80">mdi-check-circle</v-icon>
              {{ shortAddress(verifiedWallet) }}
            </div>
            <v-btn
              v-else
              class="primary-btn"
              size="small"
              :loading="busy"
              @click="onConnectAndVerify"
            >
              Kết nối ví
            </v-btn>
          </div>
        </div>

        <!-- 2 -->
        <div class="step" :class="{ disabled: !verifiedWallet }">
          <span class="step-num">2</span>
          <div class="step-body">
            <div class="step-title">Cấp hạn mức USDT</div>
            <p class="step-sub">
              Một giao dịch <code>approve</code> trên token USDT. Hạn mức mặc định đủ
              cho 24 tháng — bạn thu hồi bất cứ lúc nào từ ví.
            </p>
            <v-btn
              class="primary-btn"
              size="small"
              :disabled="!verifiedWallet || !plan.contractAddress"
              :loading="busy"
              @click="onApprove"
            >
              Approve {{ approveMonths }} tháng
            </v-btn>
          </div>
        </div>

        <!-- 3 -->
        <div class="step" :class="{ disabled: !verifiedWallet }">
          <span class="step-num">3</span>
          <div class="step-body">
            <div class="step-title">Bật gia hạn tự động</div>
            <p class="step-sub">
              Gọi <code>subscribe()</code> trên hợp đồng. Sau khi lần trừ đầu tiên được
              xác nhận trên chuỗi, gói Pro sẽ bật tự động.
            </p>
            <v-btn
              class="primary-btn"
              size="small"
              :disabled="!verifiedWallet || !plan.contractAddress"
              :loading="busy"
              @click="onSubscribe"
            >
              Bật gia hạn tự động
            </v-btn>
          </div>
        </div>

        <v-alert type="info" variant="tonal" density="compact" class="mt-4">
          Hệ thống nghe sự kiện từ hợp đồng và chỉ ghi nhận sau {{ CONFIRMATIONS }} block xác nhận,
          nên có thể mất khoảng một phút sau khi giao dịch lên chuỗi.
        </v-alert>
      </v-card>

      <!-- LỊCH SỬ -->
      <v-card class="history-card" flat>
        <h2 class="steps-title">Lịch sử thanh toán</h2>
        <p v-if="!payments.length" class="empty">Chưa có giao dịch nào.</p>
        <v-table v-else density="compact" class="history-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Số tiền</th>
              <th>Ví</th>
              <th>Giao dịch</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in payments" :key="payment.id">
              <td class="muted">{{ formatDate(payment.confirmedAt) }}</td>
              <td>{{ Number(payment.amountUsd).toFixed(2) }} USDT</td>
              <td class="muted">{{ shortAddress(payment.walletAddress) }}</td>
              <td>
                <a :href="explorerUrl(payment.txHash)" target="_blank" rel="noopener" class="link">
                  {{ shortAddress(payment.txHash) }}
                </a>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </template>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="5000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useBilling } from "~/composables/useBilling";
import {
  encodeApprove,
  encodeSubscribe,
  encodeUnsubscribe,
  useWallet,
} from "~/composables/useWallet";

const { plan, subscription, payments, wallets, loading, load, challenge, verify, readError } =
  useBilling();
const wallet = useWallet();

/** Matches the backend's confirmation depth, shown so the wait is not a mystery. */
const CONFIRMATIONS = 15;
const approveMonths = 24;

const busy = ref(false);
const error = ref<string | null>(null);
const snackbar = ref(false);
const snackbarText = ref("");
const snackbarColor = ref<"success" | "error">("success");

const proTier = computed(() => plan.value?.tiers.find((t) => t.tier === "PRO"));
const verifiedWallet = computed(
  () => wallets.value.find((w) => w.verifiedAt)?.address ?? null,
);

const notify = (text: string, color: "success" | "error" = "success") => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const run = async (action: () => Promise<void>) => {
  busy.value = true;
  error.value = null;
  try {
    await action();
  } catch (err: any) {
    // A user rejecting a wallet prompt is a normal outcome, not an error to shout about.
    if (err?.code === 4001) {
      notify("Bạn đã từ chối giao dịch trong ví.", "error");
    } else {
      error.value = err?.response ? await readError(err) : (err?.message ?? String(err));
    }
  } finally {
    busy.value = false;
  }
};

const onConnectAndVerify = () =>
  run(async () => {
    if (!wallet.isAvailable()) {
      throw new Error(
        "Không tìm thấy ví. Cài MetaMask hoặc mở trang này trong trình duyệt của ví.",
      );
    }
    const address = await wallet.connect();
    await wallet.switchChain(plan.value!.chainId);

    const { message } = await challenge(address, plan.value!.chainId);
    const signature = await wallet.signMessage(message);
    await verify(address, signature);
    await load();
    notify("Đã xác minh ví.");
  });

const onApprove = () =>
  run(async () => {
    const token = plan.value!.token;
    const amount =
      BigInt(Math.round(proTier.value!.priceUsd * approveMonths)) *
      10n ** BigInt(token.decimals);

    const hash = await wallet.sendTransaction(
      token.address,
      encodeApprove(plan.value!.contractAddress!, amount),
    );
    notify(`Đã gửi giao dịch approve: ${shortAddress(hash)}`);
  });

const onSubscribe = () =>
  run(async () => {
    const hash = await wallet.sendTransaction(
      plan.value!.contractAddress!,
      encodeSubscribe(),
    );
    notify(`Đã bật gia hạn tự động: ${shortAddress(hash)}`);
  });

const onUnsubscribe = () =>
  run(async () => {
    if (!wallet.address.value) await wallet.connect();
    const hash = await wallet.sendTransaction(
      plan.value!.contractAddress!,
      encodeUnsubscribe(),
    );
    notify(`Đã gửi yêu cầu huỷ: ${shortAddress(hash)}`);
  });

const shortAddress = (value: string) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";

const explorerUrl = (txHash: string) =>
  `${plan.value?.chainId === 97 ? "https://testnet.bscscan.com" : "https://bscscan.com"}/tx/${txHash}`;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";

onMounted(load);
</script>

<style scoped>
.page {
  padding: 20px 24px 80px;
  color: #f1f5f9;
  max-width: 1100px;
}
.page-head {
  margin-bottom: 20px;
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
  max-width: 640px;
}
.tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-bottom: 16px;
}
.tier-card,
.steps-card,
.history-card,
.active-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 12px;
  padding: 20px;
}
.tier-card.pro {
  border-color: #a78bfa;
  background: rgba(124, 58, 237, 0.1);
}
.tier-name {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: #64748b;
}
.tier-price {
  margin-top: 8px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.amount {
  font-size: 2rem;
  font-weight: 700;
}
.unit {
  font-size: 12px;
  color: #94a3b8;
}
.tier-features {
  margin-top: 14px;
  padding: 0;
  list-style: none;
}
.tier-features li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 13px;
  color: #cbd5e1;
}
.tier-current {
  margin-top: 14px;
  font-size: 11px;
  color: #64748b;
}
.steps-card,
.history-card {
  margin-top: 16px;
}
.steps-title {
  font-size: 1rem;
  font-weight: 700;
}
.steps-sub {
  margin-top: 4px;
  margin-bottom: 18px;
  font-size: 12px;
  color: #94a3b8;
  max-width: 620px;
  line-height: 1.6;
}
.step {
  display: flex;
  gap: 14px;
  padding: 14px 0;
  border-top: 1px solid rgba(167, 139, 250, 0.08);
}
.step.disabled {
  opacity: 0.45;
}
.step-num {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}
.step.done .step-num {
  background: #4ade80;
  color: #0f172a;
}
.step-title {
  font-size: 14px;
  font-weight: 600;
}
.step-sub {
  margin: 4px 0 10px;
  font-size: 12px;
  color: #94a3b8;
  max-width: 560px;
  line-height: 1.6;
}
.step-sub code,
.steps-sub code {
  background: rgba(167, 139, 250, 0.12);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
}
.wallet-ok {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #4ade80;
}
.primary-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  color: #fff;
  font-weight: 600;
  text-transform: none;
}
.active-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.active-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 1.05rem;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
}
.active-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}
.active-price {
  font-size: 1.1rem;
  font-weight: 700;
  color: #a78bfa;
}
.active-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 18px;
}
.note {
  font-size: 11px;
  color: #64748b;
  max-width: 420px;
}
.empty {
  font-size: 13px;
  color: #64748b;
  padding: 12px 0;
}
.history-table {
  background: transparent;
}
.history-table :deep(th) {
  font-size: 10px !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b !important;
}
.history-table :deep(td) {
  font-size: 12px;
}
.muted {
  color: #94a3b8;
  white-space: nowrap;
}
.link {
  color: #a78bfa;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
