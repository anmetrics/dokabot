<template>
  <v-container fluid class="account-container">
    <!-- Header Section -->
    <v-row justify="center">
      <v-col cols="12" md="10">
        <v-card class="account-card elevation-4" rounded="lg">
          <v-card-title class="headline py-4">
            <v-icon left color="blue" size="32">mdi-account-circle</v-icon>
            <span class="text-h5 font-weight-bold">Account Overview</span>
            <v-spacer />
            <v-chip
              color="blue-lighten-1"
              text-color="white"
              small
              class="chip-status"
            >
              <v-icon left small>mdi-shield-check</v-icon>
              Verified
            </v-chip>
          </v-card-title>

          <!-- Account Info -->
          <v-card-text class="pa-6">
            <v-row>
              <v-col cols="12" md="6">
                <v-list dense>
                  <v-list-item>
                    <v-list-item-content>
                      <span class="text-subtitle-2 font-weight-medium">
                        Username:
                      </span>
                    </v-list-item-content>
                    <v-list-item-content class="text-right">
                      {{ userInfo.username }}
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-content>
                      <span class="text-subtitle-2 font-weight-medium">
                        Email:
                      </span>
                    </v-list-item-content>
                    <v-list-item-content class="text-right">
                      {{ userInfo.email }}
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-content>
                      <span class="text-subtitle-2 font-weight-medium">
                        Joined:
                      </span>
                    </v-list-item-content>
                    <v-list-item-content class="text-right">
                      {{ userInfo.joinedDate }}
                    </v-list-item-content>
                  </v-list-item>
                </v-list>
              </v-col>
              <v-col cols="12" md="6">
                <v-list dense>
                  <v-list-item>
                    <v-list-item-content>
                      <span class="text-subtitle-2 font-weight-medium">
                        Total Balance:
                      </span>
                    </v-list-item-content>
                    <v-list-item-content class="text-right">
                      {{ userInfo.totalBalance.toFixed(4) }} BTC
                    </v-list-item-content>
                  </v-list-item>
                  <v-list-item>
                    <v-list-item-content>
                      <span class="text-subtitle-2 font-weight-medium">
                        Last Login:
                      </span>
                    </v-list-item-content>
                    <v-list-item-content class="text-right">
                      {{ userInfo.lastLogin }}
                    </v-list-item-content>
                  </v-list-item>
                </v-list>
              </v-col>
            </v-row>

            <!-- Action Buttons -->
            <div class="action-buttons mt-4">
              <doka-button
                label="Edit Profile"
                color="blue"
                size="medium"
                variant="outlined"
                :width="150"
                @click="openEditProfileDialog"
              >
                <template #prepend>
                  <v-icon>mdi-pencil</v-icon>
                </template>
              </doka-button>
              <doka-button
                label="Logout"
                color="red"
                size="medium"
                variant="outlined"
                :width="150"
                @click="logout"
              >
                <template #prepend>
                  <v-icon>mdi-logout</v-icon>
                </template>
              </doka-button>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Wallet Section -->
    <v-row justify="center" class="mt-6">
      <v-col cols="12" md="10">
        <v-card class="wallet-card elevation-4" rounded="lg">
          <v-card-title class="subtitle-1 py-4">
            <v-icon left color="amber">mdi-wallet</v-icon>
            <span class="text-subtitle-1 font-weight-bold">Wallets</span>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="walletHeaders"
              :items="wallets"
              :items-per-page="5"
              class="elevation-0"
              density="compact"
            >
              <template #item.actions="{ item }">
                <doka-button
                  label="Deposit"
                  color="green"
                  size="small"
                  variant="text"
                  @click="deposit(item)"
                >
                  <template #prepend>
                    <v-icon>mdi-download</v-icon>
                  </template>
                </doka-button>
                <doka-button
                  label="Withdraw"
                  color="orange"
                  size="small"
                  variant="text"
                  @click="withdraw(item)"
                >
                  <template #prepend>
                    <v-icon>mdi-upload</v-icon>
                  </template>
                </doka-button>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Transaction History Section -->
    <v-row justify="center" class="mt-6">
      <v-col cols="12" md="10">
        <v-card class="history-card elevation-4" rounded="lg">
          <v-card-title class="subtitle-1 py-4">
            <v-icon left color="blue">mdi-history</v-icon>
            <span class="text-subtitle-1 font-weight-bold">
              Transaction History
            </span>
          </v-card-title>
          <v-card-text>
            <v-data-table
              :headers="historyHeaders"
              :items="transactionHistory"
              :items-per-page="5"
              class="elevation-0"
              density="compact"
            >
              <template #item.status="{ item }">
                <v-chip
                  :color="item.status === 'Completed' ? 'green' : 'orange'"
                  size="small"
                  variant="tonal"
                >
                  {{ item.status }}
                </v-chip>
              </template>
            </v-data-table>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Edit Profile Dialog -->
    <v-dialog v-model="editProfileDialog" max-width="500">
      <v-card rounded="lg">
        <v-card-title class="text-h6 font-weight-bold py-4 blue white--text">
          Edit Profile
        </v-card-title>
        <v-card-text class="pa-6">
          <v-text-field
            v-model="userInfo.username"
            label="Username"
            variant="outlined"
            density="compact"
            class="mb-4"
          />
          <v-text-field
            v-model="userInfo.email"
            label="Email"
            variant="outlined"
            density="compact"
          />
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <doka-button
            label="Cancel"
            color="grey"
            size="medium"
            variant="outlined"
            @click="editProfileDialog = false"
          />
          <doka-button
            label="Save"
            color="blue"
            size="medium"
            @click="saveProfile"
          />
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'

// State Management
const userInfo = ref({
  username: 'john_doe',
  email: 'john.doe@example.com',
  joinedDate: 'May 31, 2024',
  totalBalance: 0.005,
  lastLogin: 'May 31, 2025, 04:09 PM'
})

const wallets = ref([
  { asset: 'Bitcoin (BTC)', balance: 0.005, price: 107670.12 },
  { asset: 'Ethereum (ETH)', balance: 0.0, price: 2652.56 },
  { asset: 'Tether (USDT)', balance: 0.0, price: 1.0 }
])

const walletHeaders = [
  { text: 'Asset', value: 'asset' },
  { text: 'Balance', value: 'balance' },
  { text: 'Price', value: 'price' },
  { text: 'Actions', value: 'actions', sortable: false }
]

const transactionHistory = ref([
  {
    date: 'May 31, 2025, 03:00 PM',
    type: 'Staking',
    amount: 0.001,
    status: 'Completed'
  },
  {
    date: 'May 30, 2025, 10:00 AM',
    type: 'Deposit',
    amount: 0.005,
    status: 'Completed'
  }
])

const historyHeaders = [
  { text: 'Date', value: 'date' },
  { text: 'Type', value: 'type' },
  { text: 'Amount (BTC)', value: 'amount' },
  { text: 'Status', value: 'status' }
]

const editProfileDialog = ref(false)

// Methods
const openEditProfileDialog = () => {
  editProfileDialog.value = true
}

const saveProfile = () => {
  editProfileDialog.value = false
  // Logic lưu profile (gọi API hoặc cập nhật state)
}

const logout = () => {
  // Logic đăng xuất
  localStorage.removeItem('token')
  navigateTo('/authentication/login')
}

const deposit = item => {
  // Logic xử lý deposit
  alert(`Deposit for ${item.asset}`)
}

const withdraw = item => {
  // Logic xử lý withdraw
  alert(`Withdraw for ${item.asset}`)
}
</script>

<style scoped>
.account-container {
  min-height: 100vh;
  padding: 32px 16px;
  background: linear-gradient(135deg, #e8f0fe 0%, #f5f7fb 100%);
}

.account-card,
.wallet-card,
.history-card {
  border-radius: 16px;
  background: #ffffff;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
  }
}

.headline {
  background: linear-gradient(90deg, #1e88e5, #42a5f5);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 700;
}

.chip-status {
  border-radius: 8px;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.v-data-table :deep(.v-data-table__td) {
  padding: 8px 16px !important;
}

@media (max-width: 600px) {
  .account-card,
  .wallet-card,
  .history-card {
    margin: 0 -16px;
  }

  .v-card-title {
    flex-wrap: wrap;
    text-align: center;
  }

  .chip-status {
    margin-top: 8px;
  }
}
</style>
