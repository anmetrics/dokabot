<template>
  <v-app dark>
    <!-- App Bar -->
    <v-app-bar flat class="crypto-app-bar">
      <v-app-bar-nav-icon @click="drawer = !drawer" class="ml-3" />
      <v-toolbar-title class="font-weight-bold text-uppercase">
        Doka
      </v-toolbar-title>
      <v-spacer />

      <!-- Logout button -->
      <v-btn icon @click="logout" aria-label="Logout" class="mr-2">
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" app width="250" class="crypto-drawer">
      <v-list dense nav class="pa-3">
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

      <v-divider class="my-3" />
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main class="crypto-main">
      <v-container fluid class="pa-8">
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

import { useCookie, navigateTo } from "#app";

const authToken = useCookie("auth_token");

const logout = () => {
  authToken.value = ""; // Clear token
  navigateTo("/login"); // Redirect to login
};

const drawer = ref(true);

const menuItems = [
  { title: "Trang chủ", icon: "mdi-home-outline", to: "/" },
  { title: "Tài sản", icon: "mdi-wallet-outline", to: "/assets" },
  { title: "Vị thế đang mở", icon: "mdi-chart-line", to: "/positions" },
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
  background: linear-gradient(135deg, #162537 0%, #20354b 60%, #0f1721 100%);
  color: #e0e0e0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid #2a3b4c;
  backdrop-filter: blur(12px);
}

/* Navigation drawer styling */
.crypto-drawer {
  background: linear-gradient(180deg, #0d1a26 0%, #1a2635 100%);
  color: #e0e0e0;
  border-right: 1px solid #2a3b4c;
  transition: width 0.3s ease, transform 0.3s ease;
}

/* Responsive drawer width */
@media (max-width: 600px) {
  .crypto-drawer {
    width: 240px !important;
  }
}

/* List item styling */
.crypto-list-item {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 54px;
  padding: 4px 20px;
  border-radius: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
  font-weight: 500;
  margin: 10px 6px;
  background-color: transparent;
}

.crypto-list-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateX(6px);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}

.crypto-list-item--active {
  background: linear-gradient(
    90deg,
    rgba(30, 136, 229, 0.4),
    rgba(30, 136, 229, 0.15)
  );
  color: #4fc3f7;
  font-weight: 600;
  box-shadow: inset 0 0 10px rgba(30, 136, 229, 0.4);
}

.crypto-list-icon {
  color: inherit;
  font-size: 20px;
  min-width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease, color 0.3s ease;
}

.crypto-list-item:hover .crypto-list-icon {
  transform: scale(1.15);
  color: #4fc3f7;
}

.crypto-list-item--active .crypto-list-icon {
  color: #4fc3f7;
}

.crypto-list-title {
  font-size: 16px;
  line-height: 24px;
  display: flex;
  align-items: center;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* Main content styling */
.crypto-main {
  background: linear-gradient(180deg, #121f2e 0%, #1c2a3b 100%) !important;
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
  width: 10px;
}

.crypto-drawer::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 5px;
}

.crypto-drawer::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.15);
}
</style>
