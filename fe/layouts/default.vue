<template>
  <v-app dark>
    <!-- App Bar -->
    <v-app-bar flat class="crypto-app-bar">
      <v-app-bar-nav-icon
        @click="drawer = !drawer"
        class="ml-2 d-none d-sm-flex"
      />
      <v-toolbar-title
        class="font-weight-bold text-uppercase crypto-title"
        style="cursor: pointer"
        @click="navigate('/')"
      >
        Doka
      </v-toolbar-title>
      <v-spacer />

      <!-- Logout -->
      <v-btn icon @click="logout" aria-label="Logout" class="mr-1">
        <v-icon size="20">mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Navigation Drawer (desktop) -->
    <v-navigation-drawer
      v-model="drawer"
      app
      width="220"
      class="crypto-drawer d-none d-sm-flex"
    >
      <v-list dense nav class="pa-2">
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
          <v-icon class="crypto-list-icon" size="20">{{ item.icon }}</v-icon>
          <v-list-item-title class="crypto-list-title">
            {{ item.title }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
      <v-divider class="my-2" />
    </v-navigation-drawer>

    <!-- Main content -->
    <v-main class="crypto-main">
      <NuxtPage />
    </v-main>

    <!-- Bottom Navigation (mobile) -->
    <v-bottom-navigation
      v-model="currentTab"
      app
      color="#162537"
      height="56"
      class="crypto-bottom-nav d-sm-none"
    >
      <v-btn
        v-for="item in mobileMenuItems"
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
import { ref, computed } from "vue";
import { useRouter, useRoute, navigateTo } from "#app";
import { useTheme } from "vuetify";
import { useCookie } from "#app";

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
  { title: "Home", short: "Home", icon: "mdi-home-outline", to: "/" },
  // { title: "Market", short: "Market", icon: "mdi-home-outline", to: "/market" },
  { title: "Buy crypto", short: "Buy", icon: "mdi-cash-plus", to: "/buy" },
  {
    title: "Assets",
    short: "Assets",
    icon: "mdi-wallet-outline",
    to: "/assets",
  },
  {
    title: "Positions",
    short: "Positions",
    icon: "mdi-chart-line",
    to: "/positions",
  },
  {
    title: "History",
    short: "History",
    icon: "mdi-history",
    to: "/transactions",
  },
  {
    title: "Settings",
    short: "Settings",
    icon: "mdi-cog-outline",
    to: "/settings",
  },
];

// Filter out "Home" for mobile bottom navigation
const mobileMenuItems = computed(() =>
  menuItems.filter((item) => item.to !== "/")
);

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
  background: linear-gradient(135deg, #162537 0%, #1e2a40 60%, #0f1721 100%);
  color: #d0d0d0;
  border-bottom: 1px solid #2a3b4c;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  padding: 0 8px;
}
.crypto-title {
  font-size: 0.95rem;
}

/* Drawer */
.crypto-drawer {
  background: linear-gradient(180deg, #0d1a26 0%, #1a2635 100%);
  color: #d0d0d0;
  border-right: 1px solid #2a3b4c;
  transition: width 0.25s ease;
}
.crypto-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 46px;
  padding: 2px 14px;
  border-radius: 10px;
  margin: 6px 4px;
  transition: all 0.25s ease;
  cursor: pointer;
  font-size: 0.85rem;
}
.crypto-list-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
  transform: translateX(4px);
}
.crypto-list-item--active {
  background: linear-gradient(
    90deg,
    rgba(79, 195, 247, 0.3),
    rgba(79, 195, 247, 0.1)
  );
  color: #4fc3f7;
  box-shadow: inset 0 0 6px rgba(79, 195, 247, 0.3);
}
.crypto-list-icon {
  transition: all 0.25s ease;
  font-size: 18px;
}
.crypto-list-item:hover .crypto-list-icon {
  transform: scale(1.1);
  color: #4fc3f7;
}
.crypto-list-item--active .crypto-list-icon {
  color: #4fc3f7;
}

/* Main content */
.crypto-main {
  background: linear-gradient(180deg, #121f2e 0%, #1c2a3b 100%);
  color: #d0d0d0;
  min-height: calc(100vh - 56px);
  padding-bottom: 56px;
}

/* Bottom navigation (mobile) */
.crypto-bottom-nav {
  background: linear-gradient(180deg, #0d1a26 0%, #1a2635 100%) !important;
  border-top: 1px solid #2a3b4c;
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.25);
  position: fixed;
  bottom: 0;
  padding: 0 6px; /* khoảng cách 2 bên */
}

.crypto-bottom-btn {
  flex: 1;
  min-width: 36px; /* giảm min-width */
  padding: 0 2px;
  flex-direction: column;
  font-size: 0.7rem;
  text-transform: none;
}

.crypto-bottom-icon {
  font-size: 18px;
  transition: transform 0.25s ease;
}

.crypto-bottom-label {
  font-size: 10px;
  margin-top: 1px;
  color: #a0a0a0;
  transition: color 0.25s ease;
}

.crypto-bottom-label.active {
  color: #4fc3f7;
  font-weight: 500;
}

.crypto-bottom-btn:hover .crypto-bottom-icon {
  transform: scale(1.1);
  color: #4fc3f7;
}

/* Hide/show responsive */
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
