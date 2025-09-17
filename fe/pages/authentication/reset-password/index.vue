<script lang="ts" setup>
import { VNodeRef } from 'vue'
import { useRoute } from 'vue-router'

definePageMeta({
  layout: 'anonymous'
})

const resetPasswordForm = ref<VNodeRef | null>(null)
const payload = reactive<{
  newPassword: string
  confirmPassword: string
  token: string
}>({
  newPassword: '',
  confirmPassword: '',
  token: ''
})
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)
const showDialog = ref(false)
const dialogMessage = ref('')
const dialogType = ref<'success' | 'error'>('success')

const route = useRoute()
payload.token = (route.query.token as string) || '' // Lấy token từ query parameter

const authenticationStore = useAuthenticationStore()
const { isLoading } = storeToRefs(authenticationStore)

const rules = {
  isRequired: (v: string) => !!v || 'Not entered.',
  minLength: (v: string) =>
    v.length >= 8 || 'パスワードは8文字以上である必要があります。',
  hasSpecialChar: (v: string) =>
    /[!@#$%^&*(),.?":{}|<>]/.test(v) || '特殊文字を含める必要があります。',
  hasUpperCase: (v: string) =>
    /[A-Z]/.test(v) || '大文字を含める必要があります。',
  matchPassword: (v: string) =>
    v === payload.newPassword || 'パスワードが一致しません。'
}

async function resetPassword() {
  const { valid } = await resetPasswordForm.value?.validate()
  if (!valid) {
    return
  }

  try {
    await authenticationStore.resetPassword(payload)
    dialogMessage.value =
      'Password reset successfully. You can now log in with your new password.'
    dialogType.value = 'success'
    showDialog.value = true
  } catch (error) {
    dialogMessage.value =
      'Failed to reset password. Please try again or contact support.'
    dialogType.value = 'error'
    showDialog.value = true
    console.error('Password reset failed:', error)
  }
}
</script>

<template>
  <div class="reset-password-container">
    <div class="reset-password-wrapper">
      <v-card
        class="mx-auto pa-8 pb-6"
        elevation="4"
        max-width="480"
        rounded="lg"
      >
        <h1 class="reset-password-title">Reset Password</h1>
        <p class="description">
          Enter your new password below to update your account.
        </p>
        <v-form ref="resetPasswordForm" class="reset-password-form">
          <v-text-field
            v-model="payload.newPassword"
            label="New Password"
            placeholder="••••••••"
            :rules="[
              rules.isRequired,
              rules.minLength,
              rules.hasSpecialChar,
              rules.hasUpperCase
            ]"
            variant="outlined"
            color="primary"
            :type="showNewPassword ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock"
            :append-inner-icon="showNewPassword ? 'mdi-eye' : 'mdi-eye-off'"
            class="input-field"
            aria-label="New Password"
            @click:append-inner="showNewPassword = !showNewPassword"
          />
          <v-text-field
            v-model="payload.confirmPassword"
            label="Confirm Password"
            placeholder="••••••••"
            :rules="[rules.isRequired, rules.matchPassword]"
            variant="outlined"
            color="primary"
            :type="showConfirmPassword ? 'text' : 'password'"
            prepend-inner-icon="mdi-lock"
            :append-inner-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
            class="input-field"
            aria-label="Confirm Password"
            @click:append-inner="showConfirmPassword = !showConfirmPassword"
          />
        </v-form>
        <v-btn
          color="primary"
          block
          size="large"
          class="reset-button"
          :loading="isLoading"
          @click="resetPassword"
        >
          Reset Password
        </v-btn>
        <p class="login-link">
          Back to
          <NuxtLink to="/authentication/login">Log In</NuxtLink>
        </p>
      </v-card>

      <!-- Dialog for Success/Error -->
      <v-dialog v-model="showDialog" max-width="400" persistent>
        <v-card rounded="lg" class="pa-6">
          <v-card-title
            :class="[
              'dialog-title',
              dialogType === 'success' ? 'success-title' : 'error-title'
            ]"
          >
            {{ dialogType === 'success' ? 'Success' : 'Error' }}
          </v-card-title>
          <v-card-text class="dialog-text">
            {{ dialogMessage }}
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
$accent-color: #ff6d00;
$background-color: #f5f5f5;
$text-color: #333;
$border-radius: 12px;

.reset-password-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.reset-password-wrapper {
  width: 100%;
  max-width: 480px;
  padding: 16px;
}

.reset-password-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: $text-color;
  margin-bottom: 16px;
  text-align: center;
  line-height: 1.2;
}

.description {
  font-size: 1rem;
  color: $text-color;
  margin-bottom: 24px;
  text-align: center;
  font-weight: 400;
}

.reset-password-form {
  margin-bottom: 24px;
}

.input-field {
  margin-bottom: 24px !important;
  width: 100%;
  :deep(.v-field__outline) {
    border-radius: $border-radius;
  }
  :deep(.v-field) {
    transition: all 0.3s ease;
  }
  :deep(.v-icon) {
    font-size: 24px !important;
    color: $text-color;
    transition: color 0.3s ease;
  }
  :deep(.v-icon:hover) {
    color: $primary-color;
  }
}

.reset-button {
  background-color: $primary-color !important;
  color: white !important;
  border-radius: $border-radius;
  margin-bottom: 16px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  &:hover {
    background-color: darken($primary-color, 10%) !important;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
}

.login-link {
  font-size: 0.9rem;
  color: $primary-color;
  text-align: center;
  a {
    color: $accent-color;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.3s ease;
    &:hover {
      color: darken($accent-color, 10%);
      text-decoration: underline;
    }
  }
}

.dialog-title {
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  padding-bottom: 8px;
}

.success-title {
  color: $primary-color;
}

.error-title {
  color: #d32f2f;
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
  transition: all 0.3s ease;
  &:hover {
    background-color: darken($primary-color, 10%) !important;
  }
}

@media (max-width: 600px) {
  .reset-password-wrapper {
    padding: 12px;
  }

  .reset-password-title {
    font-size: 1.75rem;
  }

  .v-card {
    padding: 16px !important;
  }

  .input-field {
    margin-bottom: 20px !important;
  }

  .dialog-title {
    font-size: 1.25rem;
  }

  .dialog-text {
    font-size: 0.9rem;
  }
}
</style>
