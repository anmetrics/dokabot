<template>
  <v-container fluid class="pa-4">
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span class="text-h6 font-weight-medium">Transaction History</span>
        <v-btn icon>
          <v-icon>mdi-export</v-icon>
        </v-btn>
      </v-card-title>

      <!-- Filters -->
      <v-card-text>
        <v-row dense>
          <v-col cols="12" md="4">
            <v-text-field v-model="search" label="Search Transaction..." prepend-inner-icon="mdi-magnify" />
          </v-col>
          <v-col cols="6" md="2">
            <v-select v-model="filters.type" :items="types" label="Type" clearable />
          </v-col>
          <v-col cols="6" md="2">
            <v-select v-model="filters.coin" :items="coins" label="Coin" clearable />
          </v-col>
          <v-col cols="6" md="2">
            <v-select v-model="filters.status" :items="statuses" label="Status" clearable />
          </v-col>
          <v-col cols="6" md="2">
            <v-select v-model="filters.dateRange" :items="dateRanges" label="Last" clearable />
          </v-col>
        </v-row>
      </v-card-text>

      <!-- Table -->
      <v-data-table
        :headers="headers"
        :items="filteredTransactions"
        item-value="name"
        class="elevation-1"
        hide-default-footer
      >
        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" small>
            {{ item.status }}
          </v-chip>
        </template>
        <template #item.action="{ item }">
          <v-btn icon>
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'

const search = ref('')
const filters = ref({
  type: null,
  coin: null,
  status: null,
  dateRange: null
})

const types = ['Buy', 'Sell', 'Trade', 'Airdrop', 'Reward', 'Received']
const coins = ['ETH', 'SOL', 'ADA', 'USD']
const statuses = ['Completed', 'Pending', 'Canceled']
const dateRanges = ['Last 7 days', 'Last 30 days', 'This year']

const headers = [
  { title: 'Date', key: 'date' },
  { title: 'Transaction Name', key: 'name' },
  { title: 'Type', key: 'type' },
  { title: 'Amount', key: 'amount' },
  { title: 'Status', key: 'status' },
  { title: 'Action', key: 'action', sortable: false }
]

const transactions = ref([
  { date: 'April 22, 2025', name: 'ETH instant Sell', type: 'Sell', amount: '+$821.66\n-0.50 ETH', status: 'Completed' },
  { date: 'April 22, 2025', name: 'Trade SOL to ADA', type: 'Trade', amount: '+1.02 ADA\n-300.25 SOL', status: 'Canceled' },
  { date: 'April 21, 2025', name: 'Solana Airdrop Reward', type: 'Airdrop', amount: '+1.50 SOL', status: 'Completed' },
  { date: 'April 21, 2025', name: 'ETH Limit Buy', type: 'Buy', amount: '+1.00 ETH\n-$1,643.32', status: 'Pending' },
  { date: 'April 20, 2025', name: 'Referral Bonus', type: 'Reward', amount: '+$5.00', status: 'Completed' },
  { date: 'April 19, 2025', name: 'ETH Limit Buy', type: 'Buy', amount: '+0.50 ETH\n-$821.66', status: 'Pending' },
  { date: 'April 19, 2025', name: 'ETH Instant Buy', type: 'Buy', amount: '+1.00 ETH\n-$1,643.32', status: 'Canceled' },
  { date: 'April 18, 2025', name: 'Receive from Wallet', type: 'Received', amount: '+0.50 ETH', status: 'Completed' },
  { date: 'April 18, 2025', name: 'Airdrop – Project Cardano', type: 'Airdrop', amount: '+100.00 ADA', status: 'Completed' }
])

const filteredTransactions = computed(() => {
  return transactions.value.filter((tx) => {
    const matchesSearch = tx.name.toLowerCase().includes(search.value.toLowerCase())
    const matchesType = !filters.value.type || tx.type === filters.value.type
    const matchesStatus = !filters.value.status || tx.status === filters.value.status
    return matchesSearch && matchesType && matchesStatus
  })
})

const statusColor = (status) => {
  switch (status) {
    case 'Completed':
      return 'green'
    case 'Pending':
      return 'orange'
    case 'Canceled':
      return 'red'
    default:
      return 'grey'
  }
}
</script>
