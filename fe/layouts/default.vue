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

      <div class="d-flex align-center">
        <v-btn
          class="import-wallet-btn text-none font-weight-bold text-white position-relative overflow-hidden mr-4"
          @click="navigate('/import-wallet')"
        >
          <span class="btn-content d-flex align-center text-white">
            <v-icon start size="22" color="white"
              >mdi-wallet-plus-outline</v-icon
            >
            Import ví
          </span>

          <!-- Shine effect -->
          <span class="shine"></span>
        </v-btn>

        <!-- Logout -->
        <v-btn icon @click="logout" aria-label="Logout">
          <v-icon size="20">mdi-logout</v-icon>
        </v-btn>
      </div>
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
const authToken = useCookie("auth_token", {
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "none",
  secure: true,
});

const logout = () => {
  authToken.value = "";
  navigateTo("/login");
};

const drawer = ref(true);
const currentTab = ref(route.path);

const menuItems = [
  { title: "Home", short: "Home", icon: "mdi-home-outline", to: "/" },
  { title: "My bot", short: "My bot", icon: "mdi-home-outline", to: "/my-bot" },
  { title: "Buy crypto", short: "Buy", icon: "mdi-cash-plus", to: "/buy" },
  {
    title: "Wallet",
    short: "Wallet",
    icon: "mdi-wallet-outline",
    to: "/wallet",
  },
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

const mobileMenuItems = computed(() =>
  menuItems.filter((item) => item.to !== "/")
);

const isActive = (path: string) => route.path === path;
const navigate = (path: string) => {
  currentTab.value = path;
  router.push(path);
};
</script>

<style scoped>
/* App bar */
.crypto-app-bar {
  background: linear-gradient(135deg, #162537 0%, #1e2a40 60%, #0f1721 100%);
  color: #d0d0d0;
  border-bottom: 1px solid #2a3b4c;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(8px);
  padding: 0 16px;
  height: 64px !important;
}

.import-wallet-btn {
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  padding: 4px 8px !important;
  height: 32px !important;
  font-size: 0.95rem;
  letter-spacing: 0.8px;
  background: #096fd6;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  z-index: 1;
}

.import-wallet-btn:hover {
  transform: translateY(-2px) scale(1.01);
}

.import-wallet-btn::before {
  content: "";
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  animation: borderSpin 6s linear infinite;
  z-index: -1;
  opacity: 0.8;
}

/* Hiệu ứng sáng lướt qua khi hover */
.shine {
  position: absolute;
  top: -50%;
  left: -100%;
  width: 50px;
  height: 200%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.5),
    transparent
  );
  transform: rotate(30deg);
  transition: left 0.8s;
}

.import-wallet-btn:hover .shine {
  left: 120%;
  transition: left 0.8s;
}

/* Animation */
@keyframes gradientMove {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes borderSpin {
  0% {
    background-position: 0% 0%;
  }
  100% {
    background-position: 100% 0%;
  }
}

/* Responsive: Mobile vẫn đẹp */
@media (max-width: 600px) {
  .import-wallet-btn {
    padding: 10px 20px !important;
    font-size: 0.9rem;
    height: 44px !important;
  }
  .import-wallet-btn .v-icon {
    font-size: 20px !important;
  }
}

/* Các style cũ giữ nguyên */
.crypto-title {
  font-size: 0.95rem;
  user-select: none;
  cursor: pointer;
}
.crypto-drawer {
  background: linear-gradient(180deg, #0d1a26 0%, #1a2635 100%);
  color: #d0d0d0;
  border-right: 1px solid #2a3b4c;
}
.crypto-main {
  background: linear-gradient(180deg, #121f2e 0%, #1c2a3b 100%);
  color: #d0d0d0;
  min-height: calc(100vh - 56px);
  padding-bottom: 56px;
}

/* Bottom nav & responsive */
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
