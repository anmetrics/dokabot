<script lang="ts" setup>
import { ref, computed } from 'vue'

const assetStore = useAssetStore()
const { lastClaim } = storeToRefs(assetStore)
const isClaiming = ref(false)
const success = ref<string | null>(null)
const error = ref<string | null>(null)
const showDialog = ref(false)
const dialogMessage = ref('')
const dialogType = ref<'success' | 'error'>('success')
const activeTab = ref('Add Collateral')

// Fetch initial data
await Promise.all([assetStore.getLastClaim()])

// Format time until next claim
const formatTime = computed(() => {
  if (!lastClaim.value?.claimedAt) {
    return 'Available now'
  }

  const lastClaimTime = new Date(
    formatToClientTimezone(lastClaim.value.claimedAt)
  ).getTime()
  const cooldownPeriod = 8 * 60 * 60 * 1000
  const now = new Date().getTime()
  const timeUntilNext = lastClaimTime + cooldownPeriod - now

  if (timeUntilNext <= 0) {
    return 'Available now'
  }

  const hours = Math.floor(timeUntilNext / (1000 * 60 * 60))
  const minutes = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${minutes}m`
})

// Claim token handler
async function claimToken() {
  isClaiming.value = true
  success.value = null
  error.value = null

  try {
    await assetStore.claimToken()
    dialogMessage.value = 'Tokens claimed successfully!'
    dialogType.value = 'success'
    showDialog.value = true
  } catch (err) {
    dialogMessage.value = 'Failed to claim tokens. Please try again.'
    dialogType.value = 'error'
    showDialog.value = true
    console.error('Claim token failed:', err)
  } finally {
    isClaiming.value = false
  }
}

// Tab switch handler
function switchTab(tab: string) {
  activeTab.value = tab
}

// Mock tiers data (in practice, this would come from assetStore)
const tiers = [
  {
    id: 'STARTER',
    name: 'STARTER',
    targetValue: 1000,
    percentReward: 4,
    rewardCap: 120
  },
  {
    id: 'BASIC',
    name: 'BASIC',
    targetValue: 3000,
    percentReward: 7,
    rewardCap: 400
  },
  {
    id: 'STANDARD',
    name: 'STANDARD',
    targetValue: 5000,
    percentReward: 10,
    rewardCap: 700
  },
  {
    id: 'PLUS',
    name: 'PLUS',
    targetValue: 8000,
    percentReward: 12,
    rewardCap: 800
  },
  {
    id: 'PRO',
    name: 'PRO',
    targetValue: 12000,
    percentReward: 15,
    rewardCap: 1000
  },
  {
    id: 'PREMIUM',
    name: 'PREMIUM',
    targetValue: 18000,
    percentReward: 17,
    rewardCap: 1800
  },
  {
    id: 'ELITE',
    name: 'ELITE',
    targetValue: 25000,
    percentReward: 20,
    rewardCap: 2500
  },
  {
    id: 'EXECUTIVE',
    name: 'EXECUTIVE',
    targetValue: 35000,
    percentReward: 25,
    rewardCap: 3500
  },
  {
    id: 'DIRECTOR',
    name: 'DIRECTOR',
    targetValue: 50000,
    percentReward: 30,
    rewardCap: 50000
  },
  {
    id: 'PARTNER',
    name: 'PARTNER',
    targetValue: 75000,
    percentReward: 35,
    rewardCap: 75000
  },
  {
    id: 'VIP',
    name: 'VIP',
    targetValue: 100000,
    percentReward: 40,
    rewardCap: 100000
  },
  {
    id: 'LEGEND',
    name: 'LEGEND',
    targetValue: 150000,
    percentReward: 45,
    rewardCap: 150000
  }
]
</script>

<template>
  <div class="container">
    <header class="header">
      <h1>
        <v-icon icon="mdi-waves" class="header-icon" aria-hidden="true" />
        Doka Ocean Pool
      </h1>
    </header>

    <section class="rewards">
      <div class="rewards-left">
        <p class="label">Rewards Earned</p>
        <p class="sub-label">Available to claim tokens</p>
      </div>
      <div class="rewards-right">
        <span class="reward-amount">Earn 0.01 DOKA</span>
        <v-btn
          :loading="isClaiming"
          :disabled="lastClaim.isClaiming"
          @click="claimToken"
          class="claim-button"
          aria-label="Claim Tokens"
        >
          Claim
        </v-btn>
      </div>
    </section>

    <v-dialog v-model="showDialog" max-width="400" persistent>
      <v-card rounded="lg" class="pa-6">
        <v-card-title
          :class="[
            'dialog-title',
            dialogType === 'success' ? 'success-title' : 'error-title'
          ]"
        >
          {{ dialogType === 'success' ? 'Success' : 'Error' }}
        </v-card-title>
        <v-card-text class="dialog-text">
          {{ dialogMessage }}
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="primary"
            text
            class="dialog-button"
            @click="showDialog = false"
            aria-label="Close Dialog"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <p class="countdown">Next claim available in: {{ formatTime }}</p>

    <!-- <section class="status-cards">
      <div class="card">
        <h3>Borrowing</h3>
        <p class="main">27.4 ETH</p>
        <p class="sub">Used from 54.8 ETH</p>
        <p class="sub">503k USDC</p>
      </div>
      <div class="card">
        <h3>Liquidation Point</h3>
        <p class="main">18.3 ETH</p>
        <p class="sub">Collateral value 32.2 ETH</p>
        <p class="sub">903k USDC</p>
      </div>
      <div class="card">
        <h3>Health Factor</h3>
        <p class="main green">1.8</p>
        <p class="sub">Your Health Factor is in normal state</p>
      </div>
    </section> -->

    <section class="tiers">
      <h2>Reward Tiers</h2>
      <div class="tiers-grid">
        <div
          v-for="tier in tiers"
          :key="tier.id"
          class="tier-card"
          :class="{ active: tier.id === 'STARTER' }"
        >
          <div class="tier-header mb-1">
            <h3>{{ tier.name }}</h3>
            <template v-if="tier.id === 'BASIC'">
              <!-- 👑 Hiện icon nếu là tier của user -->
              <v-icon
                v-if="tier.id === 'BASIC'"
                color="amber"
                class="king-icon"
              >
                mdi-crown
              </v-icon>
            </template>
          </div>
          <p class="main">${{ tier.targetValue.toLocaleString() }}</p>
          <p class="sub">Target Value</p>
          <p class="main">{{ tier.percentReward }}%</p>
          <p class="sub">Reward Rate</p>
          <p class="main">${{ tier.rewardCap.toLocaleString() }}</p>
          <p class="sub">Monthly maximum reward</p>
        </div>
      </div>
    </section>
    <!-- 
    <nav class="tab-nav">
      <button
        v-for="tab in ['My Loan', 'Add Collateral', 'Borrow', 'Lend']"
        :key="tab"
        :class="['tab', { active: activeTab === tab }]"
        @click="switchTab(tab)"
        :aria-label="`Switch to ${tab} tab`"
        :aria-selected="activeTab === tab"
        role="tab"
      >
        {{ tab }}
      </button>
    </nav> -->

    <!-- <section v-if="activeTab === 'Add Collateral'" class="collateral">
      <h2>Available Collateral</h2>
      <div
        v-for="(item, index) in [
          {
            badge: 'MAYC',
            wallet: 'Wallet 7',
            price: 1.2,
            total: 24.2,
            maxLoan: 24.2,
            nfts: ['#12451', '#12451']
          },
          {
            badge: 'BAYC',
            wallet: 'Wallet 7',
            price: 1.2,
            total: 24.2,
            maxLoan: 24.2,
            nfts: ['#12451', '#12451']
          }
        ]"
        :key="index"
        class="collateral-item"
      >
        <div class="info">
          <div class="badge">{{ item.badge }}</div>
          <div class="wallet">{{ item.wallet }}</div>
          <div class="price">
            Price
            <strong>{{ item.price }}</strong>
          </div>
          <div class="total">
            Total Value
            <strong>{{ item.total }}</strong>
          </div>
          <div class="max-loan">
            Max Loan
            <strong>{{ item.maxLoan }}</strong>
          </div>
        </div>
        <div class="nfts">
          <img
            v-for="(nft, i) in item.nfts"
            :key="i"
            :src="`https://via.placeholder.com/60x60?text=${nft}`"
            :alt="`NFT ${nft}`"
            loading="lazy"
          />
        </div>
        <button class="supply-btn" aria-label="Supply Collateral">
          Supply
        </button>
      </div>
    </section> -->
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #1976d2;
$accent-color: #ff6d00;
$background-color: #f1f5f9;
$text-color: #1a1a1a;
$border-radius: 12px;

.container {
  max-width: 900px;
  margin: 24px auto;
  padding: 24px;
}

.header {
  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: $text-color;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .header-icon {
    font-size: 1.5rem;
    color: $primary-color;
  }
}

.rewards {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #ffffff;
  padding: 20px;
  border-radius: $border-radius;
  margin-top: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.rewards-left {
  .label {
    font-weight: 600;
    font-size: 1.1rem;
    color: $text-color;
  }
  .sub-label {
    color: #6b7280;
    font-size: 0.85rem;
    margin-top: 4px;
  }
}

.rewards-right {
  display: flex;
  align-items: center;
  gap: 16px;
  .reward-amount {
    font-weight: 700;
    font-size: 1.25rem;
    color: $text-color;
  }
  .reward-usd {
    color: #6b7280;
    font-size: 0.9rem;
  }
  .claim-button {
    background-color: $primary-color !important;
    color: white !important;
    border-radius: $border-radius !important;
    transition: all 0.3s ease;
    &:hover {
      background-color: darken($primary-color, 10%) !important;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  }
}

.countdown {
  margin-top: 16px;
  color: #6b7280;
  font-size: 0.9rem;
  text-align: center;
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.card {
  background: #ffffff;
  padding: 20px;
  border-radius: $border-radius;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  &:hover {
    transform: translateY(-4px);
  }
  h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: $text-color;
    margin-bottom: 12px;
  }
  .main {
    font-size: 1.5rem;
    font-weight: 700;
    color: $text-color;
  }
  .green {
    color: #2ecc71;
  }
  .sub {
    color: #6b7280;
    font-size: 0.85rem;
    margin-top: 4px;
  }
}

.tiers {
  margin-top: 32px;
  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: $text-color;
    margin-bottom: 16px;
  }
}

.tiers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 30px;
}

.tier-card {
  border: 1px solid #ccc;
  border-radius: 12px;
  padding: 16px;
  background-color: #f9f9f9;
  transition: all 0.3s ease;
}

.tier-card.active {
  border: 2px solid #fdd835;
  background-color: #fffbe6;
  box-shadow: 0 0 4px rgba(253, 216, 53, 0.5);
  transform: scale(1.05);
}

.tier-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.king-icon {
  font-size: 24px;
}

.main {
  font-weight: bold;
  font-size: 1.2rem;
}

.sub {
  color: #666;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.tier-card {
  background: #ffffff;
  padding: 20px;
  border-radius: $border-radius;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  text-align: center;
  &:hover {
    transform: translateY(-4px);
  }

  h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: $text-color;
    margin-bottom: 12px;
  }
  .main {
    font-size: 1.25rem;
    font-weight: 700;
    color: $text-color;
    margin-bottom: 4px;
  }
  .sub {
    color: #6b7280;
    font-size: 0.85rem;
    margin-bottom: 12px;
  }
}

.tier-card.active {
  border: 2px solid #007bff; /* Highlight color for active tier (e.g., blue) */
}

.tab-nav {
  display: flex;
  gap: 12px;
  margin-top: 32px;
  justify-content: center;
}

.tab {
  padding: 10px 20px;
  border: none;
  border-radius: $border-radius;
  background: #e5e7eb;
  color: $text-color;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  &:hover {
    background: darken(#e5e7eb, 10%);
  }
  &.active {
    background: $primary-color;
    color: white;
  }
}

.collateral {
  margin-top: 32px;
  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: $text-color;
    margin-bottom: 16px;
  }
}

.collateral-item {
  background: #ffffff;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-top: 12px;
  border-radius: $border-radius;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
  &:hover {
    transform: translateY(-4px);
  }
  .info {
    flex: 1;
    display: grid;
    gap: 6px;
    .badge {
      display: inline-block;
      background: #f8fafc;
      border: 1px solid #e5e7eb;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.85rem;
      color: $text-color;
    }
    .wallet,
    .price,
    .total,
    .max-loan {
      font-size: 0.9rem;
      color: #6b7280;
      strong {
        color: $text-color;
        font-weight: 600;
      }
    }
  }
  .nfts {
    display: flex;
    gap: 12px;
    margin: 0 24px;
    img {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }
  .supply-btn {
    background: $primary-color;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: $border-radius;
    cursor: pointer;
    transition: all 0.3s ease;
    &:hover {
      background: darken($primary-color, 10%);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  }
}

.dialog-title {
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  padding-bottom: 8px;
}

.success-title {
  color: $primary-color;
}

.error-title {
  color: #d32f2f;
}

.dialog-text {
  font-size: 1rem;
  color: $text-color;
  text-align: center;
  padding: 16px 0;
}

.dialog-button {
  background-color: $primary-color !important;
  color: white !important;
  border-radius: $border-radius;
  transition: all 0.3s ease;
  &:hover {
    background-color: darken($primary-color, 10%) !important;
  }
}

@media (max-width: 600px) {
  .container {
    padding: 16px;
    margin: 16px auto;
  }
  .header h1 {
    font-size: 1.75rem;
  }
  .rewards {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  .rewards-right {
    justify-content: center;
  }
  .status-cards {
    grid-template-columns: 1fr;
  }
  .tiers-grid {
    grid-template-columns: 1fr;
  }
  .tab-nav {
    flex-wrap: wrap;
  }
  .collateral-item {
    flex-direction: column;
    gap: 16px;
    .nfts {
      margin: 12px 0;
    }
  }
}
</style>
