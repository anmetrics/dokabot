<template>
  <v-container
    fluid
    class="d-flex flex-column align-center justify-center fill-height bg-gradient"
  >
    <v-card
      class="pa-8 rounded-xl login-card"
      max-width="420"
      elevation="24"
    >
      <!-- Logo & Title -->
      <div class="text-center mb-6">
        <div class="logo-container mb-3">
          <v-icon size="48" color="primary">mdi-shield-lock</v-icon>
        </div>
        <h1 class="text-h5 font-weight-bold text-primary mb-1">
          Welcome Back
        </h1>
        <p class="text-body-2 text-medium-emphasis">
          Sign in to continue to your account
        </p>
      </div>

      <!-- Login Form -->
      <v-form @submit.prevent="onLogin">
        <v-text-field
          v-model="email"
          label="Email"
          type="email"
          variant="outlined"
          prepend-inner-icon="mdi-email-outline"
          density="compact"
          color="primary"
          :rules="emailRules"
          :error="!!error"
          class="mb-3"
          required
        />

        <v-text-field
          v-model="password"
          label="Mật khẩu"
          :type="showPassword ? 'text' : 'password'"
          variant="outlined"
          prepend-inner-icon="mdi-lock-outline"
          :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
          @click:append-inner="showPassword = !showPassword"
          density="compact"
          color="primary"
          :rules="passwordRules"
          :error="!!error"
          :error-messages="error"
          class="mb-2"
          required
        />

        <!-- Forgot Password Link -->
        <div class="text-right mb-4">
          <a href="#" class="text-primary text-decoration-none text-caption">
            Forgot password?
          </a>
        </div>

        <v-btn
          block
          color="primary"
          size="large"
          class="text-white font-weight-medium mb-3"
          type="submit"
          :loading="loading"
          elevation="2"
        >
          <v-icon start size="small">mdi-login</v-icon>
          Sign In
        </v-btn>

        <!-- Divider -->
        <div class="text-center">
          <v-divider class="mb-3" />
          <p class="text-caption text-medium-emphasis">
            Don't have an account?
            <a href="#" class="text-primary text-decoration-none font-weight-medium">
              Sign up
            </a>
          </p>
        </div>
      </v-form>
    </v-card>
  </v-container>
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

const onLogin = async () => {
  error.value = "";
  loading.value = true;

  try {
    // Gọi API login (backend trả JWT)
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
.fill-height {
  min-height: 100vh;
}

.bg-gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.bg-gradient::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.3), transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(138, 43, 226, 0.3), transparent 50%),
    radial-gradient(circle at 40% 20%, rgba(72, 61, 139, 0.3), transparent 50%);
  animation: gradientShift 15s ease infinite;
}

@keyframes gradientShift {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.login-card {
  backdrop-filter: blur(20px);
  background-color: rgba(255, 255, 255, 0.98);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  border: 1px solid rgba(255, 255, 255, 0.18);
  width: 100%;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 48px 0 rgba(31, 38, 135, 0.45);
}

.logo-container {
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* Custom focus styles for inputs */
:deep(.v-field--focused) {
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Button hover effect */
:deep(.v-btn) {
  transition: all 0.3s ease;
}

:deep(.v-btn:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

/* Link hover effect */
a {
  transition: all 0.2s ease;
  position: relative;
}

a::after {
  content: '';
  position: absolute;
  width: 0;
  height: 2px;
  bottom: -2px;
  left: 0;
  background-color: currentColor;
  transition: width 0.3s ease;
}

a:hover::after {
  width: 100%;
}

/* Input field animations */
:deep(.v-text-field) {
  transition: all 0.3s ease;
}

:deep(.v-text-field:hover .v-field) {
  background-color: rgba(102, 126, 234, 0.02);
}
</style>
