<template>
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
        🔒 Login
      </v-card-title>

      <v-form @submit.prevent="onLogin">
        <v-text-field
          v-model="password"
          label="Mật khẩu"
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
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useCookie, navigateTo } from "#app";
import { useApi } from "~/apis";

definePageMeta({
  layout: "auth",
});

const password = ref("");
const error = ref("");
const loading = ref(false);

const api = useApi();
const authToken = useCookie("auth_token");

const onLogin = async () => {
  error.value = "";
  loading.value = true;

  try {
    // Gọi API login (backend trả JWT)
    const res: {
      accessToken: string;
    } = await api.post("auth/login", {
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
  background: linear-gradient(125deg, #68c6c8, #353ea8, #5694b5, #3d50cd);
}

.login-card {
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.95);
  min-width: 220px;
  width: 100%;
}
</style>
