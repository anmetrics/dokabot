<template>
  <div class="my-bot-page">
    <!-- Header -->
    <div class="page-header d-flex align-center justify-space-between mb-6">
      <div>
        <h1 class="text-h4 font-weight-bold text-white">My Trading Bot</h1>
        <p class="text-body-1 text-grey-lighten-1 mt-2">
          Tự động giao dịch 24/7 • DCA • Grid • Arbitrage
        </p>
      </div>

      <!-- Nút tạo bot mới -->
      <v-btn
        size="large"
        color="#ff006e"
        prepend-icon="mdi-robot-happy-outline"
        class="text-none font-weight-bold px-6 create-bot-btn"
        @click="showCreateDialog = true"
      >
        <v-icon start>mdi-plus-thick</v-icon>
        Tạo Bot Mới
      </v-btn>
    </div>

    <!-- Stats Cards -->
    <v-row class="mb-6">
      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" elevation="8">
          <div class="d-flex align-center">
            <v-avatar size="56" class="mr-4" color="#1e40af">
              <v-icon size="32" color="white">mdi-robot</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey-lighten-2">Bot đang chạy</div>
              <div class="text-h5 font-weight-bold text-white">
                {{ runningBots }}
              </div>
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" elevation="8">
          <div class="d-flex align-center">
            <v-avatar size="56" class="mr-4" color="#7c2d12">
              <v-icon size="32" color="white">mdi-chart-line</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey-lighten-2">Tổng PnL</div>
              <div
                class="text-h5 font-weight-bold"
                :class="
                  totalPnl >= 0 ? 'text-green-accent-3' : 'text-red-accent-2'
                "
              >
                {{ formatPnl(totalPnl) }}
              </div>
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" elevation="8">
          <div class="d-flex align-center">
            <v-avatar size="56" class="mr-4" color="#581c87">
              <v-icon size="32" color="white">mdi-wallet-outline</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey-lighten-2">Tổng vốn bot</div>
              <div class="text-h5 font-weight-bold text-white">$12,450</div>
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <v-card class="stat-card" elevation="8">
          <div class="d-flex align-center">
            <v-avatar size="56" class="mr-4" color="#0d9488">
              <v-icon size="32" color="white">mdi-trending-up</v-icon>
            </v-avatar>
            <div>
              <div class="text-caption text-grey-lighten-2">Win Rate</div>
              <div class="text-h5 font-weight-bold text-cyan-accent-3">
                87.3%
              </div>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Danh sách Bot -->
    <v-card class="bot-list-card" elevation="12">
      <v-card-title class="text-h6 font-weight-bold">
        <v-icon start>mdi-robot-outline</v-icon>
        Bot của bạn ({{ bots.length }})
      </v-card-title>

      <v-divider />

      <div v-if="bots.length === 0" class="text-center py-16">
        <v-icon size="80" color="grey-lighten-1" class="mb-4"
          >mdi-robot-dead-outline</v-icon
        >
        <p class="text-h6 text-grey-lighten-1">Bạn chưa có bot nào</p>
        <v-btn
          color="#ff006e"
          variant="tonal"
          class="mt-4"
          @click="showCreateDialog = true"
        >
          Tạo bot đầu tiên ngay!
        </v-btn>
      </div>

      <v-list v-else lines="three" class="bot-list">
        <v-list-item
          v-for="bot in bots"
          :key="bot.id"
          class="bot-item mb-3"
          rounded="xl"
          elevation="6"
        >
          <template v-slot:prepend>
            <v-avatar size="64" :color="bot.strategyColor">
              <v-icon size="36" color="white">{{ bot.icon }}</v-icon>
            </v-avatar>
          </template>

          <v-list-item-title class="text-h6 font-weight-bold text-white">
            {{ bot.name }}
            <v-chip
              size="small"
              :color="bot.active ? 'green-darken-2' : 'grey-darken-1'"
              class="ml-3"
            >
              <v-icon start size="14">{{
                bot.active ? "mdi-play" : "mdi-pause"
              }}</v-icon>
              {{ bot.active ? "Đang chạy" : "Tạm dừng" }}
            </v-chip>
          </v-list-item-title>

          <v-list-item-subtitle class="text-grey-lighten-1 mt-2">
            <div class="d-flex align-center gap-4">
              <span><strong>Cặp:</strong> {{ bot.pair }}</span>
              <span><strong>Chiến lược:</strong> {{ bot.strategy }}</span>
              <span><strong>Vốn:</strong> ${{ bot.capital }}</span>
            </div>
            <div class="mt-2">
              <strong>PnL:</strong>
              <span
                :class="
                  bot.pnl >= 0 ? 'text-green-accent-3' : 'text-red-accent-2'
                "
              >
                {{ bot.pnl >= 0 ? "+" : "" }}{{ bot.pnl }}% (${{
                  Math.abs(bot.profit)
                }})
              </span>
            </div>
          </v-list-item-subtitle>

          <template v-slot:append>
            <div class="d-flex flex-column gap-2">
              <v-btn
                icon
                size="small"
                :color="bot.active ? 'orange-darken-2' : 'green-darken-2'"
                @click="toggleBot(bot)"
              >
                <v-icon>{{ bot.active ? "mdi-pause" : "mdi-play" }}</v-icon>
              </v-btn>
              <v-btn icon size="small" color="grey" @click="openEdit(bot)">
                <v-icon>mdi-cog-outline</v-icon>
              </v-btn>
              <v-btn
                icon
                size="small"
                color="red-darken-2"
                @click="deleteBot(bot)"
              >
                <v-icon>mdi-delete-outline</v-icon>
              </v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Dialog tạo bot -->
    <v-dialog v-model="showCreateDialog" max-width="600">
      <v-card class="create-bot-dialog">
        <v-card-title class="text-h5 font-weight-bold">
          <v-icon start color="#ff006e">mdi-robot-happy-outline</v-icon>
          Tạo Trading Bot Mới
        </v-card-title>
        <v-card-text>
          <v-form>
            <v-text-field
              label="Tên bot"
              prepend-inner-icon="mdi-label-outline"
              variant="outlined"
              class="mb-4"
            />
            <v-select
              label="Chiến lược"
              :items="strategies"
              prepend-inner-icon="mdi-brain"
              variant="outlined"
              class="mb-4"
            />
            <v-select
              label="Cặp giao dịch"
              :items="pairs"
              prepend-inner-icon="mdi-swap-horizontal"
              variant="outlined"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreateDialog = false">Hủy</v-btn>
          <v-btn color="#ff006e" variant="tonal" @click="createBot"
            >Tạo Bot</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
const showCreateDialog = ref(false);

const runningBots = 6;
const totalPnl = 428.5;

// Danh sách bot mẫu
const bots = ref([
  {
    id: 1,
    name: "DCA Master BTC",
    pair: "BTC/USDT",
    strategy: "DCA",
    capital: 5000,
    pnl: 12.4,
    profit: 620,
    active: true,
    strategyColor: "#dc2626",
    icon: "mdi-chart-bell-curve-cumulative",
  },
  {
    id: 2,
    name: "Grid King ETH",
    pair: "ETH/USDT",
    strategy: "Grid Trading",
    capital: 3000,
    pnl: 8.9,
    profit: 267,
    active: true,
    strategyColor: "#7c2d12",
    icon: "mdi-grid",
  },
  {
    id: 3,
    name: "Arbitrage Pro",
    pair: "SOL/USDT",
    strategy: "Triangular Arb",
    capital: 2000,
    pnl: -2.1,
    profit: -42,
    active: false,
    strategyColor: "#581c87",
    icon: "mdi-triangle-outline",
  },
  {
    id: 4,
    name: "Sniper BNB",
    pair: "BNB/USDT",
    strategy: "Volume Sniper",
    capital: 1500,
    pnl: 45.8,
    profit: 687,
    active: true,
    strategyColor: "#0d9488",
    icon: "mdi-target",
  },
  {
    id: 5,
    name: "Moon Bot XRP",
    pair: "XRP/USDT",
    strategy: "Moon Strategy",
    capital: 800,
    pnl: 156.3,
    profit: 1250,
    active: true,
    strategyColor: "#1e40af",
    icon: "mdi-rocket-launch",
  },
  {
    id: 6,
    name: "Safe Haven ADA",
    pair: "ADA/USDT",
    strategy: "HODL + DCA",
    capital: 1000,
    pnl: 5.2,
    profit: 52,
    active: false,
    strategyColor: "#4f46e5",
    icon: "mdi-shield-check",
  },
]);

const strategies = [
  "DCA",
  "Grid Trading",
  "Martingale",
  "Arbitrage",
  "Scalping",
  "Moon Strategy",
];
const pairs = [
  "BTC/USDT",
  "ETH/USDT",
  "SOL/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "ADA/USDT",
  "DOGE/USDT",
];

const formatPnl = (val: number) => {
  return val >= 0 ? `+$${val.toFixed(2)}` : `-$${Math.abs(val).toFixed(2)}`;
};

const toggleBot = (bot: any) => {
  bot.active = !bot.active;
};

const createBot = () => {
  // Logic tạo bot
  showCreateDialog.value = false;
};

const deleteBot = (bot: any) => {
  bots.value = bots.value.filter((b) => b.id !== bot.id);
};
</script>

<style scoped>
.my-bot-page {
  padding: 24px;
  min-height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
}

.stat-card {
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.8),
    rgba(15, 23, 42, 0.9)
  );
  border-radius: 16px !important;
  padding: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.bot-list-card {
  background: rgba(15, 23, 42, 0.7) !important;
  border-radius: 20px !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.bot-item {
  background: linear-gradient(
    90deg,
    rgba(30, 41, 59, 0.6),
    rgba(51, 65, 85, 0.4)
  );
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  transition: all 0.3s ease;
}

.bot-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4) !important;
  border-color: #ff006e44 !important;
}

.create-bot-btn {
  background: linear-gradient(135deg, #ff006e, #e91e63) !important;
  box-shadow: 0 8px 25px rgba(255, 0, 110, 0.4) !important;
}

.create-bot-dialog {
  background: #1e293b !important;
  border: 1px solid #ff006e44;
}

.page-header h1 {
  background: linear-gradient(90deg, #4fc3f7, #ff006e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
