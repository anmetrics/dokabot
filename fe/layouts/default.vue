<template>
  <v-app dark class="app-wrapper">
    <!-- TOP BAR -->
    <v-app-bar flat height="54" class="app-bar-glass">
      <v-app-bar-nav-icon
        @click="drawer = !drawer"
        class="bar-icon d-none d-sm-flex"
      />

      <v-toolbar-title @click="navigate('/')" class="brand"
        >Reveli</v-toolbar-title
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
  {
    title: "Trang chủ",
    short: "Home",
    icon: "mdi-view-dashboard-outline",
    to: "/",
  },
  {
    title: "Tài sản",
    short: "Tài sản",
    icon: "mdi-wallet-outline",
    to: "/assets",
  },
  {
    title: "Vị thế",
    short: "Vị thế",
    icon: "mdi-chart-line-variant",
    to: "/positions",
  },
  {
    title: "Lịch sử",
    short: "Lịch sử",
    icon: "mdi-history",
    to: "/transactions",
  },
  {
    title: "Giao dịch",
    short: "Trade",
    icon: "mdi-swap-horizontal-bold",
    to: "/trade",
  },
  {
    title: "Bán tự động",
    short: "Bán",
    icon: "mdi-cash-minus",
    to: "/sell-manager",
  },
  {
    title: "Cài đặt",
    short: "Cài đặt",
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
  background: #0f172a;
  color: #f1f5f9;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  letter-spacing: 0.02em;
}

/* --- TOP BAR --- */
.app-bar-glass {
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.brand {
  font-weight: 800;
  font-size: 1.3rem;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  transition: all 0.3s ease;
  cursor: pointer;
}
.brand:hover {
  transform: scale(1.05);
  filter: brightness(1.2);
}

/* --- ICON HOVER EFFECT --- */
.bar-icon {
  transition: all 0.3s ease;
}
.bar-icon:hover {
  color: #a78bfa;
  transform: scale(1.1);
}
.logout-btn {
  transition: all 0.3s ease;
}
.logout-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}
.logout-btn:hover v-icon {
  color: #ef4444;
}

/* --- DRAWER | SIDE MENU --- */
.drawer-glass {
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(30px) saturate(180%);
  border-right: 1px solid rgba(167, 139, 250, 0.1);
}

.menu-item {
  padding: 14px 18px;
  display: flex;
  gap: 16px;
  align-items: center;
  color: #94a3b8;
  border-radius: 14px;
  margin: 6px 16px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}
.menu-item:hover {
  background: rgba(167, 139, 250, 0.08);
  color: #a78bfa;
  transform: translateX(4px);
}
.menu-item.active {
  background: linear-gradient(
    90deg,
    rgba(124, 58, 237, 0.15),
    rgba(124, 58, 237, 0.05)
  );
  border: 1px solid rgba(124, 58, 237, 0.3);
  color: #a78bfa;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
}
.menu-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  background: linear-gradient(180deg, #7c3aed, #a78bfa);
  border-radius: 0 4px 4px 0;
}
.menu-item.active v-icon {
  color: #a78bfa;
}

.menu-item-container {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* --- BACKGROUND MAIN --- */
.content-layer {
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
  min-height: 100vh;
  padding-bottom: 70px;
  transition: background 0.3s ease;
  position: relative;
}
.content-layer::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 400px;
  background: radial-gradient(
    circle at 50% 0%,
    rgba(124, 58, 237, 0.1) 0%,
    transparent 70%
  );
  pointer-events: none;
}

/* --- MOBILE NAV FLOAT OVER GLASS --- */
.bottom-float-nav {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 420px;
  border-radius: 24px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid rgba(167, 139, 250, 0.2);
  padding: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.nav-btn {
  flex: 1;
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
  transition: all 0.3s ease;
}
.nav-btn v-icon {
  font-size: 22px;
  transition: all 0.3s ease;
}

/* ACTIVE GLOW */
.nav-btn .active {
  color: #a78bfa !important;
  font-weight: 600;
  text-shadow: 0 0 12px rgba(167, 139, 250, 0.6);
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
