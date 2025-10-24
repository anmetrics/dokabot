<template>
  <v-container class="pa-10 container-custom">
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
  transition: all 0.3s ease;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .container-custom {
    padding: 16px;
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
