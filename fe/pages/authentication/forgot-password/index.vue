<script lang="ts" setup>
import { VNodeRef } from 'vue'

definePageMeta({
  layout: 'anonymous'
})

const forgotPasswordForm = ref<VNodeRef | null>(null)
const payload = reactive<{ email: string }>({ email: '' })
const showSuccessDialog = ref(false) // Reactive variable for dialog visibility

const authenticationStore = useAuthenticationStore()
const { isLoading } = storeToRefs(authenticationStore)

const rules = {
  isRequired: (v: string) => !!v || 'Not entered.',
  isEmail: (v: string) => /.+@.+\..+/.test(v) || 'メールアドレスが無効です。'
}

async function requestPasswordReset() {
  const { valid } = await forgotPasswordForm.value?.validate()
  if (!valid) {
    return
  }

  try {
    // await authenticationStore.requestPasswordReset(payload)
    showSuccessDialog.value = true // Show dialog on success
  } catch (error) {
    // Handle error (e.g., show error message)
    console.error('Password reset request failed:', error)
  }
}
</script>

<template>
  <div class="forgot-password-container">
    <div class="forgot-password-wrapper">
      <v-card
        class="mx-auto pa-8 pb-6"
        elevation="4"
        max-width="480"
        rounded="lg"
      >
        <h1 class="forgot-password-title">Forgot Password</h1>
        <p class="description">
          Enter your email address to receive a password reset link.
        </p>
        <v-form ref="forgotPasswordForm" class="forgot-password-form">
          <v-text-field
            v-model.trim="payload.email"
            label="Email"
            placeholder=""
            :rules="[rules.isRequired, rules.isEmail]"
            variant="outlined"
            color="primary"
            class="input-field"
          />
        </v-form>
        <v-btn
          color="primary"
          block
          size="large"
          class="submit-button"
          :loading="isLoading"
          @click="requestPasswordReset"
        >
          Submit
        </v-btn>
        <p class="login-link">
          Back to
          <NuxtLink to="/authentication/login">Log In</NuxtLink>
        </p>
      </v-card>

      <!-- Success Dialog -->
      <v-dialog v-model="showSuccessDialog" max-width="500" persistent>
        <v-card rounded="lg" class="pa-6 transparent-card">
          <v-card-title class="dialog-title">Success</v-card-title>
          <v-card-text class="dialog-text">
            Password reset request submitted successfully. Please check your
            email for the reset link.
          </v-card-text>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              text
              class="dialog-button"
              @click="navigateTo('/authentication/login')"
            >
              Back to Log In
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$primary-color: #1976d2;
$background-color: #f5f5f5;
$text-color: #333;
$border-radius: 8px;

.forgot-password-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.forgot-password-wrapper {
  width: 100%;
  max-width: 480px;
  padding: 16px;
}

.forgot-password-title {
  font-size: 2.5rem;
  font-weight: 600;
  color: $text-color;
  margin-bottom: 12px;
  text-align: center;
}

.description {
  font-size: 1rem;
  color: $text-color;
  margin-bottom: 24px;
  text-align: center;
}

.forgot-password-form {
  margin-bottom: 24px;
}

.input-field {
  margin-bottom: 20px !important;
  width: 100%;
  :deep(.v-field__outline) {
    border-radius: $border-radius;
  }
}

.submit-button {
  background-color: $primary-color !important;
  color: white !important;
  border-radius: $border-radius;
  margin-bottom: 16px;
  transition: background-color 0.3s ease;
  &:hover {
    background-color: darken($primary-color, 10%) !important;
  }
}

.login-link {
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

.dialog-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: $text-color;
  text-align: center;
  padding-bottom: 8px;
}

.dialog-text {
  font-size: 1rem;
  color: $text-color;
  text-align: center;
  padding: 16px 0;
}

.dialog-button {
  background-color: $primary-color !important;
  color: white !important;
  border-radius: $border-radius;
  transition: background-color 0.3s ease;
  &:hover {
    background-color: darken($primary-color, 10%) !important;
  }
}

.transparent-card {
  background-color: transparent !important;
  box-shadow: none !important;
}

@media (max-width: 600px) {
  .forgot-password-wrapper {
    padding: 12px;
  }

  .forgot-password-title {
    font-size: 2rem;
  }

  .v-card {
    padding: 16px !important;
  }

  .dialog-title {
    font-size: 1.25rem;
  }

  .dialog-text {
    font-size: 0.9rem;
  }
}
</style>
