<template>
  <v-app>
    <v-container
      fluid
      class="d-flex flex-column align-center justify-center fill-height bg-gradient"
    >
      <v-card
        class="pa-10 rounded-xl text-center login-card"
        max-width="480"
        elevation="10"
      >
        <v-card-title class="text-h5 font-weight-bold mb-6">
          🔒 Đăng nhập hệ thống
        </v-card-title>

        <v-form @submit.prevent="onLogin">
          <v-text-field
            v-model="password"
            label="Nhập mật khẩu"
            type="password"
            variant="outlined"
            prepend-inner-icon="mdi-lock-outline"
            density="comfortable"
            color="primary"
            :error="!!error"
            :error-messages="error"
            class="mb-6"
          />

          <v-btn
            block
            color="primary"
            size="large"
            class="text-white font-weight-medium"
            type="submit"
            :loading="loading"
          >
            Login
          </v-btn>
        </v-form>
      </v-card>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useCookie } from "#app";

definePageMeta({
  layout: false, // 🔹 bỏ layout mặc định
});

const router = useRouter();
const password = ref("");
const error = ref("");
const loading = ref(false);

// ✅ Mật khẩu cố định
const CORRECT_PASSWORD = "123456";

const onLogin = async () => {
  error.value = "";
  loading.value = true;

  await new Promise((r) => setTimeout(r, 500)); // giả delay

  if (password.value === CORRECT_PASSWORD) {
    const token = useCookie("auth_token");
    token.value = "ok";
    router.push("/");
  } else {
    error.value = "Sai mật khẩu";
  }

  loading.value = false;
};
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}

.bg-gradient {
  background: linear-gradient(125deg, #68c6c8, #353ea8, #5694b5, #3d50cd);
}

.login-card {
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.95);
  min-width: 220px;
  width: 100%;
}
</style>
