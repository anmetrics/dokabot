<template>
  <v-container class="staking-container">
    <!-- Header Section -->
    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="staking-card elevation-5">
          <v-card-title class="headline">
            <v-icon large left color="amber">
              mdi-currency-btc
            </v-icon>
            Stake BTC for Alpha Tokens
            <v-spacer />
            <v-chip color="green" text-color="white" small>
              <v-icon left small>
                mdi-wallet
              </v-icon>
              {{ walletBalance }} BTC
            </v-chip>
          </v-card-title>

          <!-- Staking Input Section -->
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="btcAmount"
                  label="BTC Amount to Stake"
                  type="number"
                  :value="0.001"
                  readonly
                  prepend-inner-icon="mdi-currency-btc"
                  outlined
                  dense
                  color="amber"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="alphaAmount"
                  label="Alpha Tokens to Receive"
                  type="number"
                  :value="10000"
                  readonly
                  prepend-inner-icon="mdi-doka-t"
                  outlined
                  dense
                  color="green"
                />
              </v-col>
            </v-row>

            <!-- Staking Details -->
            <v-expansion-panels class="mt-4" flat>
              <v-expansion-panel>
                <v-expansion-panel-header>
                  <span class="font-weight-medium">Staking Details</span>
                </v-expansion-panel-header>
                <v-expansion-panel-content>
                  <v-list dense>
                    <v-list-item>
                      <v-list-item-content>Exchange Rate:</v-list-item-content>
                      <v-list-item-content class="align-end">
                        1 BTC = 10,000,000 ALPHA
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-content>Fee:</v-list-item-content>
                      <v-list-item-content class="align-end">
                        0.0001 BTC
                      </v-list-item-content>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-content>Estimated Time:</v-list-item-content>
                      <v-list-item-content class="align-end">
                        ~30 seconds
                      </v-list-item-content>
                    </v-list-item>
                  </v-list>
                </v-expansion-panel-content>
              </v-expansion-panel>
            </v-expansion-panels>

            <!-- Confirmation Checkbox -->
            <v-checkbox
              v-model="confirmStake"
              label="I agree to the staking terms and conditions"
              color="green"
              class="mt-4"
            />

            <!-- Stake Button -->
            <v-btn
              color="green"
              dark
              block
              large
              class="mt-4"
              :disabled="
                !confirmStake || isStaking || walletBalance < btcAmount
              "
              :loading="isStaking"
              @click="performStake"
            >
              <v-icon left>
                mdi-lock-open
              </v-icon>
              {{ isStaking ? "Processing..." : "Stake Now" }}
            </v-btn>

            <!-- Success/Error Alerts -->
            <v-alert
              v-if="stakeSuccess"
              type="success"
              class="mt-4"
              icon="mdi-check-circle"
              dense
            >
              Staking successful! You received 10,000 Alpha Tokens.
            </v-alert>
            <v-alert
              v-if="errorMessage"
              type="error"
              class="mt-4"
              icon="mdi-alert-circle"
              dense
            >
              {{ errorMessage }}
            </v-alert>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Staking History Section -->
    <v-row justify="center" class="mt-6">
      <v-col cols="12" md="8">
        <v-card class="history-card elevation-5">
          <v-card-title class="subtitle-1">
            <v-icon left color="blue">
              mdi-history
            </v-icon>
            Staking History
          </v-card-title>
          <v-data-table
            :headers="historyHeaders"
            :items="stakingHistory"
            :items-per-page="5"
            class="elevation-0"
            dense
          >
            <template #item.status="{ item }">
              <v-chip
                :color="item.status === 'Completed' ? 'green' : 'orange'"
                small
                dark
              >
                {{ item.status }}
              </v-chip>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog for Transaction Details -->
    <v-dialog v-model="dialog" max-width="500">
      <v-card class="transparent-card">
        <v-card-title class="headline green white--text">
          Transaction Confirmation
        </v-card-title>
        <v-card-text class="pt-4">
          <p>
            You are about to stake <strong>{{ btcAmount }} BTC</strong>.
          </p>
          <p>
            You will receive <strong>{{ alphaAmount }} Alpha Tokens</strong>.
          </p>
          <p>Fee: <strong>0.0001 BTC</strong></p>
          <p>Are you sure you want to proceed?</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text @click="dialog = false">
            Cancel
          </v-btn>
          <v-btn color="green" dark @click="confirmStakeAction">
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'

// State Management
const btcAmount = ref(0.001)
const alphaAmount = ref(10000)
const walletBalance = ref(0.005) // Giả lập số dư ví
const confirmStake = ref(false)
const isStaking = ref(false)
const stakeSuccess = ref(false)
const errorMessage = ref('')
const dialog = ref(false)

// Staking History
const stakingHistory = ref([])
const historyHeaders = [
  { text: 'Date', value: 'date' },
  { text: 'BTC Amount', value: 'btc' },
  { text: 'Alpha Tokens', value: 'doka' },
  { text: 'Status', value: 'status' }
]

// Methods
const performStake = () => {
  if (walletBalance.value < btcAmount.value) {
    errorMessage.value = 'Insufficient BTC balance!'
    return
  }
  dialog.value = true // Hiển thị dialog xác nhận
}

const confirmStakeAction = () => {
  dialog.value = false
  isStaking.value = true
  errorMessage.value = ''

  setTimeout(() => {
    isStaking.value = false
    stakeSuccess.value = true

    // Cập nhật số dư ví
    walletBalance.value -= btcAmount.value + 0.0001 // Trừ phí

    // Thêm vào lịch sử
    stakingHistory.value.push({
      date: new Date().toLocaleString(),
      btc: btcAmount.value,
      doka: alphaAmount.value,
      status: 'Completed'
    })

    // Reset trạng thái sau 5 giây
    setTimeout(() => {
      stakeSuccess.value = false
    }, 5000)
  }, 3000) // Giả lập thời gian xử lý 3 giây
}
</script>

<style scoped>
.staking-container {
  min-height: 100vh;
  padding-top: 40px;
}

.staking-card {
  border-radius: 12px;
  background: #ffffff;
  transition: all 0.3s ease;
}

.staking-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1) !important;
}

.history-card {
  border-radius: 12px;
  background: #ffffff;
}

.headline {
  background: linear-gradient(90deg, #ff8a00, #e52e71);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 600;
}

.v-text-field--outlined >>> fieldset {
  border-color: rgba(0, 0, 0, 0.1);
}

.v-btn {
  border-radius: 8px;
  text-transform: none;
  font-weight: 500;
}

.transparent-card {
  background-color: transparent !important;
  box-shadow: none !important;
}
</style>
