<script lang="ts" setup>
const appStore = useAppStore()
const { isExpandSidebar } = storeToRefs(appStore)

const authenticationStore = useAuthenticationStore()
const { currentUser } = storeToRefs(authenticationStore)

if (!currentUser.value.isLoggedIn) {
  await authenticationStore.fetchMe()
}
</script>

<template>
  <v-app class="layout-default">
    <v-navigation-drawer
      :scrim="$route.path !== '/bookings-schedule'"
      width="220"
    >
      <doka-sidebar />
    </v-navigation-drawer>
    <v-main class="main-content">
      <v-app-bar height="50" scroll-behavior="fade-image elevate">
        <doka-header />
      </v-app-bar>
      <doka-breadcrumb />
      <NuxtPage />
    </v-main>
    <doka-snackbar />
    <doka-dialog />
    <doka-bottom-navigation v-if="$vuetify.display.smAndDown" />
  </v-app>
</template>

<style lang="scss" scoped>
.main-content {
  background-color: rgb(var(--v-theme-background));
}
</style>
