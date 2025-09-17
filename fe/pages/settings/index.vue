<template>
  <v-container fluid class="pa-0">
    <v-row no-gutters>
      <!-- Left sidebar for tabs -->
      <v-col cols="12" md="2" class="setting-sidebar">
        <v-card flat class="pa-4" color="grey-lighten-4" height="100%">
          <v-tabs
            v-model="tab"
            color="primary"
            direction="vertical"
            class="rounded-lg"
            bg-color="transparent"
          >
            <v-tab
              v-for="item in tabs"
              :key="item.value"
              :value="item.value"
              class="text-left py-3"
              :class="{ 'font-weight-bold': tab === item.value }"
            >
              <v-icon left size="20" class="mr-3">{{ item.icon }}</v-icon>
              {{ item.text }}
            </v-tab>
            <v-divider class="my-4"></v-divider>
            <v-tab value="invite-friend" class="text-left py-3">
              <v-icon left size="20" class="mr-3">mdi-account-plus</v-icon>
              Invite Friend
            </v-tab>
            <v-tab value="support" class="text-left py-3">
              <v-icon left size="20" class="mr-3">mdi-help-circle</v-icon>
              Support
            </v-tab>
          </v-tabs>
        </v-card>
      </v-col>

      <!-- Main content area -->
      <v-col cols="12" md="10" class="main-content pa-6">
        <v-window v-model="tab">
          <v-window-item value="password">
            <settings-password />
          </v-window-item>
          <v-window-item value="billings">
            <v-card flat class="pa-6 rounded-xl" elevation="2">
              <h2 class="text-h4 font-weight-bold mb-3">Payment Method</h2>
              <p class="text-body-1 text-grey-darken-1 mb-6">
                Manage your billing details and payment methods securely.
              </p>

              <!-- Card Details -->
              <v-card flat class="mb-6 pa-4 rounded-lg" color="grey-lighten-4">
                <h3 class="text-h6 font-weight-medium mb-4">Card Details</h3>
                <v-btn
                  color="primary"
                  variant="flat"
                  class="mb-6 rounded-pill"
                  prepend-icon="mdi-plus"
                >
                  Add Another Card
                </v-btn>
                <v-row>
                  <v-col cols="12" sm="6" md="4">
                    <v-text-field
                      label="Name on Card"
                      value="Maya Ahmed"
                      readonly
                      variant="outlined"
                      density="compact"
                      class="rounded-lg"
                    />
                  </v-col>
                  <v-col cols="12" sm="6" md="4">
                    <v-text-field
                      label="Expiry"
                      value="02 / 2028"
                      readonly
                      variant="outlined"
                      density="compact"
                      class="rounded-lg"
                    />
                  </v-col>
                  <v-col cols="12" sm="6" md="4">
                    <v-text-field
                      label="Card Number"
                      value="8299 8290 9229 2538"
                      readonly
                      prepend-inner-icon="mdi-credit-card"
                      variant="outlined"
                      density="compact"
                      class="rounded-lg"
                    />
                  </v-col>
                  <v-col cols="12" sm="6" md="4">
                    <v-text-field
                      label="CVV"
                      value="••••"
                      readonly
                      variant="outlined"
                      density="compact"
                      class="rounded-lg"
                    />
                  </v-col>
                </v-row>
              </v-card>

              <!-- Contact Email -->
              <v-card flat class="mb-6 pa-4 rounded-lg" color="grey-lighten-4">
                <h3 class="text-h6 font-weight-medium mb-4">Contact Email</h3>
                <p class="text-body-2 text-grey-darken-1 mb-4">
                  Choose where invoices should be sent.
                </p>
                <v-radio-group v-model="selectedEmail" column>
                  <v-radio
                    label="Send to mayaahmed@ofspace.co"
                    value="mayaahmed@ofspace.co"
                    color="primary"
                  />
                  <v-radio label="Add another email" value="add" color="primary" />
                </v-radio-group>
              </v-card>

              <!-- Billing History -->
              <v-card flat class="pa-4 rounded-lg" color="grey-lighten-4">
                <h3 class="text-h6 font-weight-medium mb-4">Billing History</h3>
                <p class="text-body-2 text-grey-darken-1 mb-4">
                  View your transaction history.
                </p>
                <v-data-table
                  v-model="selectedItems"
                  :headers="headers"
                  :items="billingHistory"
                  :items-per-page="5"
                  show-select
                  class="elevation-0 rounded-lg"
                  hover
                >
                  <template #item.status="{ item }">
                    <v-chip
                      :color="getStatusColor(item.status)"
                      size="small"
                      class="font-weight-medium"
                    >
                      {{ item.status }}
                    </v-chip>
                  </template>
                  <template #item.tracking="{ item }">
                    <div>
                      <span class="text-body-2">{{ item.tracking }}</span>
                      <br />
                      <span class="text-caption text-grey-darken-1">{{ item.address }}</span>
                    </div>
                  </template>
                </v-data-table>
              </v-card>
            </v-card>
          </v-window-item>
        </v-window>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { ref } from 'vue'

// Tab state
const tab = ref('billings')

// Email selection state
const selectedEmail = ref('mayaahmed@ofspace.co')

// Selected table items
const selectedItems = ref([])

// Tab items
const tabs = [
  { value: 'my-details', text: 'My Details', icon: 'mdi-account' },
  { value: 'profile', text: 'Profile', icon: 'mdi-account-circle' },
  { value: 'password', text: 'Password', icon: 'mdi-lock' },
  { value: 'team', text: 'Team', icon: 'mdi-account-group' },
  { value: 'billings', text: 'Billings', icon: 'mdi-credit-card' },
  { value: 'plan', text: 'Plan', icon: 'mdi-file-document' },
  { value: 'email', text: 'Email', icon: 'mdi-email' },
  { value: 'notifications', text: 'Notifications', icon: 'mdi-bell' },
]

// Table headers
const headers = [
  { title: 'Invoice', key: 'invoice' },
  { title: 'Date', key: 'date' },
  { title: 'Amount', key: 'amount' },
  { title: 'Status', key: 'status' },
  { title: 'Tracking & Address', key: 'tracking' },
]

// Billing history data
const billingHistory = [
  {
    invoice: 'Account Sale',
    date: 'Apr 14, 2004',
    amount: '$3,050',
    status: 'PENDING',
    tracking: 'LMS8040575CN',
    address: '313 Main Road, Sunderland',
  },
  {
    invoice: 'Account Sale',
    date: 'Jun 24, 2008',
    amount: '$1,050',
    status: 'CANCELLED',
    tracking: 'AZ9384503535US',
    address: '96 Grange Road, Peterborough',
  },
  {
    invoice: 'Netflix Subscription',
    date: 'Feb 28, 2004',
    amount: '$800',
    status: 'REFUND',
    tracking: '3S331605504US',
    address: '2 New Street, Harrogate',
  },
]

// Status chip color logic
const getStatusColor = (status) => {
  switch (status) {
    case 'PENDING':
      return 'blue-lighten-2'
    case 'CANCELLED':
      return 'red-lighten-2'
    case 'REFUND':
      return 'green-lighten-2'
    default:
      return 'grey-lighten-1'
  }
}
</script>

<style scoped>
.setting-sidebar {
  background-color: #f5f5f5;
  min-height: calc(100vh - 50px);
  max-height: calc(100vh - 50px);
  border-right: 1px solid #e0e0e0;
}

.main-content {
  background-color: #ffffff;
  min-height: calc(100vh - 50px);
  max-height: calc(100vh - 50px);
  overflow-y: auto;
  overflow-x: hidden;
}

.v-tab {
  text-transform: none;
  letter-spacing: 0;
  font-size: 0.95rem;
  color: #424242;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.v-tab--selected {
  background-color: #e3f2fd;
  color: #1976d2 !important;
}

.v-card {
  transition: box-shadow 0.3s ease;
}

.v-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.v-btn {
  text-transform: none;
  font-weight: 500;
}

.v-data-table {
  background-color: transparent;
}

.v-data-table :deep(.v-data-table__tr:hover) {
  background-color: #f5f5f5;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .setting-sidebar {
    min-height: auto;
    border-right: none;
    border-bottom: 1px solid #e0e0e0;
  }
  .main-content {
    padding: 16px;
  }
}
</style>
