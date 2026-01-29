<template>
  <div class="order-form">
    <!-- Header -->
    <div class="of-header">
      <div class="of-tabs">
        <button
          :class="['of-tab', { active: orderSide === 'BUY' }]"
          @click="orderSide = 'BUY'"
        >
          Buy
        </button>
        <button
          :class="['of-tab', { active: orderSide === 'SELL' }]"
          @click="orderSide = 'SELL'"
        >
          Sell
        </button>
      </div>
    </div>

    <!-- Order type selector -->
    <div class="of-type-selector">
      <button
        v-for="type in orderTypes"
        :key="type.value"
        :class="['type-btn', { active: orderType === type.value }]"
        @click="orderType = type.value"
      >
        {{ type.label }}
      </button>
    </div>

    <!-- Form content -->
    <div class="of-form">
      <!-- Price input (for limit orders) -->
      <div v-if="orderType !== 'MARKET'" class="of-field">
        <div class="field-label">
          <span>Price</span>
          <span class="field-hint">{{ quoteAsset }}</span>
        </div>
        <div class="input-group">
          <button class="input-btn" @click="adjustPrice(-1)">
            <v-icon size="16">mdi-minus</v-icon>
          </button>
          <input
            type="number"
            v-model.number="price"
            class="of-input"
            :placeholder="orderType === 'STOP_LIMIT' ? 'Limit Price' : 'Price'"
            step="any"
          />
          <button class="input-btn" @click="adjustPrice(1)">
            <v-icon size="16">mdi-plus</v-icon>
          </button>
        </div>
      </div>

      <!-- Stop price (for stop-limit) -->
      <div v-if="orderType === 'STOP_LIMIT'" class="of-field">
        <div class="field-label">
          <span>Stop</span>
          <span class="field-hint">{{ quoteAsset }}</span>
        </div>
        <div class="input-group">
          <input
            type="number"
            v-model.number="stopPrice"
            class="of-input"
            placeholder="Stop Price"
            step="any"
          />
        </div>
      </div>

      <!-- Amount input -->
      <div class="of-field">
        <div class="field-label">
          <span>Amount</span>
          <span class="field-hint">{{ baseAsset }}</span>
        </div>
        <div class="input-group">
          <input
            type="number"
            v-model.number="amount"
            class="of-input"
            placeholder="Amount"
            step="any"
          />
        </div>
      </div>

      <!-- Amount slider -->
      <div class="of-slider">
        <input
          type="range"
          v-model.number="sliderPercent"
          min="0"
          max="100"
          step="1"
          class="slider"
        />
        <div class="slider-marks">
          <button
            v-for="pct in [25, 50, 75, 100]"
            :key="pct"
            :class="['mark-btn', { active: sliderPercent === pct }]"
            @click="sliderPercent = pct"
          >
            {{ pct }}%
          </button>
        </div>
      </div>

      <!-- Total -->
      <div class="of-field">
        <div class="field-label">
          <span>Total</span>
          <span class="field-hint">{{ quoteAsset }}</span>
        </div>
        <div class="input-group readonly">
          <input
            type="text"
            :value="formatTotal(total)"
            class="of-input"
            readonly
          />
        </div>
      </div>

      <!-- Available balance -->
      <div class="of-balance">
        <span class="balance-label">Available</span>
        <span class="balance-value">
          {{ formatBalance(availableBalance) }} {{ orderSide === 'BUY' ? quoteAsset : baseAsset }}
        </span>
      </div>

      <!-- Submit button -->
      <button
        :class="['of-submit', orderSide.toLowerCase()]"
        @click="submitOrder"
        :disabled="!canSubmit"
      >
        {{ orderSide }} {{ baseAsset }}
      </button>

      <!-- Demo notice -->
      <div class="demo-notice">
        <v-icon size="14" color="#f59e0b">mdi-alert-circle</v-icon>
        <span>Demo Mode - Orders are not real</span>
      </div>
    </div>

    <!-- Snackbar for notifications -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" timeout="3000" location="top">
      {{ snackbarMessage }}
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useTradingState } from "~/composables/useTradingState";

const props = defineProps<{
  symbol: string;
}>();

const {
  currentPrice,
  selectedPrice,
  getBalance,
  placeDemoOrder,
} = useTradingState();

const orderSide = ref<"BUY" | "SELL">("BUY");
const orderType = ref<"LIMIT" | "MARKET" | "STOP_LIMIT">("LIMIT");
const price = ref<number>(0);
const stopPrice = ref<number>(0);
const amount = ref<number>(0);
const sliderPercent = ref<number>(0);

const showSnackbar = ref(false);
const snackbarMessage = ref("");
const snackbarColor = ref("success");

const orderTypes = [
  { label: "Limit", value: "LIMIT" },
  { label: "Market", value: "MARKET" },
  { label: "Stop-Limit", value: "STOP_LIMIT" },
];

const baseAsset = computed(() => {
  // Extract base asset from symbol (e.g., BTC from BTCUSDT)
  const symbol = props.symbol;
  if (symbol.endsWith("USDT")) return symbol.slice(0, -4);
  if (symbol.endsWith("BTC")) return symbol.slice(0, -3);
  if (symbol.endsWith("ETH")) return symbol.slice(0, -3);
  if (symbol.endsWith("BNB")) return symbol.slice(0, -3);
  return symbol.slice(0, 3);
});

const quoteAsset = computed(() => {
  const symbol = props.symbol;
  if (symbol.endsWith("USDT")) return "USDT";
  if (symbol.endsWith("BTC")) return "BTC";
  if (symbol.endsWith("ETH")) return "ETH";
  if (symbol.endsWith("BNB")) return "BNB";
  return "USDT";
});

const effectivePrice = computed(() => {
  return orderType.value === "MARKET" ? currentPrice.value : price.value;
});

const total = computed(() => {
  return amount.value * effectivePrice.value;
});

const availableBalance = computed(() => {
  const asset = orderSide.value === "BUY" ? quoteAsset.value : baseAsset.value;
  return getBalance(asset).free;
});

const canSubmit = computed(() => {
  if (amount.value <= 0) return false;
  if (orderType.value !== "MARKET" && price.value <= 0) return false;
  if (orderType.value === "STOP_LIMIT" && stopPrice.value <= 0) return false;

  if (orderSide.value === "BUY") {
    return total.value <= availableBalance.value;
  } else {
    return amount.value <= availableBalance.value;
  }
});

function adjustPrice(direction: number) {
  const step = effectivePrice.value >= 1000 ? 1 : effectivePrice.value >= 1 ? 0.01 : 0.0001;
  price.value = Math.max(0, (price.value || currentPrice.value) + direction * step);
}

function formatTotal(value: number): string {
  if (value === 0) return "";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function formatBalance(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

function submitOrder() {
  const order = placeDemoOrder({
    symbol: props.symbol,
    side: orderSide.value,
    type: orderType.value,
    price: orderType.value === "MARKET" ? currentPrice.value : price.value,
    stopPrice: orderType.value === "STOP_LIMIT" ? stopPrice.value : undefined,
    quantity: amount.value,
  });

  snackbarColor.value = orderSide.value === "BUY" ? "success" : "error";
  snackbarMessage.value = `Demo ${orderSide.value} order placed: ${amount.value} ${baseAsset.value} @ ${formatTotal(order.price)}`;
  showSnackbar.value = true;

  // Reset form
  amount.value = 0;
  sliderPercent.value = 0;
}

// Watch for selected price from order book click
watch(selectedPrice, (newPrice) => {
  if (newPrice && newPrice > 0) {
    price.value = newPrice;
  }
});

// Watch current price to set initial price
watch(
  currentPrice,
  (newPrice) => {
    if (price.value === 0 && newPrice > 0) {
      price.value = newPrice;
    }
  },
  { immediate: true }
);

// Watch slider to update amount
watch(sliderPercent, (pct) => {
  if (pct > 0) {
    if (orderSide.value === "BUY") {
      const maxTotal = availableBalance.value * (pct / 100);
      amount.value = effectivePrice.value > 0 ? maxTotal / effectivePrice.value : 0;
    } else {
      amount.value = availableBalance.value * (pct / 100);
    }
  }
});
</script>

<style scoped>
.order-form {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 8px;
  border: 1px solid rgba(167, 139, 250, 0.1);
  overflow: hidden;
}

.of-header {
  padding: 8px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.of-tabs {
  display: flex;
  gap: 3px;
  background: rgba(15, 23, 42, 0.5);
  padding: 3px;
  border-radius: 6px;
}

.of-tab {
  flex: 1;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  background: transparent;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.of-tab:hover {
  color: #f1f5f9;
}

.of-tab.active {
  color: #fff;
}

.of-tabs .of-tab:first-child.active {
  background: #10b981;
}

.of-tabs .of-tab:last-child.active {
  background: #ef4444;
}

.of-type-selector {
  display: flex;
  gap: 3px;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.05);
}

.type-btn {
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-btn:hover {
  color: #94a3b8;
}

.type-btn.active {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.2);
}

.of-form {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.of-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: #64748b;
}

.field-hint {
  color: #475569;
}

.input-group {
  display: flex;
  align-items: center;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 5px;
  transition: border-color 0.2s ease;
}

.input-group:focus-within {
  border-color: rgba(167, 139, 250, 0.3);
}

.input-group.readonly {
  background: rgba(15, 23, 42, 0.3);
}

.input-btn {
  padding: 5px;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.2s ease;
}

.input-btn .v-icon {
  font-size: 14px !important;
}

.input-btn:hover {
  color: #a78bfa;
}

.of-input {
  flex: 1;
  padding: 6px;
  font-size: 11px;
  font-weight: 500;
  color: #f1f5f9;
  background: transparent;
  border: none;
  outline: none;
  font-family: monospace;
  text-align: right;
}

.of-input::placeholder {
  color: #475569;
}

.of-input::-webkit-outer-spin-button,
.of-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.of-slider {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slider {
  width: 100%;
  height: 3px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(167, 139, 250, 0.2);
  border-radius: 2px;
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  background: #a78bfa;
  border-radius: 50%;
  cursor: pointer;
}

.slider-marks {
  display: flex;
  justify-content: space-between;
  gap: 3px;
}

.mark-btn {
  flex: 1;
  padding: 3px;
  font-size: 9px;
  font-weight: 500;
  color: #64748b;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mark-btn:hover {
  color: #94a3b8;
  border-color: rgba(167, 139, 250, 0.2);
}

.mark-btn.active {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.3);
}

.of-balance {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 10px;
}

.balance-label {
  color: #64748b;
}

.balance-value {
  color: #f1f5f9;
  font-weight: 500;
  font-family: monospace;
}

.of-submit {
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.of-submit.buy {
  background: #10b981;
}

.of-submit.buy:hover:not(:disabled) {
  background: #059669;
}

.of-submit.sell {
  background: #ef4444;
}

.of-submit.sell:hover:not(:disabled) {
  background: #dc2626;
}

.of-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.demo-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  font-size: 9px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 5px;
  margin-top: auto;
}

.demo-notice .v-icon {
  font-size: 12px !important;
}

/* Responsive breakpoints */
@media (max-width: 768px) {
  .of-header {
    padding: 6px;
  }

  .of-form {
    padding: 6px;
    gap: 6px;
  }

  .of-type-selector {
    padding: 5px 6px;
  }

  .type-btn {
    padding: 4px 6px;
    font-size: 9px;
  }

  .of-tab {
    padding: 8px 10px;
    font-size: 10px;
    min-height: 36px;
  }

  .field-label {
    font-size: 9px;
  }

  .of-input {
    font-size: 10px;
    padding: 5px;
  }

  .input-btn {
    padding: 6px;
    min-width: 32px;
    min-height: 32px;
  }

  .mark-btn {
    padding: 5px;
    font-size: 8px;
    min-height: 28px;
  }

  .of-submit {
    padding: 10px;
    font-size: 11px;
    min-height: 44px;
  }

  .demo-notice {
    font-size: 8px;
    padding: 5px;
  }
}

@media (max-width: 480px) {
  .of-header {
    padding: 5px;
  }

  .of-form {
    padding: 5px;
    gap: 5px;
  }

  .of-type-selector {
    padding: 4px 5px;
  }

  .type-btn {
    padding: 3px 5px;
    font-size: 8px;
  }

  .of-tab {
    padding: 6px 8px;
    font-size: 9px;
    min-height: 32px;
  }

  .field-label {
    font-size: 8px;
  }

  .of-input {
    font-size: 9px;
    padding: 4px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .input-btn {
    padding: 5px;
    min-width: 28px;
    min-height: 28px;
  }

  .of-balance {
    font-size: 9px;
  }

  .mark-btn {
    padding: 4px;
    font-size: 7px;
    min-height: 24px;
  }

  .of-submit {
    padding: 12px;
    font-size: 10px;
    min-height: 48px;
  }

  .demo-notice {
    font-size: 7px;
    padding: 4px;
  }
}
</style>
