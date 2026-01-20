<template>
  <div class="pairs-list">
    <!-- Header -->
    <div class="pairs-header">
      <h3 class="pairs-title">Markets</h3>
      <button class="collapse-btn" @click="$emit('collapse')">
        <v-icon size="18">mdi-chevron-left</v-icon>
      </button>
    </div>

    <!-- Search -->
    <div class="search-wrapper">
      <v-text-field
        v-model="searchQuery"
        variant="outlined"
        density="compact"
        placeholder="Search"
        hide-details
        class="search-input"
      >
        <template #prepend-inner>
          <v-icon size="18" color="#64748b">mdi-magnify</v-icon>
        </template>
      </v-text-field>
    </div>

    <!-- Quote filters -->
    <div class="quote-filters">
      <button
        v-for="quote in quoteAssets"
        :key="quote"
        :class="['quote-btn', { active: selectedQuote === quote }]"
        @click="selectedQuote = quote"
      >
        {{ quote }}
      </button>
    </div>

    <!-- Sort header -->
    <div class="sort-header">
      <button
        :class="['sort-btn', { active: sortBy === 'symbol' }]"
        @click="toggleSort('symbol')"
      >
        Pair
        <v-icon v-if="sortBy === 'symbol'" size="12">
          {{ sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}
        </v-icon>
      </button>
      <button
        :class="['sort-btn', { active: sortBy === 'price' }]"
        @click="toggleSort('price')"
      >
        Price
        <v-icon v-if="sortBy === 'price'" size="12">
          {{ sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}
        </v-icon>
      </button>
      <button
        :class="['sort-btn', { active: sortBy === 'change' }]"
        @click="toggleSort('change')"
      >
        Change
        <v-icon v-if="sortBy === 'change'" size="12">
          {{ sortDir === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down' }}
        </v-icon>
      </button>
    </div>

    <!-- Favorites section -->
    <div v-if="favoritePairs.length > 0 && !searchQuery" class="favorites-section">
      <div class="section-header">
        <v-icon size="14" color="#f59e0b">mdi-star</v-icon>
        <span>Favorites</span>
      </div>
      <div
        v-for="pair in favoritePairs"
        :key="'fav-' + pair.symbol"
        :class="['pair-item', { active: pair.symbol === currentSymbol }]"
        @click="selectPair(pair.symbol)"
      >
        <div class="pair-info">
          <button class="star-btn active" @click.stop="toggleFavorite(pair.symbol)">
            <v-icon size="14" color="#f59e0b">mdi-star</v-icon>
          </button>
          <span class="pair-symbol">{{ pair.baseAsset }}/{{ pair.quoteAsset }}</span>
        </div>
        <div class="pair-price">{{ formatPrice(pair.price) }}</div>
        <div :class="['pair-change', pair.priceChangePercent >= 0 ? 'up' : 'down']">
          {{ pair.priceChangePercent >= 0 ? '+' : '' }}{{ pair.priceChangePercent.toFixed(2) }}%
        </div>
      </div>
    </div>

    <!-- All pairs -->
    <div class="pairs-scroll" ref="scrollContainer">
      <div
        v-for="pair in filteredPairs"
        :key="pair.symbol"
        :class="['pair-item', { active: pair.symbol === currentSymbol }]"
        @click="selectPair(pair.symbol)"
      >
        <div class="pair-info">
          <button
            class="star-btn"
            :class="{ active: isFavorite(pair.symbol) }"
            @click.stop="toggleFavorite(pair.symbol)"
          >
            <v-icon size="14">{{ isFavorite(pair.symbol) ? 'mdi-star' : 'mdi-star-outline' }}</v-icon>
          </button>
          <span class="pair-symbol">{{ pair.baseAsset }}/{{ pair.quoteAsset }}</span>
        </div>
        <div class="pair-price">{{ formatPrice(pair.price) }}</div>
        <div :class="['pair-change', pair.priceChangePercent >= 0 ? 'up' : 'down']">
          {{ pair.priceChangePercent >= 0 ? '+' : '' }}{{ pair.priceChangePercent.toFixed(2) }}%
        </div>
      </div>

      <div v-if="isLoading" class="loading-state">
        <v-progress-circular indeterminate size="24" color="primary" />
      </div>

      <div v-if="!isLoading && filteredPairs.length === 0" class="empty-state">
        <v-icon size="32" color="#64748b">mdi-magnify</v-icon>
        <span>No pairs found</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import {
  fetchTradingPairs,
  subscribeAllMiniTickers,
  type TradingPair,
  type TickerData,
} from "~/services/binanceService";
import { useTradingState } from "~/composables/useTradingState";

const props = defineProps<{
  currentSymbol: string;
}>();

const emit = defineEmits<{
  (e: "select", symbol: string): void;
  (e: "collapse"): void;
}>();

const { favorites, toggleFavorite, isFavorite } = useTradingState();

interface PairWithPrice extends TradingPair {
  price: number;
  priceChangePercent: number;
}

const searchQuery = ref("");
const selectedQuote = ref("USDT");
const sortBy = ref<"symbol" | "price" | "change">("symbol");
const sortDir = ref<"asc" | "desc">("asc");
const isLoading = ref(true);

const pairs = ref<PairWithPrice[]>([]);
const tickerData = ref<Map<string, TickerData>>(new Map());

let stopTickerWs: (() => void) | null = null;

const quoteAssets = ["USDT", "BTC", "ETH", "BNB"];

const filteredPairs = computed(() => {
  let result = pairs.value.filter((p) => {
    // Filter by quote asset
    if (!p.symbol.endsWith(selectedQuote.value)) return false;

    // Filter by search
    if (searchQuery.value) {
      const query = searchQuery.value.toUpperCase();
      return (
        p.symbol.includes(query) ||
        p.baseAsset.includes(query) ||
        p.quoteAsset.includes(query)
      );
    }

    return true;
  });

  // Sort
  result.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === "symbol") {
      cmp = a.symbol.localeCompare(b.symbol);
    } else if (sortBy.value === "price") {
      cmp = a.price - b.price;
    } else if (sortBy.value === "change") {
      cmp = a.priceChangePercent - b.priceChangePercent;
    }
    return sortDir.value === "asc" ? cmp : -cmp;
  });

  return result;
});

const favoritePairs = computed(() => {
  return pairs.value.filter((p) => favorites.value.includes(p.symbol));
});

function formatPrice(price: number): string {
  if (price === 0 || isNaN(price)) return "-";
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

function toggleSort(field: "symbol" | "price" | "change") {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortBy.value = field;
    sortDir.value = field === "symbol" ? "asc" : "desc";
  }
}

function selectPair(symbol: string) {
  emit("select", symbol);
}

function updatePrices(tickers: TickerData[]) {
  for (const ticker of tickers) {
    tickerData.value.set(ticker.symbol, ticker);
  }

  // Update pairs with new prices
  for (const pair of pairs.value) {
    const ticker = tickerData.value.get(pair.symbol);
    if (ticker) {
      pair.price = ticker.price;
      pair.priceChangePercent = ticker.priceChangePercent;
    }
  }
}

onMounted(async () => {
  try {
    // Fetch trading pairs
    const rawPairs = await fetchTradingPairs();

    // Filter to common quote assets and initialize
    pairs.value = rawPairs
      .filter((p) => quoteAssets.some((q) => p.symbol.endsWith(q)))
      .map((p) => ({
        ...p,
        price: 0,
        priceChangePercent: 0,
      }));

    isLoading.value = false;

    // Subscribe to ticker updates
    stopTickerWs = subscribeAllMiniTickers(updatePrices);
  } catch (error) {
    console.error("Failed to load trading pairs:", error);
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  stopTickerWs?.();
});
</script>

<style scoped>
.pairs-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-right: 1px solid rgba(167, 139, 250, 0.1);
}

.pairs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 10px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.pairs-title {
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
  margin: 0;
}

.collapse-btn {
  padding: 3px;
  color: #64748b;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
}

.collapse-btn:hover {
  color: #f1f5f9;
  background: rgba(167, 139, 250, 0.1);
}

.search-wrapper {
  padding: 6px 8px;
}

.search-input :deep(.v-field) {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 6px;
}

.search-input :deep(.v-field__input) {
  font-size: 11px;
  color: #f1f5f9;
  padding: 4px 6px;
}

.quote-filters {
  display: flex;
  gap: 3px;
  padding: 2px 8px 6px;
}

.quote-btn {
  flex: 1;
  padding: 3px 6px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quote-btn:hover {
  color: #94a3b8;
  border-color: rgba(167, 139, 250, 0.2);
}

.quote-btn.active {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
  border-color: rgba(167, 139, 250, 0.3);
}

.sort-header {
  display: flex;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.sort-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  padding: 2px;
  font-size: 9px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sort-btn:hover,
.sort-btn.active {
  color: #94a3b8;
}

.favorites-section {
  padding: 4px 0;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
}

.pairs-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.pair-item {
  display: flex;
  align-items: center;
  padding: 5px 8px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.pair-item:hover {
  background: rgba(167, 139, 250, 0.05);
}

.pair-item.active {
  background: rgba(167, 139, 250, 0.1);
}

.pair-info {
  flex: 1.2;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.star-btn {
  padding: 1px;
  color: #475569;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.2s ease;
  display: flex;
  align-items: center;
}

.star-btn .v-icon {
  font-size: 12px !important;
}

.star-btn:hover {
  color: #f59e0b;
}

.star-btn.active {
  color: #f59e0b;
}

.pair-symbol {
  font-size: 11px;
  font-weight: 600;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pair-price {
  flex: 1;
  font-size: 10px;
  font-weight: 500;
  color: #94a3b8;
  text-align: right;
}

.pair-change {
  flex: 0.8;
  font-size: 10px;
  font-weight: 600;
  text-align: right;
}

.pair-change.up {
  color: #10b981;
}

.pair-change.down {
  color: #ef4444;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
  gap: 8px;
  color: #64748b;
  font-size: 11px;
}

/* Scrollbar */
.pairs-scroll::-webkit-scrollbar {
  width: 3px;
}

.pairs-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.pairs-scroll::-webkit-scrollbar-thumb {
  background: rgba(167, 139, 250, 0.2);
  border-radius: 2px;
}

.pairs-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(167, 139, 250, 0.3);
}
</style>
