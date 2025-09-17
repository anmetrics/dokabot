<template>
  <v-container>
    <v-card>
      <v-card-title>Transactions</v-card-title>
      <v-tabs v-model="activeTab">
        <v-tab value="deposit">Deposit</v-tab>
        <v-tab value="swap">Swap</v-tab>
      </v-tabs>

      <v-card-text>
        <v-window v-model="activeTab">
          <v-window-item value="deposit">
            <v-container class="deposit-container">
              <v-card class="mx-auto pa-12" elevation="0" rounded="xl">
                <v-card-title
                  class="text-h4 text-center primary white--text py-5"
                >
                  Deposit
                </v-card-title>

                <!-- Coin and Network Selection -->
                <v-card-text class="py-8">
                  <v-row>
                    <v-col cols="12" md="6">
                      <v-select
                        v-model="selectedCoin"
                        :items="coins"
                        label="Select Coin"
                        outlined
                        dense
                        color="primary"
                        class="mb-4"
                        prepend-icon="mdi-currency-usd"
                        background-color="white"
                      />
                    </v-col>
                    <v-col cols="12" md="6">
                      <v-select
                        v-model="selectedNetwork"
                        :items="networks"
                        label="Select Network"
                        outlined
                        dense
                        color="primary"
                        class="mb-4"
                        prepend-icon="mdi-network"
                        background-color="white"
                      />
                    </v-col>
                  </v-row>

                  <!-- QR Code Section -->
                  <v-card
                    v-if="selectedCoin && selectedNetwork"
                    class="pa-6 text-center qr-card"
                    elevation="0"
                    rounded="lg"
                  >
                    <v-card-title class="text-h5 primary--text">
                      Scan to Deposit
                    </v-card-title>
                    <qr-code :data="23432" />
                    <v-btn
                      color="success"
                      class="text-white pa-4 mb-6"
                      elevation="0"
                      @click="generateQRCode"
                    >
                      Regenerate QR
                      <v-icon right size="large">mdi-refresh</v-icon>
                    </v-btn>
                    <!-- Deposit Address Section -->
                    <div
                      class="address-section d-flex align-center justify-center"
                    >
                      <span class="address-text mr-4">
                        {{ depositAddress }}
                      </span>
                      <v-btn
                        color="primary"
                        class="text-white pa-3"
                        elevation="0"
                        @click="copyAddress"
                      >
                        Copy
                        <v-icon right>mdi-content-copy</v-icon>
                      </v-btn>
                    </div>
                  </v-card>
                  <v-alert
                    v-else
                    type="info"
                    class="mt-6"
                    outlined
                    color="primary"
                  >
                    Please select a coin and network to generate a QR code.
                  </v-alert>
                </v-card-text>
              </v-card>
            </v-container>
          </v-window-item>
          <v-window-item value="swap">
            <v-card class="mx-auto pa-6" elevation="0" rounded="lg">
              <v-card-title class="text-h5 text-center">Swap</v-card-title>
              <v-card-text>
                <v-list>
                  <v-list-item
                    v-for="n in 3"
                    :key="n"
                    :title="`Swap #${n}`"
                    subtitle="In Progress"
                  />
                </v-list>
              </v-card-text>
            </v-card>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
export default {
  name: 'Transactions',
  data() {
    return {
      activeTab: 'deposit',
      selectedCoin: '',
      selectedNetwork: '',
      coins: ['BTC', 'ETH', 'USDT', 'BNB'],
      networks: ['ERC_20', 'BEP_20', 'PRC_20']
    }
  },
  computed: {
    depositAddress() {
      return this.selectedCoin && this.selectedNetwork
        ? `0x${this.selectedCoin.toLowerCase()}${this.selectedNetwork.toLowerCase()}123456789abcdef`
        : ''
    }
  },
  methods: {
    async copyAddress() {
      if (this.depositAddress) {
        try {
          await navigator.clipboard.writeText(this.depositAddress)
          alert('Address copied to clipboard!')
        } catch (err) {
          alert('Failed to copy address: ' + err)
        }
      }
    }
  }
}
</script>

<style scoped>
.deposit-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 90vh;
  background-color: #ffffff;
}

.v-card {
  max-width: 700px;
  width: 100%;
  background: #ffffff;
  border: 1px solid #e0e0e0;
}

.qr-card {
  background-color: #f9f9f9;
  border-radius: 16px;
  margin-top: 16px;
}

.v-select {
  border-radius: 8px;
}

.v-select .v-field {
  background-color: #ffffff !important;
}

.v-select.v-input--is-focused .v-input__control {
  border-color: #1976d2 !important;
  box-shadow: 0 0 8px rgba(25, 118, 210, 0.2);
}

.v-btn {
  padding: 12px 32px !important;
  font-size: 1.1rem;
  border-radius: 8px;
  transition: transform 0.2s ease;
}

.v-btn:hover {
  transform: translateY(-2px);
}

.text-white {
  color: white !important;
}

.address-section {
  max-width: 500px;
  margin: 0 auto;
}

.address-text {
  font-family: monospace;
  font-size: 1rem;
  color: #333;
  word-break: break-all;
  max-width: 300px;
}

.address-section .v-btn {
  padding: 8px 16px !important;
  font-size: 0.9rem;
}
</style>
