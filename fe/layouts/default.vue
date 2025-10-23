<template>
  <v-app dark>
    <!-- App Bar -->
    <v-app-bar flat class="crypto-app-bar">
      <v-app-bar-nav-icon @click="drawer = !drawer" class="ml-2" />
      <v-toolbar-title class="font-weight-bold text-uppercase">
        Doka
      </v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="toggleTheme" aria-label="Toggle theme">
        <v-icon>{{
          isDark ? "mdi-white-balance-sunny" : "mdi-moon-waning-crescent"
        }}</v-icon>
      </v-btn>
      <v-btn icon @click="openWallet" aria-label="Wallet">
        <v-icon>mdi-wallet-outline</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" app width="280" class="crypto-drawer">
      <v-list dense nav>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          :class="[
            'crypto-list-item',
            { 'crypto-list-item--active': isActive(item.to) },
          ]"
          @click="navigate(item.to)"
        >
          <v-icon class="crypto-list-icon">{{ item.icon }}</v-icon>
          <v-list-item-title class="crypto-list-title">
            {{ item.title }}
          </v-list-item-title>
        </v-list-item>
      </v-list>

      <v-divider class="my-2" />
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main class="crypto-main">
      <v-container fluid class="pa-6">
        <NuxtPage />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "#app";
import { useTheme } from "vuetify";

const router = useRouter();
const route = useRoute();
const theme = useTheme();

const drawer = ref(true);

const menuItems = [
  { title: "Trang chủ", icon: "mdi-home-outline", to: "/" },
  { title: "Tài sản", icon: "mdi-wallet-outline", to: "/assets" },
  { title: "Vị thế", icon: "mdi-chart-line", to: "/positions" },
  { title: "Lịch sử", icon: "mdi-history", to: "/histories" },
  {
    title: "Lịch sử giao dịch",
    icon: "mdi-swap-horizontal",
    to: "/transactions",
  },
  { title: "Cài đặt", icon: "mdi-cog-outline", to: "/settings" },
];

const isActive = (path: string) => route.path === path;
const navigate = (path: string) => router.push(path);
const openWallet = () => router.push("/assets");

const isDark = computed(() => theme.global.name.value === "dark");
const toggleTheme = () =>
  (theme.global.name.value = isDark.value ? "light" : "dark");
</script>

<style scoped>
/* App bar styling */
.crypto-app-bar {
  background-color: #0d1a26 !important;
  color: #e0e0e0;
  box-shadow: none;
  border-bottom: 1px solid #2a3b4c;
  backdrop-filter: blur(10px);
}

/* Navigation drawer styling */
.crypto-drawer {
  background: linear-gradient(180deg, #0d1a26, #1c2a3b);
  color: #e0e0e0;
  border-right: 1px solid #2a3b4c;
}

/* List item styling with aligned icon and text */
.crypto-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 48px;
  padding: 0 16px;
  border-radius: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
  font-weight: 500;
}

.crypto-list-icon {
  color: inherit;
  font-size: 24px;
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.crypto-list-title {
  font-size: 16px;
  line-height: 24px;
  display: flex;
  align-items: center;
}

.crypto-list-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateX(2px);
}

.crypto-list-item--active {
  background-color: rgba(30, 136, 229, 0.3);
  color: #4fc3f7;
}

.crypto-list-item--active .crypto-list-icon {
  color: #4fc3f7;
}

/* Main content styling */
.crypto-main {
  background-color: #121f2e !important;
  color: #e0e0e0;
  min-height: 100vh;
}

/* Market ticker colors */
.text-green {
  color: #00e676;
}

.text-red {
  color: #ff5252;
}

/* Scrollbar styling */
.crypto-drawer::-webkit-scrollbar {
  width: 6px;
}

.crypto-drawer::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}
</style>
