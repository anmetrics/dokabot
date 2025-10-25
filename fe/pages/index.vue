<template>
  <v-container class="container-custom">
    <profit-chart />
  </v-container>
</template>

<script setup lang="ts">
const { $auth } = useNuxtApp();

function logout() {
  $auth.clearToken();
  navigateTo("/authentication/login");
}
</script>

<style scoped>
/* Container styling */
.container-custom {
  max-width: 1200px;
  margin: 0 auto;
  background: transparent;
  border-radius: 16px;
  padding: 40px; /* tương đương pa-10 */
  transition: all 0.3s ease;
}

@media (max-width: 960px) {
  .container-custom {
    padding: 24px;
  }
}

@media (max-width: 600px) {
  .container-custom {
    padding: 12px 16px;
  }
}

/* Scrollbar styling */
:deep(.v-container::-webkit-scrollbar) {
  width: 8px;
}

:deep(.v-container::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

:deep(.v-container::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.1);
}
</style>
