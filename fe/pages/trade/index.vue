<template>
  <div class="trade-page">
    <ClientOnly>
      <TradingLayout />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import TradingLayout from "~/components/trading/TradingLayout.vue";

// Page meta
definePageMeta({
  layout: "default",
});

useHead({
  title: "Trade - Dokabot",
});
</script>

<style scoped>
.trade-page {
  min-height: 100vh;
  background: #0f172a;
}
</style>
