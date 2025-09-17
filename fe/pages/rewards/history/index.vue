<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">Reward History</h1>
      </v-col>
    </v-row>

    <!-- Filter Section -->
    <v-row>
      <v-col cols="12" md="4">
        <v-text-field
          v-model="search"
          label="Search by description"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          clearable
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-select
          v-model="filterType"
          :items="rewardTypes"
          label="Reward Type"
          variant="outlined"
          clearable
        />
      </v-col>
      <v-col cols="12" md="4">
        <v-menu>
          <template v-slot:activator="{ props }">
            <v-text-field
              :model-value="dateRangeText"
              label="Date Range"
              prepend-inner-icon="mdi-calendar"
              variant="outlined"
              readonly
              v-bind="props"
            />
          </template>
          <v-date-picker v-model="dates" range title="Select Date Range" />
        </v-menu>
      </v-col>
    </v-row>

    <!-- Data Table -->
    <v-data-table
      :headers="headers"
      :items="filteredRewards"
      :search="search"
      :loading="loading"
      class="elevation-1"
      :items-per-page="10"
    >
      <template v-slot:item.date="{ item }">
        {{ formatDate(item.date) }}
      </template>
      <template v-slot:item.points="{ item }">
        <span :class="item.points > 0 ? 'text-green' : 'text-red'">
          {{ item.points > 0 ? '+' : '' }}{{ item.points }}
        </span>
      </template>
      <template v-slot:item.status="{ item }">
        <v-chip :color="getStatusColor(item.status)" small>
          {{ item.status }}
        </v-chip>
      </template>
    </v-data-table>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { format } from 'date-fns'

// Define table headers
const headers = [
  { title: 'Date', key: 'date', sortable: true },
  { title: 'Description', key: 'description', sortable: true },
  { title: 'Points', key: 'points', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Status', key: 'status', sortable: true }
]

// Sample data
const rewards = ref([
  {
    date: new Date('2025-06-01'),
    description: 'Daily login bonus',
    points: 50,
    type: 'Bonus',
    status: 'Completed'
  },
  {
    date: new Date('2025-06-02'),
    description: 'Purchase reward',
    points: 100,
    type: 'Purchase',
    status: 'Completed'
  },
  {
    date: new Date('2025-06-03'),
    description: 'Points redemption',
    points: -75,
    type: 'Redemption',
    status: 'Pending'
  }
])

// Filter variables
const search = ref('')
const filterType = ref(null)
const dates = ref([])
const rewardTypes = ['Bonus', 'Purchase', 'Redemption']
const loading = ref(false)

// Computed properties
const dateRangeText = computed(() => {
  return dates.value.length === 2
    ? `${format(dates.value[0], 'MMM dd, yyyy')} - ${format(
        dates.value[1],
        'MMM dd, yyyy'
      )}`
    : ''
})

const filteredRewards = computed(() => {
  return rewards.value.filter(reward => {
    const matchesType = filterType.value
      ? reward.type === filterType.value
      : true
    const matchesDate =
      dates.value.length === 2
        ? reward.date >= dates.value[0] && reward.date <= dates.value[1]
        : true
    return matchesType && matchesDate
  })
})

// Helper functions
const formatDate = date => {
  return format(new Date(date), 'MMM dd, yyyy HH:mm')
}

const getStatusColor = status => {
  return (
    {
      Completed: 'green',
      Pending: 'orange',
      Failed: 'red'
    }[status] || 'grey'
  )
}
</script>

<style scoped>
.text-green {
  color: #4caf50;
}
.text-red {
  color: #f44336;
}
</style>
