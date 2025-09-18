<script lang="ts" setup>
const appStore = useAppStore()
const { isExpandSidebar } = storeToRefs(appStore)
const authenticationStore = useAuthenticationStore()
const { currentUser } = storeToRefs(authenticationStore)
</script>
<template>
  <header class="doka-header">
    <v-btn icon="mdi-menu" @click="isExpandSidebar = !isExpandSidebar" />
    <nuxt-link to="/" class="logo">
      <img src="/images/logo.png" class="image" alt="logo" />
    </nuxt-link>
    <div class="Dokabot">Dokabot</div>
    <v-spacer />
    <div v-if="!!currentUser.isLoggedIn" class="actions"></div>
  </header>
</template>

<style lang="scss" scoped>
.doka-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 10px 10px 5px;

  > .logo > .image {
    margin-top: 10px;
    width: 30px;
  }

  /* Style for the Dokabot text */
  > div.Dokabot {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; /* Modern, clean font */
    font-size: 1.5rem; /* Slightly larger size */
    font-weight: 600; /* Semi-bold for emphasis */
    color: rgb(
      var(--v-theme-primary)
    ); /* Use theme primary color for consistency */
    letter-spacing: 0.02em; /* Subtle letter spacing for elegance */
    text-transform: uppercase; /* Uppercase for a bold, branded look */
    margin-left: 10px; /* Space from the logo */
    transition: color 0.3s ease; /* Smooth color transition on hover */

    &:hover {
      color: rgb(
        var(--v-theme-secondary)
      ); /* Optional: Change color on hover */
      cursor: pointer; /* Indicate interactivity */
    }
  }

  > .actions {
    gap: 0.5rem;
  }
  > .actions > .action {
    padding: 0 12px;
    &:hover {
      color: rgb(var(--v-theme-primary));
      cursor: pointer;
    }
  }
  > .actions > .action.-account {
    border-right: thin solid rgb(var(--v-theme-text-placeholder));
  }
  > .actions > .action.-account > .icon {
    margin-right: 8px;
  }
  > .actions > .action.-logout {
    font-weight: 700;
    color: rgb(var(--v-theme-primary));
  }
}
</style>
