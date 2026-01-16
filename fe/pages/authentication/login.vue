<template>
  <div class="login-page">
    <!-- Background effect -->
    <div class="bg-gradient-effect"></div>

    <v-container fluid class="d-flex align-center justify-center fill-height">
      <v-card class="login-card pa-8" max-width="460" elevation="0">
        <!-- Tab Switch: Log In / Sign Up -->
        <div class="tab-switch mb-8">
          <button class="tab-btn" :class="{ active: !isSignUp }" @click="isSignUp = false">
            Log In
          </button>
          <button class="tab-btn" :class="{ active: isSignUp }" @click="isSignUp = true">
            Sign Up
          </button>
        </div>

        <!-- Account Type Selection (only for Sign Up) -->
        <div v-if="isSignUp" class="mb-6">
          <label class="field-label">Account Type</label>
          <div class="account-type-selector">
            <button
              class="account-type-btn"
              :class="{ active: accountType === 'individual' }"
              @click="accountType = 'individual'"
            >
              <v-icon size="20" class="mr-2">mdi-account</v-icon>
              <div class="text-left">
                <div class="account-type-title">Individual</div>
                <div class="account-type-desc">For retail users</div>
              </div>
            </button>
            <button
              class="account-type-btn"
              :class="{ active: accountType === 'business' }"
              @click="accountType = 'business'"
            >
              <v-icon size="20" class="mr-2">mdi-domain</v-icon>
              <div class="text-left">
                <div class="account-type-title">Business</div>
                <div class="account-type-desc">For institutions</div>
              </div>
            </button>
          </div>
        </div>

        <!-- Login/Sign Up Form -->
        <v-form @submit.prevent="onSubmit">
          <!-- Email Field -->
          <div class="mb-4">
            <label class="field-label">Email</label>
            <v-text-field
              v-model="email"
              placeholder="Enter your email address"
              variant="outlined"
              density="comfortable"
              :rules="emailRules"
              :error="!!error"
              hide-details="auto"
              class="custom-input"
            />
          </div>

          <!-- Password Field (only for Login) -->
          <div v-if="!isSignUp" class="mb-4">
            <label class="field-label">Password</label>
            <v-text-field
              v-model="password"
              placeholder="Enter your password"
              :type="showPassword ? 'text' : 'password'"
              variant="outlined"
              density="comfortable"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showPassword = !showPassword"
              :rules="passwordRules"
              :error="!!error"
              :error-messages="error"
              hide-details="auto"
              class="custom-input"
            />
          </div>

          <!-- Referral Code (only for Sign Up) -->
          <div v-if="isSignUp" class="mb-4">
            <button type="button" class="referral-toggle" @click="showReferral = !showReferral">
              Referral Code (Optional)
              <v-icon size="16" class="ml-1">{{ showReferral ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </button>
            <v-text-field
              v-if="showReferral"
              v-model="referralCode"
              placeholder="Enter referral code"
              variant="outlined"
              density="comfortable"
              hide-details="auto"
              class="custom-input mt-2"
            />
          </div>

          <!-- Newsletter Checkbox (only for Sign Up) -->
          <div v-if="isSignUp" class="mb-6">
            <v-checkbox
              v-model="receiveUpdates"
              hide-details
              class="custom-checkbox"
            >
              <template v-slot:label>
                <span class="checkbox-label">I'd like to receive exclusive offers and updates from DokaBot</span>
              </template>
            </v-checkbox>
          </div>

          <!-- Forgot Password (only for Login) -->
          <div v-if="!isSignUp" class="text-right mb-4">
            <a href="#" class="forgot-link">Forgot password?</a>
          </div>

          <!-- Submit Button -->
          <v-btn
            block
            size="large"
            class="submit-btn mb-4"
            type="submit"
            :loading="loading"
          >
            {{ isSignUp ? 'Create Account with Email' : 'Log In' }}
          </v-btn>

          <!-- Divider -->
          <div class="divider-container mb-4">
            <div class="divider-line"></div>
            <span class="divider-text">OR</span>
            <div class="divider-line"></div>
          </div>

          <!-- Social Login Buttons -->
          <v-btn
            block
            variant="outlined"
            size="large"
            class="social-btn mb-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" class="social-icon" />
            Continue with Google
          </v-btn>

          <v-btn
            block
            variant="outlined"
            size="large"
            class="social-btn"
          >
            <v-icon size="20" class="mr-2">mdi-apple</v-icon>
            Continue with Apple
          </v-btn>

          <!-- Privacy Notice -->
          <p class="privacy-notice mt-6">
            By submitting your email, you confirm you've read the relevant
            <a href="#" class="privacy-link">Privacy Notice</a>, and
            opt-in to global payment and contact search
          </p>
        </v-form>
      </v-card>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useCookie, navigateTo } from "#app";
import { useApi } from "~/apis";

definePageMeta({
  layout: "auth",
});

const email = ref("");
const password = ref("");
const showPassword = ref(false);
const error = ref("");
const loading = ref(false);
const isSignUp = ref(false);
const accountType = ref("individual");
const showReferral = ref(false);
const referralCode = ref("");
const receiveUpdates = ref(false);

const api = useApi();
const authToken = useCookie("auth_token");

// Validation rules
const emailRules = [
  (v: string) => !!v || "Email is required",
  (v: string) => /.+@.+\..+/.test(v) || "Email must be valid",
];

const passwordRules = [
  (v: string) => !!v || "Password is required",
  (v: string) => v.length >= 6 || "Password must be at least 6 characters",
];

const onSubmit = async () => {
  if (isSignUp.value) {
    // Handle sign up logic
    console.log("Sign up with:", email.value, accountType.value);
    return;
  }

  // Handle login logic
  error.value = "";
  loading.value = true;

  try {
    const res: {
      accessToken: string;
    } = await api.post("auth/login", {
      email: email.value,
      password: password.value,
    });

    if (!res.accessToken) throw new Error("Không nhận được token");

    authToken.value = res.accessToken;

    navigateTo("/");
  } catch (err: any) {
    console.error("Login failed:", err);
    error.value = err?.message || "Sai email hoặc mật khẩu";
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #0b1426;
  position: relative;
  overflow: hidden;
}

.bg-gradient-effect {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60%;
  background: linear-gradient(180deg, #0d2847 0%, #0b1426 100%);
  pointer-events: none;
}

.bg-gradient-effect::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -20%;
  width: 80%;
  height: 100%;
  background: radial-gradient(ellipse, rgba(16, 78, 139, 0.4) 0%, transparent 70%);
  animation: pulse 8s ease-in-out infinite;
}

.bg-gradient-effect::after {
  content: '';
  position: absolute;
  top: -30%;
  right: -10%;
  width: 60%;
  height: 80%;
  background: radial-gradient(ellipse, rgba(6, 95, 166, 0.3) 0%, transparent 70%);
  animation: pulse 10s ease-in-out infinite reverse;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.fill-height {
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

.login-card {
  background: #161f2c !important;
  border-radius: 16px !important;
  border: 1px solid rgba(255, 255, 255, 0.08);
  width: 100%;
}

/* Tab Switch */
.tab-switch {
  display: flex;
  background: #0d1520;
  border-radius: 8px;
  padding: 4px;
}

.tab-btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  background: transparent;
  color: #8b95a5;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.tab-btn.active {
  background: #1a73e8;
  color: white;
}

.tab-btn:hover:not(.active) {
  color: #c5cdd8;
}

/* Field Labels */
.field-label {
  display: block;
  color: #8b95a5;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 8px;
}

/* Account Type Selector */
.account-type-selector {
  display: flex;
  gap: 12px;
}

.account-type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 16px;
  background: #0d1520;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #8b95a5;
  cursor: pointer;
  transition: all 0.3s ease;
}

.account-type-btn.active {
  border-color: #1a73e8;
  background: rgba(26, 115, 232, 0.1);
  color: white;
}

.account-type-btn:hover:not(.active) {
  border-color: rgba(255, 255, 255, 0.2);
}

.account-type-title {
  font-size: 14px;
  font-weight: 500;
  color: inherit;
}

.account-type-desc {
  font-size: 12px;
  color: #5f6b7a;
  margin-top: 2px;
}

.account-type-btn.active .account-type-title {
  color: white;
}

/* Custom Input */
.custom-input :deep(.v-field) {
  background: #0d1520 !important;
  border-radius: 8px !important;
}

.custom-input :deep(.v-field__outline) {
  --v-field-border-opacity: 0.1;
}

.custom-input :deep(.v-field--focused .v-field__outline) {
  --v-field-border-opacity: 1;
  color: #1a73e8 !important;
}

.custom-input :deep(.v-field__outline__start),
.custom-input :deep(.v-field__outline__end),
.custom-input :deep(.v-field__outline__notch::before),
.custom-input :deep(.v-field__outline__notch::after) {
  border-color: rgba(255, 255, 255, 0.1) !important;
}

.custom-input :deep(.v-field--focused .v-field__outline__start),
.custom-input :deep(.v-field--focused .v-field__outline__end),
.custom-input :deep(.v-field--focused .v-field__outline__notch::before),
.custom-input :deep(.v-field--focused .v-field__outline__notch::after) {
  border-color: #1a73e8 !important;
}

.custom-input :deep(input) {
  color: white !important;
}

.custom-input :deep(input::placeholder) {
  color: #5f6b7a !important;
}

.custom-input :deep(.v-icon) {
  color: #5f6b7a !important;
}

/* Referral Toggle */
.referral-toggle {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: #8b95a5;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}

.referral-toggle:hover {
  color: #c5cdd8;
}

/* Custom Checkbox */
.custom-checkbox :deep(.v-selection-control__wrapper) {
  color: #1a73e8 !important;
}

.custom-checkbox :deep(.v-selection-control__input > .v-icon) {
  color: #5f6b7a;
}

.custom-checkbox :deep(.v-selection-control--dirty .v-selection-control__input > .v-icon) {
  color: #1a73e8 !important;
}

.checkbox-label {
  color: #8b95a5;
  font-size: 13px;
}

/* Forgot Link */
.forgot-link {
  color: #1a73e8;
  font-size: 13px;
  text-decoration: none;
  transition: color 0.2s;
}

.forgot-link:hover {
  color: #4a9eff;
}

/* Submit Button */
.submit-btn {
  background: linear-gradient(90deg, #1a73e8 0%, #0d5bbd 100%) !important;
  color: white !important;
  font-weight: 600 !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  border-radius: 8px !important;
  height: 48px !important;
}

.submit-btn:hover {
  background: linear-gradient(90deg, #2b82f0 0%, #1a6cd4 100%) !important;
}

/* Divider */
.divider-container {
  display: flex;
  align-items: center;
  gap: 16px;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.divider-text {
  color: #5f6b7a;
  font-size: 12px;
  font-weight: 500;
}

/* Social Buttons */
.social-btn {
  background: transparent !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: white !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
  font-weight: 500 !important;
  border-radius: 8px !important;
  height: 48px !important;
}

.social-btn:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  border-color: rgba(255, 255, 255, 0.25) !important;
}

.social-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
}

/* Privacy Notice */
.privacy-notice {
  color: #5f6b7a;
  font-size: 12px;
  text-align: center;
  line-height: 1.6;
}

.privacy-link {
  color: #1a73e8;
  text-decoration: none;
}

.privacy-link:hover {
  text-decoration: underline;
}
</style>
