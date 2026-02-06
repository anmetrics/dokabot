<template>
  <v-app dark class="app-wrapper">
    <!-- TOP BAR -->
    <v-app-bar flat height="48" class="app-bar-glass">
      <v-app-bar-nav-icon
        @click="drawer = !drawer"
        class="bar-icon d-none d-sm-flex"
      />

      <div class="brand-wrapper" @click="navigate('/')">
        <div class="brand-icon">
          <v-icon size="20" color="white">mdi-chart-timeline-variant</v-icon>
        </div>
        <span class="brand">BNB</span>
      </div>

      <v-spacer />

      <!-- Toggle Theme -->
      <v-btn icon class="topbar-btn" @click="toggleTheme">
        <v-icon size="20">{{
          isDark ? "mdi-weather-night" : "mdi-white-balance-sunny"
        }}</v-icon>
      </v-btn>

      <!-- Logout -->
      <v-btn icon class="topbar-btn logout-btn" @click="logout">
        <v-icon size="20">mdi-logout</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- DRAWER Desktop -->
    <v-navigation-drawer
      app
      v-model="drawer"
      :width="isCollapsed ? 72 : 200"
      class="drawer-glass d-none d-sm-flex"
      :class="{ collapsed: isCollapsed }"
    >
      <!-- Drawer Header -->
      <div class="drawer-header">
        <span class="drawer-title" v-if="!isCollapsed">Menu</span>
        <v-btn
          icon
          size="x-small"
          class="collapse-btn"
          @click="isCollapsed = !isCollapsed"
          :class="{ collapsed: isCollapsed }"
        >
          <v-icon size="18">{{
            isCollapsed ? "mdi-chevron-right" : "mdi-chevron-left"
          }}</v-icon>
        </v-btn>
      </div>

      <v-list density="compact" class="menu-list">
        <v-list-item
          v-for="item in menuItems"
          :key="item.to"
          @click="navigate(item.to)"
          :class="['menu-item', { active: isActive(item.to) }]"
        >
          <v-tooltip :text="item.title" location="end" :disabled="!isCollapsed">
            <template v-slot:activator="{ props }">
              <div class="menu-item-container" v-bind="props">
                <div
                  class="menu-icon-wrapper"
                  :class="{ active: isActive(item.to) }"
                >
                  <v-icon>{{ item.icon }}</v-icon>
                </div>
                <span class="menu-title" v-if="!isCollapsed">{{
                  item.title
                }}</span>
              </div>
            </template>
          </v-tooltip>
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
        stacked
      >
        <v-icon size="14" :class="{ active: isActive(item.to) }">{{
          item.icon
        }}</v-icon>
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
const isCollapsed = ref(false);
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
    title: "ICT",
    short: "ICT",
    icon: "mdi-chart-timeline-variant-shimmer",
    to: "/ict-dashboard",
  },
  {
    title: "Thị trường",
    short: "Trade",
    icon: "mdi-swap-horizontal-bold",
    to: "/trade",
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
  // {
  //   title: "Bán tự động",
  //   short: "Bán",
  //   icon: "mdi-cash-minus",
  //   to: "/sell-manager",
  // },
  {
    title: "Sideway",
    short: "Sideway",
    icon: "mdi-swap-vertical-bold",
    to: "/sideway",
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
  menuItems.filter((item) => item.to !== "/"),
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
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  letter-spacing: 0.02em;
}

/* --- TOP BAR --- */
.app-bar-glass {
  background: linear-gradient(
    180deg,
    rgba(15, 23, 42, 0.95) 0%,
    rgba(15, 23, 42, 0.9) 100%
  );
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.brand-wrapper {
  margin-left: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.brand-wrapper:hover {
  transform: translateX(2px);
}

.brand-wrapper:hover .brand-icon {
  box-shadow: 0 3px 12px rgba(124, 58, 237, 0.5);
}

.brand-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  border-radius: 8px;
  box-shadow: 0 3px 10px rgba(124, 58, 237, 0.3);
  transition: all 0.3s ease;
}

.brand-icon .v-icon {
  font-size: 16px !important;
}

.brand {
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* --- TOP BAR BUTTONS --- */
.topbar-btn {
  width: 32px;
  height: 32px;
  margin-left: 4px;
  color: #94a3b8;
  background: rgba(167, 139, 250, 0.08);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.topbar-btn .v-icon {
  font-size: 18px !important;
}

.topbar-btn:hover {
  color: #f1f5f9;
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.25);
  transform: translateY(-1px);
}

.topbar-btn.logout-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

/* --- ICON HOVER EFFECT --- */
.bar-icon {
  width: 32px;
  height: 32px;
  color: #94a3b8;
  background: rgba(167, 139, 250, 0.08);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.bar-icon:hover {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.25);
}

/* --- DRAWER | SIDE MENU --- */
.drawer-glass {
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  border-right: 1px solid rgba(167, 139, 250, 0.1);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.drawer-glass.collapsed {
  overflow-x: hidden;
}

.drawer-header {
  padding: 14px 14px 12px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.1);
  background: rgba(124, 58, 237, 0.03);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.drawer-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
}

.drawer-title::before {
  content: "";
  width: 3px;
  height: 12px;
  background: linear-gradient(180deg, #7c3aed, #a78bfa);
  border-radius: 2px;
  flex-shrink: 0;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  min-width: 24px;
  flex-shrink: 0;
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.15);
  color: #94a3b8;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.3);
  color: #a78bfa;
  transform: scale(1.05);
}

.collapse-btn.collapsed {
  margin: 0 auto;
}

.menu-list {
  padding: 8px 6px;
  background: transparent;
}

.menu-item {
  padding: 0 !important;
  margin: 2px 0;
  border-radius: 8px;
  transition: all 0.2s ease;
  position: relative;
  min-height: auto;
}

.drawer-glass.collapsed .menu-item {
  padding-inline: 0 !important;
}

.menu-item:hover {
  background: rgba(167, 139, 250, 0.06);
}

.menu-item.active {
  background: linear-gradient(
    135deg,
    rgba(124, 58, 237, 0.12) 0%,
    rgba(167, 139, 250, 0.08) 100%
  );
}

.menu-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 50%;
  background: linear-gradient(180deg, #7c3aed, #a78bfa);
  border-radius: 0 3px 3px 0;
  transition: all 0.3s ease;
}

.drawer-glass.collapsed .menu-item.active::before {
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 3px;
  top: auto;
  bottom: 8px;
  border-radius: 3px 3px 0 0;
}

.menu-item-container {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  width: 100%;
}

.drawer-glass.collapsed .menu-item-container {
  justify-content: center;
  padding: 10px 0;
}

.menu-icon-wrapper {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(167, 139, 250, 0.08);
  border: 1px solid rgba(167, 139, 250, 0.1);
  border-radius: 8px;
  color: #94a3b8;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.menu-icon-wrapper .v-icon {
  font-size: 18px !important;
}

.menu-item:hover .menu-icon-wrapper {
  background: rgba(167, 139, 250, 0.12);
  border-color: rgba(167, 139, 250, 0.2);
  color: #a78bfa;
}

.menu-icon-wrapper.active {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 3px 10px rgba(124, 58, 237, 0.3);
}

.menu-title {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
}

.menu-item:hover .menu-title {
  color: #f1f5f9;
}

.menu-item.active .menu-title {
  color: #f1f5f9;
  font-weight: 600;
}

.drawer-glass.collapsed .menu-title {
  display: none;
}

.drawer-glass.collapsed .menu-icon-wrapper {
  margin: 0 auto;
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
  height: 500px;
  background: radial-gradient(
    ellipse 80% 50% at 50% -10%,
    rgba(124, 58, 237, 0.12) 0%,
    transparent 70%
  );
  pointer-events: none;
}

/* --- MOBILE NAV FLOAT OVER GLASS --- */
.bottom-float-nav {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  border-radius: 14px;
  background: linear-gradient(
    180deg,
    rgba(30, 41, 59, 0.98) 0%,
    rgba(15, 23, 42, 0.98) 100%
  );
  backdrop-filter: blur(30px) saturate(180%);
  border: 1px solid rgba(167, 139, 250, 0.15);
  padding: 5px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(167, 139, 250, 0.05) inset;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  align-items: center;
}

.nav-btn {
  font-size: clamp(6px, 1.2vw, 8px);
  color: #64748b;
  font-weight: 500;
  transition: all 0.2s ease;
  border-radius: 8px;
  padding: 6px 2px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.nav-btn span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  text-align: center;
}

.nav-btn:hover {
  background: rgba(167, 139, 250, 0.08);
}

.nav-btn :deep(.v-icon) {
  font-size: clamp(12px, 2.5vw, 18px) !important;
  transition: all 0.2s ease;
  margin-bottom: 2px;
}

/* ACTIVE GLOW */
.nav-btn .active {
  color: #a78bfa !important;
  font-weight: 600;
}

/* RESPONSIVE */
.d-sm-none {
  display: none;
}

@media (max-width: 600px) {
  .d-sm-none {
    display: grid !important;
  }
  .d-sm-flex {
    display: none !important;
  }

  .bottom-float-nav {
    width: 90%;
    padding: 4px;
    gap: 3px;
  }

  .nav-btn {
    padding: 5px 2px;
  }
}

@media (max-width: 450px) {
  .bottom-float-nav {
    padding: 4px 3px;
    gap: 2px;
  }

  .nav-btn {
    padding: 4px 1px;
  }
}

@media (max-width: 380px) {
  .bottom-float-nav {
    width: 92%;
    padding: 3px;
    gap: 2px;
  }

  .nav-btn {
    padding: 4px 1px;
  }
}

@media (max-width: 340px) {
  .bottom-float-nav {
    width: 94%;
    padding: 3px 2px;
    gap: 1px;
  }

  .nav-btn {
    padding: 3px 0.5px;
  }
}

@media (max-width: 1024px) {
  .drawer-header {
    padding: 12px;
  }

  .menu-item-container {
    padding: 6px 8px;
  }

  .drawer-glass.collapsed .menu-item-container {
    padding: 8px 0;
  }

  .menu-icon-wrapper {
    width: 30px;
    height: 30px;
    min-width: 30px;
    min-height: 30px;
  }

  .menu-icon-wrapper .v-icon {
    font-size: 16px !important;
  }

  .menu-title {
    font-size: 12px;
  }

  .drawer-glass.collapsed .menu-item.active::before {
    width: 20px;
    bottom: 6px;
  }
}

/* Ensure tooltip works well with collapsed sidebar */
.v-tooltip > .v-overlay__content {
  background: rgba(30, 41, 59, 0.98);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(167, 139, 250, 0.2);
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #f1f5f9;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
</style>
