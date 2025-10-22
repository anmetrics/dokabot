<template>
  <v-app dark>
    <!-- App Bar -->
    <v-app-bar flat class="threads-app-bar">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>Dokabot</v-toolbar-title>
      <v-spacer />
    </v-app-bar>

    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-model="drawer"
      app
      width="280"
      class="threads-drawer"
    >
      <v-list dense nav>
        <v-list-item
          v-for="item in menuItems"
          :key="item.title"
          :to="item.to"
          :class="[
            'threads-list-item',
            { 'threads-list-item--active': isActive(item.to) },
          ]"
          @click="navigate(item.to)"
        >
          <v-icon>{{ item.icon }}</v-icon>
          <v-list-item-title>{{ item.title }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Main Content -->
    <v-main class="threads-main">
      <v-container fluid>
        <NuxtPage />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from "#app";

const router = useRouter();
const route = useRoute();
const drawer = ref(true);

const menuItems = [
  { title: "Trang chủ", icon: "mdi-home-outline", to: "/" },
  { title: "Tài sản", icon: "mdi-home-outline", to: "/assets" },
  { title: "Vị thế", icon: "mdi-account-circle-outline", to: "/positions" },
  { title: "Lịch sử", icon: "mdi-message-text-outline", to: "/histories" },
  {
    title: "Lịch sử giao dịch",
    icon: "mdi-message-text-outline",
    to: "/transactions",
  },
  { title: "Cài đặt", icon: "mdi-cog-outline", to: "/settings" },
];

const isActive = (path: string) => route.path === path;
const navigate = (path: string) => router.push(path);
</script>

<style scoped>
/* App bar kiểu Threads */
.threads-app-bar {
  background-color: #1a1a1a !important;
  color: #ffffff;
  box-shadow: none;
  border-bottom: 1px solid #2a2a2a;
}

/* Drawer tối, phẳng, subtle shadow */
.threads-drawer {
  background-color: #121212 !important;
  color: #ffffff;
  border-right: 1px solid #2a2a2a;
}

/* List item kiểu phẳng như Threads */
.threads-list-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-radius: 12px;
  transition: background 0.2s ease;
  color: #ffffff;
}
.threads-list-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}
.threads-list-item--active {
  background-color: rgba(24, 144, 255, 0.2); /* subtle accent */
  color: #ffffff;
}

/* Icon */
.threads-list-item v-icon {
  color: #ffffff;
}

/* Main container */
.threads-main {
  background-color: #181818 !important;
  color: #ffffff;
  min-height: 100vh;
}
</style>
