<script lang="ts" setup>
import { VNodeRef } from 'vue'
import { RegisterPayload } from '~/store/types/authentication'

definePageMeta({
  layout: 'anonymous'
})

const currentStep = ref(1)
const registerForm = ref<VNodeRef | null>(null)
const payload = reactive<RegisterPayload>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  referrer: ''
})

const authenticationStore = useAuthenticationStore()
const { isLoading, currentUser } = storeToRefs(authenticationStore)
const shouldVerify = useCookie('__shouldVerify')

if (shouldVerify.value) {
  await authenticationStore.fetchMe()
  if (currentUser.value.isLoggedIn) {
    navigateTo('/')
  }
}

const rules = {
  isRequired: (v: string) => !!v || 'This field is required.',
  isUsername: (v: string) =>
    /^[a-zA-Z0-9]{6,30}$/.test(v) || 'Username is invalid',
  isEmail: (v: string) =>
    /.+@.+\..+/.test(v) || 'Please enter a valid email address.',
  password: (v: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]{8,}$/.test(v) ||
    'Password must be at least 8 characters long and include lowercase letters, uppercase letters, and numbers.',
  passwordsMatch: (v: string) =>
    v === payload.password || 'Passwords do not match.'
}

const usernameRules = ref([(v: string) => !!v || 'Not entered.'])
const emailRules = ref([(v: string) => !!v || 'Not entered.'])

async function onUsernameBlur() {
  if (!payload.username) {
    return
  }
  const exists = await authenticationStore.checkUsernameExists(payload.username)
  usernameRules.value = [
    (v: string) => !!v || 'Not entered.',
    () => (exists ? 'このユーザー名は既に使用されています。' : true)
  ]
}

async function onEmailBlur() {
  if (!payload.email) {
    return
  }
  const exists = await authenticationStore.checkEmailExists(payload.email)
  emailRules.value = [
    (v: string) => !!v || 'Not entered.',
    () => (exists ? 'このメールアドレスは既に使用されています。' : true)
  ]
}

function nextStep() {
  if (currentStep.value === 1) {
    currentStep.value = 2
  }
}

async function register() {
  const { valid } = await registerForm.value?.validate()
  if (!valid) {
    return
  }
  await authenticationStore.register(payload)
}

function previousStep() {
  if (currentStep.value === 2) {
    currentStep.value = 1
  }
}
</script>

<template>
  <div class="register-container">
    <div class="register-wrapper">
      <v-card class="lg-auto pa-8 pb-6" rounded="lg" elevation="0">
        <!-- Progress Bar -->
        <div class="progress-bar">
          <div class="progress-step" :class="{ active: currentStep === 1 }">
            <span class="step-number">1</span>
            <span class="step-label">Referrer</span>
          </div>
          <div class="progress-line" :class="{ active: currentStep === 2 }"></div>
          <div class="progress-step" :class="{ active: currentStep === 2 }">
            <span class="step-number">2</span>
            <span class="step-label">Details</span>
          </div>
        </div>

        <h1 class="register-title">Sign Up</h1>
        <p class="login-link">
          Already have an account?
          <NuxtLink to="/authentication/login">Log In</NuxtLink>
        </p>

        <v-form ref="registerForm" class="register-form">
          <!-- Step 1: Referrer -->
          <div v-if="currentStep === 1">
            <v-text-field
              v-model="payload.referrer"
              label="Referrer (Optional)"
              placeholder="Enter referrer if any"
              variant="outlined"
              color="primary"
              class="input-field"
            />
          </div>

          <!-- Step 2: Registration Details -->
          <div v-if="currentStep === 2">
            <v-text-field
              v-model.trim="payload.username"
              @blur="onUsernameBlur"
              label="Username"
              placeholder="yourusername"
              :rules="[rules.isRequired, rules.isUsername, ...usernameRules]"
              variant="outlined"
              color="primary"
              class="input-field"
            />
            <v-text-field
              v-model.trim="payload.email"
              @blur="onEmailBlur"
              label="Email"
              placeholder=""
              :rules="[rules.isRequired, rules.isEmail, ...emailRules]"
              variant="outlined"
              color="primary"
              class="input-field"
            />
            <v-text-field
              v-model="payload.password"
              label="Password"
              placeholder="••••••••"
              :rules="[rules.isRequired, rules.password]"
              variant="outlined"
              color="primary"
              type="password"
              class="input-field"
            />
            <v-text-field
              v-model="payload.confirmPassword"
              label="Confirm Password"
              placeholder="••••••••"
              :rules="[rules.isRequired, rules.passwordsMatch]"
              variant="outlined"
              color="primary"
              type="password"
              class="input-field"
            />
          </div>
        </v-form>

        <!-- Navigation Buttons -->
        <div class="button-group">
          <v-btn
            v-if="currentStep === 2"
            color="secondary"
            size="large"
            class="nav-button"
            @click="previousStep"
          >
            Back
          </v-btn>
          <v-btn
            v-if="currentStep === 1"
            color="primary"
            size="large"
            class="nav-button"
            @click="nextStep"
          >
            Next
          </v-btn>
          <v-btn
            v-if="currentStep === 2"
            color="primary"
            size="large"
            class="nav-button"
            :loading="isLoading"
            @click="register"
          >
            Sign Up
          </v-btn>
        </div>
      </v-card>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #1976d2;
$background-color: #f5f5f5;
$text-color: #333;
$border-radius: 8px;
$secondary-color: #757575;

.register-container {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
}

.register-wrapper {
  width: 100%;
  max-width: 480px;
  padding: 16px;
}

.register-title {
  font-size: 2.5rem;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 12px;
  text-align: center;
}

.login-link {
  font-size: 1rem;
  color: $primary-color;
  margin-bottom: 24px;
  text-align: center;
  a {
    color: $primary-color;
    text-decoration: none;
    transition: color 0.3s ease;
    &:hover {
      color: darken($primary-color, 10%);
      text-decoration: underline;
    }
  }
}

.register-form {
  margin-bottom: 24px;
}

.input-field {
  margin-bottom: 20px !important;
  width: 100%;
  :deep(.v-field__outline) {
    border-radius: $border-radius;
  }
}

.progress-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.progress-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100px;
  &.active {
    .step-number {
      background-color: $primary-color;
      color: white;
    }
    .step-label {
      color: $primary-color;
      font-weight: 600;
    }
  }
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: $secondary-color;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  margin-bottom: 8px;
}

.step-label {
  font-size: 0.9rem;
  color: $text-color;
}

.progress-line {
  width: 100px;
  height: 4px;
  background-color: $secondary-color;
  margin: 0 8px;
  &.active {
    background-color: $primary-color;
  }
}

.button-group {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.nav-button {
  border-radius: $border-radius;
  &.v-btn--variant-elevated {
    background-color: $primary-color !important;
    color: white !important;
    &:hover {
      background-color: darken($primary-color, 10%) !important;
    }
  }
  &.v-btn--variant-elevated[color="secondary"] {
    background-color: $secondary-color !important;
    color: white !important;
    &:hover {
      background-color: darken($secondary-color, 10%) !important;
    }
  }
}

@media (max-width: 600px) {
  .register-wrapper {
    padding: 12px;
  }

  .register-title {
    font-size: 2rem;
  }

  .v-card {
    padding: 16px !important;
  }

  .progress-bar {
    margin-bottom: 16px;
  }

  .progress-step {
    width: 80px;
  }

  .progress-line {
    width: 60px;
  }
}
</style>
