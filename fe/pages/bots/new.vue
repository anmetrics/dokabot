<template>
  <v-container fluid class="page">
    <div class="page-head">
      <div>
        <h1 class="page-title">Tạo bot mới</h1>
        <p class="page-subtitle">
          Cấu hình đầy đủ chiến lược, chỉ báo, khoảng giá và quản trị rủi ro.
        </p>
      </div>
      <v-btn variant="text" @click="router.push('/bots')">
        <v-icon start size="18">mdi-arrow-left</v-icon> Quay lại
      </v-btn>
    </div>

    <v-alert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>

    <div class="layout">
      <div class="main">
        <section class="card">
          <div class="card-head">
            <span class="step">1</span>
            <div>
              <h2 class="card-title">Thị trường & tài khoản</h2>
              <p class="card-sub">Bot chạy trên một cặp, bằng một API key.</p>
            </div>
          </div>
          <div class="grid-2">
            <v-select
              v-model="form.exchangeAccountId"
              :items="accountOptions"
              item-title="title"
              item-value="value"
              label="API key sàn"
              variant="outlined"
              density="comfortable"
            />
            <v-combobox
              v-model="form.symbol"
              :items="commonSymbols"
              label="Cặp giao dịch"
              placeholder="BTCUSDT"
              variant="outlined"
              density="comfortable"
            />
            <v-select
              v-model="form.timeframe"
              :items="timeframes"
              label="Khung thời gian"
              variant="outlined"
              density="comfortable"
              hint="Khung càng ngắn càng nhiều lệnh và nhiều nhiễu."
              persistent-hint
            />
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <span class="step">2</span>
            <div>
              <h2 class="card-title">Chiến lược</h2>
              <p class="card-sub">Chọn mẫu có sẵn, hoặc tự thiết kế điều kiện.</p>
            </div>
          </div>
          <div class="strategy-grid">
            <button
              v-for="strategy in strategies"
              :key="strategy.key"
              class="strategy-chip"
              :class="{ active: form.strategyKey === strategy.key }"
              @click="selectStrategy(strategy.key)"
            >
              <span class="strategy-name">{{ strategy.name }}</span>
              <span class="strategy-cat">{{ categoryLabel(strategy.category) }}</span>
            </button>
          </div>
          <p v-if="selectedStrategy" class="strategy-desc">
            {{ selectedStrategy.description }}
          </p>
        </section>

        <section v-if="selectedStrategy" class="card">
          <div class="card-head">
            <span class="step">3</span>
            <div>
              <h2 class="card-title">Điều kiện vào lệnh</h2>
              <p class="card-sub">
                {{
                  ruleParams.length
                    ? "Ghép chỉ báo theo ý bạn. Điều kiện bán được xét trước điều kiện mua."
                    : "Tinh chỉnh tham số của chiến lược đã chọn."
                }}
              </p>
            </div>
          </div>

          <div v-for="param in ruleParams" :key="param.key" class="rule-block">
            <div class="rule-label">
              {{ param.label }}
              <span v-if="param.help" class="rule-help">{{ param.help }}</span>
            </div>
            <RuleBuilder
              :model-value="(config[param.key] as any)"
              :indicators="indicators"
              :operators="operators"
              @update:model-value="(v) => (config[param.key] = v)"
            />
          </div>

          <div v-if="tuningParams.length" class="grid-3">
            <template v-for="param in tuningParams" :key="param.key">
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
                density="comfortable"
              />
              <v-switch
                v-else-if="param.type === 'boolean'"
                v-model="config[param.key]"
                :label="param.label"
                :hint="param.help"
                persistent-hint
                color="primary"
                density="compact"
              />
              <v-select
                v-else-if="param.type === 'enum'"
                v-model="config[param.key]"
                :items="param.options"
                item-title="label"
                item-value="value"
                :label="param.label"
                :hint="param.help"
                persistent-hint
                variant="outlined"
                density="comfortable"
              />
            </template>
          </div>
        </section>

        <section v-if="priceParams.length" class="card">
          <div class="card-head">
            <span class="step">4</span>
            <div>
              <h2 class="card-title">Khoảng giá mua / bán</h2>
              <p class="card-sub">
                Giới hạn cứng, độc lập với chỉ báo. Để 0 nghĩa là không giới hạn.
              </p>
            </div>
          </div>
          <div class="grid-2">
            <v-text-field
              v-for="param in priceParams"
              :key="param.key"
              v-model.number="config[param.key]"
              :label="param.label"
              type="number"
              min="0"
              :hint="param.help"
              persistent-hint
              variant="outlined"
              density="comfortable"
              suffix="USD"
            />
          </div>
          <v-alert type="info" variant="tonal" density="compact" class="mt-3">
            Lệnh cắt lỗ luôn được thực hiện bất kể khoảng giá bán — nếu không, một sàn giá
            sẽ khiến vị thế không bao giờ đóng được.
          </v-alert>
        </section>

        <section v-if="riskParams.length" class="card">
          <div class="card-head">
            <span class="step">5</span>
            <div>
              <h2 class="card-title">Quản trị rủi ro</h2>
              <p class="card-sub">Áp dụng trước cả tín hiệu chiến lược.</p>
            </div>
          </div>
          <div class="grid-3">
            <v-text-field
              v-for="param in riskParams"
              :key="param.key"
              v-model.number="config[param.key]"
              :label="param.label + (param.unit ? ` (${param.unit})` : '')"
              type="number"
              :min="param.min"
              :max="param.max"
              :step="param.step ?? 0.1"
              :hint="param.help"
              persistent-hint
              variant="outlined"
              density="comfortable"
            />
            <v-text-field
              v-model="form.maxLossUsd"
              label="Dừng bot khi lỗ tới (USD)"
              type="number"
              min="0"
              hint="Nền tảng tự dừng bot khi lỗ thực tế vượt mức này."
              persistent-hint
              variant="outlined"
              density="comfortable"
            />
          </div>
        </section>
      </div>

      <aside class="side">
        <div class="side-card">
          <div class="side-title">Tóm tắt</div>
          <dl class="summary">
            <div><dt>Cặp</dt><dd>{{ form.symbol || "—" }}</dd></div>
            <div><dt>Khung</dt><dd>{{ form.timeframe }}</dd></div>
            <div><dt>Chiến lược</dt><dd>{{ selectedStrategy?.name ?? "—" }}</dd></div>
            <div><dt>Mỗi lệnh</dt><dd>{{ config.orderSizeUsd ?? "—" }} USD</dd></div>
            <div><dt>Chốt lời</dt><dd>{{ config.takeProfitPercent ?? "—" }}%</dd></div>
            <div><dt>Cắt lỗ</dt><dd>{{ config.stopLossPercent ?? "—" }}%</dd></div>
            <div v-if="Number(config.maxBuyPrice) > 0">
              <dt>Trần mua</dt><dd>{{ config.maxBuyPrice }} USD</dd>
            </div>
            <div v-if="Number(config.minBuyPrice) > 0">
              <dt>Sàn mua</dt><dd>{{ config.minBuyPrice }} USD</dd>
            </div>
            <div>
              <dt>Cần dữ liệu</dt>
              <dd>{{ selectedStrategy?.minCandles ?? "—" }} nến</dd>
            </div>
          </dl>

          <v-switch
            v-model="form.isPaper"
            color="primary"
            density="compact"
            hide-details
            class="mt-2"
            :label="form.isPaper ? 'Paper — không dùng tiền thật' : 'Giao dịch tiền thật'"
          />
          <v-alert
            v-if="!form.isPaper"
            type="warning"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            Bot sẽ đặt lệnh thật bằng API key của bạn.
          </v-alert>

          <v-btn
            block
            size="large"
            class="save-btn mt-4"
            :loading="saving"
            :disabled="!canSubmit"
            @click="onSubmit"
          >
            Tạo bot
          </v-btn>
          <p class="side-note">
            Bot được tạo ở trạng thái nháp. Bạn bấm Chạy ở trang Bots khi sẵn sàng.
          </p>
        </div>
      </aside>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  useBots,
  useStrategies,
  type ParamSpec,
  type StrategyInfo,
} from "~/composables/useTrading";
import { useExchangeAccounts } from "~/composables/useExchangeAccounts";

const router = useRouter();
const { createBot, readError } = useBots();
const { strategies, indicators, operators, fetchStrategies, defaultsFor } =
  useStrategies();
const { accounts, fetchAccounts } = useExchangeAccounts();

const timeframes = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"];
const commonSymbols = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
];

const config = ref<Record<string, any>>({});
const saving = ref(false);
const error = ref<string | null>(null);

const form = reactive({
  exchangeAccountId: "",
  strategyKey: "",
  symbol: "BTCUSDT",
  timeframe: "1h",
  maxLossUsd: "",
  isPaper: true,
});

const accountOptions = computed(() =>
  accounts.value
    .filter((a) => a.status === "ACTIVE")
    .map((a) => ({
      title: `${a.exchange} — ${a.label}${a.isTestnet ? " (testnet)" : ""}`,
      value: a.id,
    })),
);

const selectedStrategy = computed<StrategyInfo | undefined>(() =>
  strategies.value.find((s) => s.key === form.strategyKey),
);

/**
 * Parameters are grouped so each section of the form has one job: rules, then
 * tuning knobs, then price bands, then risk. One flat list is what made the old
 * dialog unreadable.
 */
const PRICE_KEYS = ["minBuyPrice", "maxBuyPrice", "minSellPrice", "maxSellPrice"];
const RISK_KEYS = ["takeProfitPercent", "stopLossPercent", "orderSizeUsd"];

const paramsOf = (predicate: (p: ParamSpec) => boolean) =>
  computed(() => (selectedStrategy.value?.params ?? []).filter(predicate));

const ruleParams = paramsOf((p) => p.type === "rules");
const priceParams = paramsOf((p) => PRICE_KEYS.includes(p.key));
const riskParams = paramsOf((p) => RISK_KEYS.includes(p.key));
const tuningParams = paramsOf(
  (p) =>
    p.type !== "rules" &&
    !PRICE_KEYS.includes(p.key) &&
    !RISK_KEYS.includes(p.key),
);

const canSubmit = computed(
  () =>
    !!form.exchangeAccountId &&
    !!form.strategyKey &&
    /^[A-Z0-9]{5,20}$/.test(String(form.symbol ?? "").toUpperCase()),
);

const categoryLabel = (category: string) =>
  ({
    momentum: "Động lượng",
    "mean-reversion": "Hồi quy",
    trend: "Xu hướng",
    volatility: "Biến động",
    breakout: "Phá vỡ",
  })[category] ?? category;

const selectStrategy = (key: string) => {
  form.strategyKey = key;
  const strategy = strategies.value.find((s) => s.key === key);
  // Each strategy owns its parameter set; carrying the previous one over would
  // send settings the server rejects.
  config.value = strategy ? defaultsFor(strategy) : {};
};

const onSubmit = async () => {
  saving.value = true;
  error.value = null;
  try {
    await createBot({
      exchangeAccountId: form.exchangeAccountId,
      strategyKey: form.strategyKey,
      symbol: String(form.symbol).toUpperCase(),
      timeframe: form.timeframe,
      isPaper: form.isPaper,
      maxLossUsd: form.maxLossUsd || undefined,
      config: config.value,
    });
    router.push("/bots");
  } catch (err) {
    error.value = await readError(err);
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  await Promise.all([fetchStrategies(), fetchAccounts()]);
  form.exchangeAccountId = accountOptions.value[0]?.value ?? "";
  selectStrategy(strategies.value[0]?.key ?? "");
});
</script>

<style scoped>
.page {
  padding: 20px 24px 80px;
  color: #f1f5f9;
  max-width: 1400px;
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
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.page-subtitle {
  margin-top: 4px;
  font-size: 0.85rem;
  color: #94a3b8;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}
@media (max-width: 1100px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
.main {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.card,
.side-card {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(167, 139, 250, 0.12);
  border-radius: 12px;
  padding: 18px;
}
.card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.step {
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
.card-title {
  font-size: 1rem;
  font-weight: 700;
}
.card-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
}
.grid-2,
.grid-3 {
  display: grid;
  gap: 14px;
}
.grid-2 {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.grid-3 {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
.strategy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 8px;
}
.strategy-chip {
  text-align: left;
  padding: 10px 12px;
  border-radius: 9px;
  border: 1px solid rgba(167, 139, 250, 0.15);
  background: rgba(15, 23, 42, 0.5);
  transition: all 0.15s ease;
  cursor: pointer;
}
.strategy-chip:hover {
  border-color: rgba(167, 139, 250, 0.35);
}
.strategy-chip.active {
  border-color: #a78bfa;
  background: rgba(124, 58, 237, 0.15);
}
.strategy-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}
.strategy-cat {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
}
.strategy-desc {
  margin-top: 12px;
  font-size: 12px;
  color: #cbd5e1;
  line-height: 1.6;
}
.rule-block {
  margin-bottom: 16px;
}
.rule-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a78bfa;
  margin-bottom: 8px;
}
.rule-help {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #64748b;
}
.side {
  position: sticky;
  top: 64px;
}
.side-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-bottom: 12px;
}
.summary div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  border-top: 1px solid rgba(167, 139, 250, 0.08);
  font-size: 12px;
}
.summary dt {
  color: #94a3b8;
}
.summary dd {
  font-weight: 600;
  text-align: right;
}
.save-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  color: #fff;
  font-weight: 600;
  text-transform: none;
}
.side-note {
  margin-top: 10px;
  font-size: 11px;
  color: #64748b;
  line-height: 1.5;
}
</style>
