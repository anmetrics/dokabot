<template>
  <v-app dark>
    <!-- App Bar -->
    <v-app-bar flat class="crypto-app-bar">
      <v-app-bar-nav-icon
        @click="drawer = !drawer"
        class="ml-3 d-none d-sm-flex"
      />
      <v-toolbar-title class="font-weight-bold text-uppercase">
        Doka
      </v-toolbar-title>
      <v-spacer />

      <!-- Logout -->
      <v-btn icon @click="logout" aria-label="Logout" class="mr-2">
        <v-icon>mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Navigation Drawer (desktop only) -->
    <v-navigation-drawer
      v-model="drawer"
      app
      width="250"
      class="crypto-drawer d-none d-sm-flex"
    >
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

    <!-- Main content -->
    <v-main class="crypto-main">
      <NuxtPage />
    </v-main>

    <!-- ✅ Bottom Navigation (mobile only) -->
    <v-bottom-navigation
      v-model="currentTab"
      app
      color="#162537"
      height="64"
      class="crypto-bottom-nav d-sm-none"
    >
      <v-btn
        v-for="item in menuItems"
        :key="item.title"
        @click="navigate(item.to)"
        :value="item.to"
        class="crypto-bottom-btn"
      >
        <v-icon
          :color="isActive(item.to) ? '#4fc3f7' : '#a0a0a0'"
          class="crypto-bottom-icon"
        >
          {{ item.icon }}
        </v-icon>
        <span :class="['crypto-bottom-label', { active: isActive(item.to) }]">
          {{ item.short || item.title }}
        </span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "#app";
import { useTheme } from "vuetify";
import { useCookie, navigateTo } from "#app";

const router = useRouter();
const route = useRoute();
const theme = useTheme();
const authToken = useCookie("auth_token");

const logout = () => {
  authToken.value = "";
  navigateTo("/login");
};

const drawer = ref(true);
const currentTab = ref(route.path);

const menuItems = [
  { title: "Trang chủ", short: "Home", icon: "mdi-home-outline", to: "/" },
  {
    title: "Tài sản",
    short: "Tài sản",
    icon: "mdi-wallet-outline",
    to: "/assets",
  },
  {
    title: "Vị thế",
    short: "Vị thế",
    icon: "mdi-chart-line",
    to: "/positions",
  },
  {
    title: "Lịch sử",
    short: "Lịch sử",
    icon: "mdi-history",
    to: "/transactions",
  },
  {
    title: "Cài đặt",
    short: "Cài đặt",
    icon: "mdi-cog-outline",
    to: "/settings",
  },
];

const isActive = (path: string) => route.path === path;
const navigate = (path: string) => {
  currentTab.value = path;
  router.push(path);
};

const isDark = computed(() => theme.global.name.value === "dark");
const toggleTheme = () =>
  (theme.global.name.value = isDark.value ? "light" : "dark");
</script>

<style scoped>
/* App bar */
.crypto-app-bar {
  background: linear-gradient(135deg, #162537 0%, #20354b 60%, #0f1721 100%);
  color: #e0e0e0;
  border-bottom: 1px solid #2a3b4c;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(12px);
}

/* Drawer */
.crypto-drawer {
  background: linear-gradient(180deg, #0d1a26 0%, #1a2635 100%);
  color: #e0e0e0;
  border-right: 1px solid #2a3b4c;
  transition: width 0.3s ease;
}

.crypto-list-item {
  display: flex;
  align-items: center;
  gap: 20px;
  height: 54px;
  padding: 4px 20px;
  border-radius: 12px;
  margin: 10px 6px;
  transition: all 0.3s ease;
  cursor: pointer;
}
.crypto-list-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateX(6px);
}
.crypto-list-item--active {
  background: linear-gradient(
    90deg,
    rgba(30, 136, 229, 0.4),
    rgba(30, 136, 229, 0.15)
  );
  color: #4fc3f7;
  box-shadow: inset 0 0 10px rgba(30, 136, 229, 0.4);
}
.crypto-list-icon {
  color: inherit;
  transition: all 0.3s ease;
}
.crypto-list-item:hover .crypto-list-icon {
  transform: scale(1.15);
  color: #4fc3f7;
}
.crypto-list-item--active .crypto-list-icon {
  color: #4fc3f7;
}

/* Main content */
.crypto-main {
  background: linear-gradient(180deg, #121f2e 0%, #1c2a3b 100%) !important;
  color: #e0e0e0;
  min-height: calc(100vh - 64px);
  padding-bottom: 64px; /* Prevent bottom nav overlap */
}

/* ✅ Bottom navigation (mobile) */
.crypto-bottom-nav {
  background: linear-gradient(180deg, #0d1a26 0%, #1a2635 100%) !important;
  border-top: 1px solid #2a3b4c;
  box-shadow: 0 -3px 8px rgba(0, 0, 0, 0.3);
  position: fixed;
  bottom: 0;
}

.crypto-bottom-btn {
  flex: 1;
  flex-direction: column;
  min-width: 0;
  text-transform: none;
}

.crypto-bottom-icon {
  font-size: 22px;
  transition: transform 0.3s ease;
}
.crypto-bottom-label {
  font-size: 12px;
  margin-top: 2px;
  color: #a0a0a0;
  transition: color 0.3s ease;
}
.crypto-bottom-label.active {
  color: #4fc3f7;
  font-weight: 500;
}
.crypto-bottom-btn:hover .crypto-bottom-icon {
  transform: scale(1.2);
  color: #4fc3f7;
}

/* Hide elements */
.d-sm-none {
  display: none;
}
@media (max-width: 600px) {
  .d-sm-none {
    display: flex !important;
  }
  .d-sm-flex {
    display: none !important;
  }
}
</style>
