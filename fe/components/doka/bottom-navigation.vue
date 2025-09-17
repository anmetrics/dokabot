<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const items = [
  { icon: 'mdi-home', label: 'Home', to: '/claim' },
  { icon: 'mdi-cash', label: 'Assets', to: '/assets' },
  { icon: 'mdi-transfer', label: 'Transactions', to: '/transactions' }
  // { icon: 'mdi-link', label: 'Stake', to: '/stake' },
  // { icon: 'mdi-cog', label: 'Settings', to: '/settings' }
]

function navigate(to: string) {
  router.push(to)
}
</script>

<template>
  <v-bottom-navigation app grow height="64" class="mobile-bottom-nav">
    <v-btn
      v-for="item in items"
      :key="item.to"
      :icon="true"
      :color="route.path === item.to ? 'primary' : 'default'"
      @click="navigate(item.to)"
    >
      <v-icon>{{ item.icon }}</v-icon>
      <span class="text-caption d-block">{{ item.label }}</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<style scoped>
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  width: 100%;
  z-index: 100;
  border-top: 1px solid #ddd;
}
</style>
