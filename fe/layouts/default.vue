<template>
  <v-app dark class="app-wrapper">
    <!-- TOP BAR -->
    <v-app-bar flat height="54" class="app-bar-glass">
      <v-app-bar-nav-icon
        @click="drawer = !drawer"
        class="bar-icon d-none d-sm-flex"
      />

      <v-toolbar-title @click="navigate('/')" class="brand"
        >Doka</v-toolbar-title
      >

      <v-spacer />

      <!-- Toggle Theme -->
      <v-btn icon @click="toggleTheme">
        <v-icon size="20">mdi-weather-night</v-icon>
      </v-btn>

      <!-- Logout -->
      <v-btn icon class="logout-btn" @click="logout">
        <v-icon size="22">mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- DRAWER Desktop -->
    <v-navigation-drawer
      app
      v-model="drawer"
      width="230"
      class="drawer-glass d-none d-sm-flex"
    >
      <v-list density="compact" class="mt-3">
        <v-list-item
          v-for="item in menuItems"
          :key="item.to"
          @click="navigate(item.to)"
          :class="['menu-item', { active: isActive(item.to) }]"
        >
          <div class="menu-item-container">
            <v-icon size="22">{{ item.icon }}</v-icon>
            <span>{{ item.title }}</span>
          </div>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- MAIN PAGE -->
    <v-main class="content-layer">
      <NuxtPage />
    </v-main>

    <!-- MOBILE Floating Bottom Navigation -->
    <v-bottom-navigation
      v-model="currentTab"
      app
      elevation="0"
      class="bottom-float-nav d-sm-none"
    >
      <v-btn
        v-for="item in mobileMenuItems"
        :key="item.title"
        :value="item.to"
        @click="navigate(item.to)"
        class="nav-btn"
      >
        <v-icon :class="{ active: isActive(item.to) }">{{ item.icon }}</v-icon>
        <span :class="{ active: isActive(item.to) }">{{
          item.short || item.title
        }}</span>
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

/** 👉 Logout */
const logout = () => {
  authToken.value = "";
  navigateTo("/login");
};

const drawer = ref(true);
const currentTab = ref(route.path);

/** Menu Navigation */
const menuItems = [
  { title: "Home", short: "Home", icon: "mdi-home-outline", to: "/" },
  { title: "Buy Crypto", short: "Buy", icon: "mdi-cash-plus", to: "/buy" },
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

/** Bottom menu (No HOME) */
const mobileMenuItems = computed(() =>
  menuItems.filter((item) => item.to !== "/")
);

const isActive = (path: string) => route.path === path;
const navigate = (path: string) => {
  currentTab.value = path;
  router.push(path);
};

/** Theme Dark Mode Toggle */
const isDark = computed(() => theme.global.name.value === "dark");
const toggleTheme = () =>
  (theme.global.name.value = isDark.value ? "light" : "dark");
</script>

<style scoped>
/* --- GLOBAL DARK UI --- */
.app-wrapper {
  background: #0e121a;
  color: #cfd8dc;
  font-family: Inter, sans-serif;
  letter-spacing: 0.15px;
}

/* --- TOP BAR --- */
.app-bar-glass {
  background: rgba(15, 18, 28, 0.55);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.brand {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 1.1rem;
  letter-spacing: 0.5px;
  transition: 0.25s;
}
.brand:hover {
  color: #4fc3f7;
  transform: scale(1.07);
}

/* --- ICON HOVER EFFECT --- */
.bar-icon:hover {
  color: #4fc3f7;
  transform: scale(1.12);
}
.logout-btn:hover v-icon {
  color: #ff7675;
  transform: scale(1.14);
}

/* --- DRAWER | SIDE MENU --- */
.drawer-glass {
  background: rgba(18, 24, 38, 0.72);
  backdrop-filter: blur(24px);
  border-right: 1px solid rgba(255, 255, 255, 0.06);
}

.menu-item {
  padding: 12px 16px;
  display: flex;
  gap: 14px;
  align-items: center;
  color: #b7c6d3;
  border-radius: 10px;
  margin: 5px 12px;
  font-size: 0.88rem;
  transition: 0.25s;
}
.menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateX(6px);
}
.menu-item.active {
  background: linear-gradient(90deg, #4fc3f71b, #4fc3f705);
  border: 1px solid #4fc3f72e;
  color: #4fc3f7;
  box-shadow: 0 0 10px #4fc3f725;
}
.menu-item.active v-icon {
  color: #4fc3f7;
}

.menu-item-container {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* --- BACKGROUND MAIN --- */
.content-layer {
  background: radial-gradient(circle at top, #131823, #0e121a 70%);
  min-height: 100vh;
  padding-bottom: 70px;
  transition: 0.3s;
}

/* --- MOBILE NAV FLOAT OVER GLASS --- */
.bottom-float-nav {
  position: fixed;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: 88%;
  border-radius: 18px;
  background: rgba(20, 26, 40, 0.78);
  backdrop-filter: blur(22px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 4px 6px;
}

.nav-btn {
  flex: 1;
  font-size: 10px;
  color: #7f8f9f;
}
.nav-btn v-icon {
  font-size: 20px;
  transition: 0.2s;
}

/* ACTIVE GLOW */
.nav-btn .active {
  color: #4fc3f7 !important;
  font-weight: 600;
  text-shadow: 0 0 8px #4fc3f7;
}

/* RESPONSIVE */
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
