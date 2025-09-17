<script lang="ts" setup>
import { VNodeRef } from 'vue'
import { LoginPayload } from '~/store/types/authentication'

definePageMeta({
  layout: 'anonymous'
})

const loginForm = ref<VNodeRef | null>(null)
const payload = reactive<LoginPayload>({ email: '', password: '' })

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
  isRequired: (v: string) => !!v || 'Not entered.',
  isEmail: (v: string) =>
    /.+@.+\..+/.test(v) || 'The email address is invalid.',
  username: (v: string) =>
    /^[a-zA-Z0-9]{6,30}$/.test(v) ||
    'Username must be 6–30 characters long and contain only alphanumeric characters.',
  password: (v: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d!@#$%^&*]{8,}$/.test(v) ||
    'Password must be at least 8 characters long and include lowercase letters, uppercase letters, and numbers.'
}

async function login() {
  const { valid } = await loginForm.value?.validate()
  if (!valid) {
    return
  }

  await authenticationStore.login(payload)
}
</script>

<template>
  <div class="login-container">
    <div class="login-wrapper">
      <v-card class="lg-auto pa-8 pb-6" rounded="lg" elevation="0">
        <h1 class="login-title">Log In</h1>
        <p class="register-link">
          Need to register?
          <NuxtLink to="/authentication/register">Sign up</NuxtLink>
        </p>
        <v-form ref="loginForm" class="login-form">
          <v-text-field
            v-model.trim="payload.email"
            label="Email"
            placeholder=""
            :rules="[rules.isRequired, rules.isEmail]"
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
        </v-form>
        <v-btn
          color="primary"
          block
          size="large"
          class="login-button"
          :loading="isLoading"
          @click="login"
        >
          Log In
        </v-btn>
        <p class="forgot-password-link">
          <NuxtLink to="/authentication/forgot-password">
            Forgot password?
          </NuxtLink>
        </p>
      </v-card>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #1976d2;
$background-color: #f5f5f5;
$text-color: #333;
$border-radius: 8px;

.login-container {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
}

.login-wrapper {
  width: 100%;
  max-width: 480px;
  padding: 16px;
}

.login-title {
  font-size: 2.5rem;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 12px;
  text-align: center;
}

.register-link {
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

.login-form {
  margin-bottom: 24px;
}

.input-field {
  margin-bottom: 20px !important;
  width: 100%;
  :deep(.v-field__outline) {
    border-radius: $border-radius;
  }
}

.login-button {
  background-color: $primary-color !important;
  color: white !important;
  border-radius: $border-radius;
  margin-bottom: 16px;
  transition: background-color 0.3s ease;
  &:hover {
    background-color: darken($primary-color, 10%) !important;
  }
}

.forgot-password-link {
  font-size: 0.9rem;
  color: $primary-color;
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

@media (max-width: 600px) {
  .login-wrapper {
    padding: 12px;
  }

  .login-title {
    font-size: 2rem;
  }

  .v-card {
    padding: 16px !important;
  }
}
</style>
