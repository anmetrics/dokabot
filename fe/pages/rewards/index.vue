<template>
  <v-container fluid class="rewards-page pa-0">
    <!-- Hero Section -->
    <v-parallax
      dark
      src="https://images.unsplash.com/photo-1620121692029-d088224ddc74?auto=format&fit=crop&w=1920&q=80"
      height="400"
    >
      <v-row align="center" justify="center">
        <v-col class="text-center" cols="12">
          <h1
            class="text-h2 font-weight-bold mb-4 animate__animated animate__fadeInDown"
          >
            DOKA Rewards Program
          </h1>
          <h4 class="subheading text-h5 animate__animated animate__fadeInUp">
            Unlock Exclusive Rewards and Elevate Your Experience!
          </h4>
        </v-col>
      </v-row>
    </v-parallax>

    <v-container class="py-12">
      <v-row justify="center">
        <v-col cols="12" md="10" lg="8">
          <!-- Reward Tiers Overview -->
          <v-card class="mb-12 elevation-12" rounded="xl">
            <v-card-title
              class="text-h4 font-weight-bold primary--text text-center py-6"
            >
              <v-icon left x-large color="primary">mdi-crown</v-icon>
              Reward Tiers
            </v-card-title>
            <v-card-text>
              <v-row>
                <v-col v-for="tier in tiers" :key="tier.name" cols="12" sm="4">
                  <v-card
                    :color="tier.color"
                    class="tier-card pa-4 text-center"
                    :class="{ 'active-tier': currentTier === tier.name }"
                    outlined
                    @click="selectTier(tier.name)"
                  >
                    <v-icon x-large :color="tier.iconColor">
                      {{ tier.icon }}
                    </v-icon>
                    <h3 class="text-h6 font-weight-bold mt-2">
                      {{ tier.name }}
                    </h3>
                    <p class="caption">{{ tier.description }}</p>
                    <v-progress-linear
                      :value="tierProgress(tier.points)"
                      :color="tier.iconColor"
                      height="8"
                      rounded
                      class="mt-2"
                    />
                    <div class="caption mt-1">
                      {{ userPoints }}/{{ tier.points }} Points
                    </div>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <!-- Rewards Section -->
          <v-card class="elevation-12 mb-12" rounded="xl">
            <v-card-title class="text-h4 font-weight-bold primary--text py-6">
              <v-icon left x-large color="primary">mdi-gift</v-icon>
              Available Rewards
            </v-card-title>
            <v-card-text>
              <!-- Referral Reward -->
              <v-expansion-panels flat class="mb-4">
                <v-expansion-panel>
                  <v-expansion-panel-header>
                    <v-row align="center">
                      <v-col cols="2" class="text-center">
                        <v-icon large color="primary">mdi-account-group</v-icon>
                      </v-col>
                      <v-col cols="7">
                        <strong class="text-h6">Refer Friends</strong>
                        <div class="caption">
                          Invite friends and earn up to 1000 DOKA!
                        </div>
                      </v-col>
                      <v-col cols="3" class="text-center">
                        <v-chip color="primary" small>
                          {{ referrals }}/10
                        </v-chip>
                      </v-col>
                    </v-row>
                  </v-expansion-panel-header>
                  <v-expansion-panel-content>
                    <v-row>
                      <v-col cols="12" sm="6">
                        <v-slider
                          v-model="referrals"
                          :max="10"
                          :color="
                            referralProgress >= 100 ? 'success' : 'primary'
                          "
                          thumb-label
                          readonly
                          class="mt-4"
                        />
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-list dense>
                          <v-list-item
                            v-for="milestone in referralMilestones"
                            :key="milestone.count"
                          >
                            <v-list-item-content>
                              <v-list-item-title>
                                {{ milestone.count }} Referrals:
                                {{ milestone.reward }} DOKA
                              </v-list-item-title>
                            </v-list-item-content>
                            <v-list-item-action>
                              <v-icon
                                :color="
                                  referrals >= milestone.count
                                    ? 'success'
                                    : 'grey'
                                "
                              >
                                {{
                                  referrals >= milestone.count
                                    ? 'mdi-check-circle'
                                    : 'mdi-circle-outline'
                                }}
                              </v-icon>
                            </v-list-item-action>
                          </v-list-item>
                        </v-list>
                      </v-col>
                    </v-row>
                  </v-expansion-panel-content>
                </v-expansion-panel>
              </v-expansion-panels>

              <!-- Deposit Reward -->
              <v-expansion-panels flat class="mb-4">
                <v-expansion-panel>
                  <v-expansion-panel-header>
                    <v-row align="center">
                      <v-col cols="2" class="text-center">
                        <v-icon large color="primary">mdi-wallet</v-icon>
                      </v-col>
                      <v-col cols="7">
                        <strong class="text-h6">Deposit Milestones</strong>
                        <div class="caption">
                          Deposit USDT to earn massive DOKA rewards!
                        </div>
                      </v-col>
                      <v-col cols="3" class="text-center">
                        <v-chip
                          :color="depositCompleted ? 'success' : 'grey'"
                          small
                        >
                          {{ depositCompleted ? 'Completed' : 'Pending' }}
                        </v-chip>
                      </v-col>
                    </v-row>
                  </v-expansion-panel-header>
                  <v-expansion-panel-content>
                    <v-row>
                      <v-col cols="12">
                        <v-timeline dense>
                          <v-timeline-item
                            v-for="milestone in depositMilestones"
                            :key="milestone.amount"
                            :color="
                              userDeposit >= milestone.amount
                                ? 'success'
                                : 'grey'
                            "
                            small
                          >
                            <v-row class="pt-1">
                              <v-col>
                                <strong>
                                  Deposit {{ milestone.amount }} USDT
                                </strong>
                                <div class="caption">
                                  Reward: {{ milestone.reward }} DOKA
                                </div>
                              </v-col>
                            </v-row>
                          </v-timeline-item>
                        </v-timeline>
                      </v-col>
                    </v-row>
                  </v-expansion-panel-content>
                </v-expansion-panel>
              </v-expansion-panels>

              <!-- Daily Task Reward -->
              <v-expansion-panels flat class="mb-4">
                <v-expansion-panel>
                  <v-expansion-panel-header>
                    <v-row align="center">
                      <v-col cols="2" class="text-center">
                        <v-icon large color="primary">
                          mdi-checkbox-marked-circle
                        </v-icon>
                      </v-col>
                      <v-col cols="7">
                        <strong class="text-h6">Daily Tasks</strong>
                        <div class="caption">
                          Complete daily tasks to earn bonus DOKA!
                        </div>
                      </v-col>
                      <v-col cols="3" class="text-center">
                        <v-chip color="primary" small>
                          {{ dailyTasksCompleted }}/3
                        </v-chip>
                      </v-col>
                    </v-row>
                  </v-expansion-panel-header>
                  <v-expansion-panel-content>
                    <v-row>
                      <v-col cols="12">
                        <v-list>
                          <v-list-item
                            v-for="task in dailyTasks"
                            :key="task.id"
                          >
                            <v-list-item-content>
                              <v-list-item-title>
                                {{ task.title }}
                              </v-list-item-title>
                              <v-list-item-subtitle>
                                {{ task.reward }} DOKA
                              </v-list-item-subtitle>
                            </v-list-item-content>
                            <v-list-item-action>
                              <v-btn
                                small
                                :color="task.completed ? 'success' : 'primary'"
                                :disabled="task.completed"
                                @click="completeTask(task.id)"
                              >
                                {{ task.completed ? 'Completed' : 'Claim' }}
                              </v-btn>
                            </v-list-item-action>
                          </v-list-item>
                        </v-list>
                      </v-col>
                    </v-row>
                  </v-expansion-panel-content>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card-text>
            <v-card-actions class="justify-center pb-6">
              <v-btn
                color="primary"
                x-large
                rounded
                :loading="isLoading"
                @click="handleAction"
                class="px-8 animate__animated animate__pulse animate__infinite"
              >
                <v-icon left>mdi-rocket</v-icon>
                Claim Rewards Now
              </v-btn>
            </v-card-actions>
          </v-card>

          <!-- Referral Code Section -->
          <v-card flat class="text-center pa-6">
            <v-card-text>
              <p class="text-h5 mb-4">Your Referral Code</p>
              <v-text-field
                :value="referralCode"
                readonly
                outlined
                dense
                append-icon="mdi-content-copy"
                @click:append="copyReferralCode"
                class="referral-code-input mx-auto"
                style="max-width: 400px"
              />
              <v-slide-y-transition>
                <v-alert
                  v-if="showCopySuccess"
                  type="success"
                  dense
                  text
                  class="mt-2 mx-auto"
                  style="max-width: 400px"
                >
                  Referral code copied!
                </v-alert>
              </v-slide-y-transition>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Snackbar for Notifications -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      timeout="3000"
      bottom
      rounded="pill"
    >
      {{ snackbar.message }}
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useClipboard } from '@vueuse/core'

// Mock data (replace with actual API calls)
const referrals = ref(3)
const userDeposit = ref(2000)
const depositCompleted = ref(false)
const referralCode = ref('DOKA2025')
const isLoading = ref(false)
const showCopySuccess = ref(false)
const userPoints = ref(1500)
const currentTier = ref('Silver')
const dailyTasksCompleted = ref(1)
const isVIP = ref(false)

const snackbar = ref({
  show: false,
  message: '',
  color: 'success'
})

const tiers = [
  {
    name: 'Bronze',
    points: 1000,
    icon: 'mdi-medal',
    color: '#cd7f32',
    iconColor: 'brown',
    description: 'Entry-level rewards'
  },
  {
    name: 'Silver',
    points: 2500,
    icon: 'mdi-medal',
    color: '#c0c0c0',
    iconColor: 'grey',
    description: 'Enhanced benefits'
  },
  {
    name: 'Gold',
    points: 5000,
    icon: 'mdi-medal',
    color: '#ffd700',
    iconColor: 'yellow',
    description: 'Premium perks'
  }
]

const referralMilestones = [
  { count: 2, reward: 100 },
  { count: 5, reward: 300 },
  { count: 10, reward: 1000 }
]

const depositMilestones = [
  { amount: 1000, reward: 500 },
  { amount: 3000, reward: 1500 },
  { amount: 5000, reward: 3000 }
]

const dailyTasks = ref([
  { id: 1, title: 'Log in to your account', reward: 50, completed: true },
  { id: 2, title: 'Complete a transaction', reward: 100, completed: false },
  { id: 3, title: 'Share on social media', reward: 75, completed: false }
])

const referralProgress = computed(() => (referrals.value / 10) * 100)

const tierProgress = points =>
  computed(() => (userPoints.value / points) * 100).value

const { copy } = useClipboard()

const copyReferralCode = async () => {
  try {
    await copy(referralCode.value)
    showCopySuccess.value = true
    setTimeout(() => (showCopySuccess.value = false), 2000)
  } catch (error) {
    snackbar.value = {
      show: true,
      message: 'Failed to copy referral code!',
      color: 'error'
    }
  }
}

const selectTier = tierName => {
  // Simulate tier selection logic
  currentTier.value = tierName
  snackbar.value = {
    show: true,
    message: `Selected ${tierName} tier!`,
    color: 'success'
  }
}

const completeTask = taskId => {
  const task = dailyTasks.value.find(t => t.id === taskId)
  if (task && !task.completed) {
    task.completed = true
    dailyTasksCompleted.value++
    snackbar.value = {
      show: true,
      message: `Task completed! You earned ${task.reward} DOKA!`,
      color: 'success'
    }
  }
}

const upgradeToVIP = () => {
  isVIP.value = true
  snackbar.value = {
    show: true,
    message: 'Upgraded to VIP! Enjoy exclusive rewards!',
    color: 'success'
  }
}

const handleAction = async () => {
  isLoading.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    snackbar.value = {
      show: true,
      message: 'Rewards claimed successfully!',
      color: 'success'
    }
  } catch (error) {
    snackbar.value = {
      show: true,
      message: 'Error claiming rewards. Please try again!',
      color: 'error'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.rewards-page {
  background: linear-gradient(180deg, #e3f2fd 0%, #ffffff 100%);
}

.tier-card {
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.tier-card:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.active-tier {
  border: 2px solid #1976d2 !important;
}

.v-parallax {
  border-bottom: 4px solid #1976d2;
}

.referral-code-input {
  font-family: 'Roboto Mono', monospace;
  font-size: 1.2rem;
}

.v-expansion-panel {
  border-bottom: 1px solid #e0e0e0;
}

.animate__pulse {
  animation-duration: 2s;
}

@media (max-width: 600px) {
  .text-h2 {
    font-size: 2rem !important;
  }
  .text-h5 {
    font-size: 1.25rem !important;
  }
  .tier-card {
    margin-bottom: 16px;
  }
}
</style>
