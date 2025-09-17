<template>
  <v-container class="fill-height pa-2 pa-sm-4">
    <v-card
      class="mx-auto pa-4 pa-sm-6"
      min-width="300"
      max-width="900"
      elevation="2"
      rounded="lg"
    >
      <!-- Tabs -->
      <v-tabs
        v-model="activeTab"
        centered
        color="primary"
        bg-color="background"
        class="mb-4"
      >
        <v-tab value="deposit" class="text-capitalize font-weight-bold">
          Deposit
        </v-tab>
        <v-tab value="swap" class="text-capitalize font-weight-bold">
          Swap
        </v-tab>
      </v-tabs>

      <v-window v-model="activeTab">
        <!-- Deposit Tab -->
        <v-window-item value="deposit">
          <v-container class="pa-4 pa-sm-6">
            <v-row>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="selectedCoin"
                  :items="coins"
                  label="Select Coin"
                  outlined
                  dense
                  color="primary"
                  prepend-inner-icon="mdi-currency-usd"
                  bg-color="white"
                  :rules="[v => !!v || 'Coin is required']"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="selectedNetwork"
                  :items="networks"
                  label="Select Network"
                  outlined
                  dense
                  color="primary"
                  prepend-inner-icon="mdi-network"
                  bg-color="white"
                  :rules="[v => !!v || 'Network is required']"
                />
              </v-col>
            </v-row>

            <v-card
              v-if="selectedCoin && selectedNetwork"
              class="pa-4 pa-sm-6 text-center mt-4 mt-sm-6"
              elevation="2"
              rounded="lg"
            >
              <v-card-title class="text-h6 primary--text">
                Scan to Deposit
              </v-card-title>
              <qr-code :data="adminWallet.metamask" />
              <v-btn
                color="success"
                class="mb-4"
                elevation="0"
                rounded
                @click="generateQRCode"
              >
                Regenerate QR
                <v-icon right>mdi-refresh</v-icon>
              </v-btn>
              <div class="address-section d-flex align-center justify-center">
                <span class="address-text mr-2">
                  {{ adminWallet.metamask }}
                </span>
                <v-btn color="primary" icon @click="copyAddress">
                  <v-icon>
                    {{ copySuccess ? 'mdi-check' : 'mdi-content-copy' }}
                  </v-icon>
                </v-btn>
              </div>
            </v-card>

            <v-alert v-else type="info" text style="margin-top: 24px">
              Please select a coin and network to generate a QR code.
            </v-alert>
          </v-container>

          <v-container class="pa-4 pa-sm-6">
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="transactionId"
                  label="Enter Transaction ID"
                  outlined
                  dense
                  color="primary"
                  prepend-inner-icon="mdi-pound"
                  bg-color="white"
                  :rules="[v => !!v || 'Transaction ID is required']"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col class="text-center">
                <v-btn
                  color="primary"
                  :disabled="!transactionId"
                  elevation="0"
                  rounded
                  large
                  @click="verifyTransaction"
                >
                  Verify Transaction
                  <v-icon right class="pl-2">mdi-check-circle</v-icon>
                </v-btn>
              </v-col>
            </v-row>
            <v-alert v-if="networkError" type="error" text class="mt-4 mt-sm-6">
              {{ networkError }}
            </v-alert>
            <v-alert
              v-if="verificationResult"
              :type="verificationResult.type"
              text
              class="mt-4 mt-sm-6"
            >
              {{ verificationResult.message }}
            </v-alert>
          </v-container>
        </v-window-item>

        <!-- Swap Tab -->
        <v-window-item value="swap">
          <v-container class="pa-4 pa-sm-6">
            <v-row>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="swapFromCoin"
                  :items="coins"
                  label="From Coin"
                  outlined
                  dense
                  color="primary"
                  prepend-inner-icon="mdi-swap-horizontal"
                  bg-color="white"
                  :rules="[v => !!v || 'From coin is required']"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="swapToCoin"
                  :items="['DOKA']"
                  label="To Coin"
                  outlined
                  dense
                  color="primary"
                  prepend-inner-icon="mdi-swap-horizontal"
                  bg-color="white"
                  :rules="[v => !!v || 'To coin is required']"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="swapAmount"
                  label="Amount"
                  type="number"
                  outlined
                  dense
                  color="primary"
                  prepend-inner-icon="mdi-currency-usd"
                  :rules="[
                    v =>
                      (!!v && v > 0 && v <= maxDoka) ||
                      'Amount must be valid and not exceed available USDT'
                  ]"
                  bg-color="white"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col class="text-center">
                <v-btn
                  color="primary"
                  :disabled="!isSwapValid"
                  elevation="0"
                  rounded
                  large
                  @click="initiateSwap"
                >
                  Initiate Swap
                  <v-icon right>mdi-swap-horizontal</v-icon>
                </v-btn>
              </v-col>
            </v-row>
            <v-divider class="my-4 my-sm-6" />
            <v-row class="mb-4">
              <v-col cols="12" sm="6">
                <v-card flat class="pa-4 text-center">
                  <v-card-title class="text-body-1 font-weight-bold">
                    Total USDT Available
                  </v-card-title>
                  <v-card-text class="text-h6 primary--text">
                    {{ asset.totalUsdt }} USDT
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6">
                <v-card flat class="pa-4 text-center">
                  <v-card-title class="text-body-1 font-weight-bold">
                    Max DOKA to Purchase
                  </v-card-title>
                  <v-card-text class="text-h6 primary--text">
                    {{ maxDoka }} DOKA
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
            <!-- <v-subheader class="font-weight-bold">Recent Swaps</v-subheader>
            <v-list v-if="recentSwaps.length" two-line>
              <v-list-item v-for="swap in recentSwaps" :key="swap.id">
                <v-list-item-icon>
                  <v-icon color="primary">mdi-swap-horizontal</v-icon>
                </v-list-item-icon>
                <v-list-item-content>
                  <v-list-item-title>
                    {{ swap.fromCoin }} → {{ swap.toCoin }}
                  </v-list-item-title>
                  <v-list-item-subtitle>
                    Amount: {{ swap.amount }} | Status: {{ swap.status }} |
                    TxID: {{ swap.txId || 'N/A' }}
                  </v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
            </v-list> -->
            <!-- <v-list-item v-else>
              <v-list-item-title>No recent swaps</v-list-item-title>
            </v-list-item> -->
          </v-container>

          <!-- Success Popup -->
          <v-dialog v-model="showSuccessPopup" max-width="90%" width="400">
            <v-card rounded="lg">
              <v-card-title class="text-h6 primary--text">
                Buy Doka Successfully
              </v-card-title>
              <v-card-actions>
                <v-spacer />
                <v-btn color="primary" text @click="showSuccessPopup = false">
                  Close
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>
        </v-window-item>
      </v-window>
    </v-card>
  </v-container>
</template>

<script setup>
const assetStore = useAssetStore()
const { adminWallet, asset } = storeToRefs(assetStore)

const activeTab = ref('deposit')
const selectedCoin = ref('')
const selectedNetwork = ref('')
const swapFromCoin = ref('USDT')
const swapToCoin = ref('DOKA')
const swapAmount = ref('')
const transactionId = ref('')
const copySuccess = ref(false)
const verificationResult = ref(null)
const networkError = ref(null)
const showSuccessPopup = ref(false)
const latestTxId = ref('')
const coins = ['USDT']
const networks = ['ERC_20', 'BEP_20', 'PRC_20']
const recentSwaps = ref([
  {
    id: 1,
    fromCoin: 'BTC',
    toCoin: 'ETH',
    amount: 0.5,
    status: 'Completed',
    txId: 'tx123456789'
  },
  {
    id: 2,
    fromCoin: 'ETH',
    toCoin: 'USDT',
    amount: 2.0,
    status: 'Pending',
    txId: 'tx987654321'
  },
  {
    id: 3,
    fromCoin: 'USDT',
    toCoin: 'BNB',
    amount: 100,
    status: 'In Progress',
    txId: 'tx456789123'
  }
])

// Fetch initial data
await Promise.all([assetStore.getAdminWallet(), assetStore.getAsset()])

// Compute max USDT and max DOKA
const maxUsdt = computed(() => asset.value.totalUsdt || 0)
const maxDoka = computed(() => {
  const rate = 0.2 // 1 DOKA = 0.2 USD
  return maxUsdt.value / rate
})

const depositAddress = computed(() => {
  return selectedCoin.value && selectedNetwork.value
    ? `0x${selectedCoin.value.toLowerCase()}${selectedNetwork.value.toLowerCase()}123456789abcdef`
    : ''
})

const isSwapValid = computed(() => {
  return (
    swapFromCoin.value &&
    swapToCoin.value &&
    swapAmount.value > 0 &&
    swapAmount.value <= maxDoka.value
  )
})

// Methods
const generateQRCode = () => {
  // QR code regeneration logic remains unchanged
}

const copyAddress = async () => {
  if (depositAddress.value) {
    try {
      await navigator.clipboard.writeText(adminWallet.metamask)
      copySuccess.value = true
      setTimeout(() => {
        copySuccess.value = false
      }, 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }
}

const initiateSwap = async () => {
  if (isSwapValid.value) {
    const newTxId = `tx${Math.random().toString(36).substr(2, 9)}`
    recentSwaps.value.unshift({
      id: recentSwaps.value.length + 1,
      fromCoin: swapFromCoin.value,
      toCoin: swapToCoin.value,
      amount: parseFloat(swapAmount.value),
      status: 'Pending',
      txId: newTxId
    })
    try {
      await assetStore.swapDoka(swapAmount.value)
      latestTxId.value = newTxId
      showSuccessPopup.value = true
    } catch (err) {
      console.error('Swap failed:', err)
    }
  }
}

const verifyTransaction = async () => {
  // Kiểm tra nếu chưa chọn network
  if (!selectedNetwork.value) {
    networkError.value =
      'Please select a network before verifying the transaction.'
    setTimeout(() => {
      networkError.value = null
    }, 5000)
    return
  }

  if (transactionId.value) {
    const result = await assetStore.saveManualTransaction(
      transactionId.value,
      selectedNetwork.value
    )
    if (result && Number(result) > 0) {
      verificationResult.value = {
        type: 'success',
        message: 'Deposit success'
      }
    } else {
      verificationResult.value = {
        type: 'success',
        message:
          'Transaction is being processed. Please wait a moment; the funds will be credited to your account shortly.'
      }
    }
    setTimeout(() => {
      transactionId.value = ''
      verificationResult.value = null
    }, 5000)
  }
}
</script>

<style scoped>
.fill-height {
  min-height: calc(100vh - 24px);
}

.v-card {
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  width: 100%;
}

.address-section {
  background: #f5f5f5;
  padding: 8px;
  border-radius: 8px;
  max-width: 100%;
  margin: 0 auto;
  flex-wrap: wrap;
}

.address-text {
  font-family: 'Roboto Mono', monospace;
  font-size: clamp(0.75rem, 2.5vw, 0.85rem);
  color: #333;
  word-break: break-all;
  flex: 1;
  min-width: 0;
}

.v-btn {
  border-radius: 8px;
  text-transform: none;
  letter-spacing: 0.5px;
  transition: all 0.3s ease;
  font-size: clamp(0.8rem, 2.5vw, 0.9rem);
  padding: 8px 16px;
}

.v-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.v-tabs {
  border-bottom: 1px solid #e0e0e0;
}

.v-select {
  border-radius: 8px;
  font-size: clamp(0.8rem, 2.5vw, 0.9rem);
}

.v-alert {
  font-size: clamp(0.75rem, 2.5vw, 0.85rem);
}

.v-dialog {
  width: 90%;
  max-width: 400px;
}

@media (max-width: 600px) {
  .v-container {
    padding: 8px !important;
  }

  .v-card {
    padding: 12px;
    min-width: 100%;
  }

  .v-row {
    margin: 0;
  }

  .v-col {
    padding: 4px;
  }

  .address-section {
    flex-direction: column;
    gap: 8px;
    padding: 8px;
  }

  .v-btn {
    width: 100%;
    margin-top: 8px;
  }

  .v-tabs {
    flex-direction: column;
  }

  .v-tab {
    width: 100%;
    margin-bottom: 8px;
  }

  .v-card-title {
    font-size: clamp(0.9rem, 3vw, 1rem);
  }

  .v-card-text {
    font-size: clamp(0.8rem, 2.5vw, 0.9rem);
  }
}

@media (min-width: 600px) and (max-width: 960px) {
  .v-card {
    padding: 16px;
  }

  .address-section {
    padding: 10px;
  }

  .v-btn {
    padding: 10px 20px;
  }
}
</style>
