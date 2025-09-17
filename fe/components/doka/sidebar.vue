<script setup>
const appRoute = useRoute()

const openedMenus = ref([])
const appStore = useAppStore()
const authStore = useAuthenticationStore()
const { isExpandSidebar } = storeToRefs(appStore)
watch(isExpandSidebar, isExpand => {
  if (!isExpand) {
    openedMenus.value = []
  }
})
watch(openedMenus, opened => {
  if (opened.length) {
    isExpandSidebar.value = true
  }
})

function handleLogout() {
  localStorage.removeItem('token')
  navigateTo('login')
}
</script>

<template>
  <!-- Số dư tài khoản -->
  <v-container class="pa-2" fluid>
    <v-list-item
      prepend-avatar="https://randomuser.me/api/portraits/men/1.jpg"
      :title="authStore.currentUser?.username"
      subtitle="Personal account"
      class="balance-section"
    />

    <!-- Menu -->
    <v-list>
      <v-list-item
        prepend-icon="mdi-home"
        title="Home"
        to="/claim"
        class="ma-1"
      />
      <v-list-item
        prepend-icon="mdi-cash"
        title="Assets"
        to="/assets"
        class="ma-1"
      />
      <v-list-item
        prepend-icon="mdi-transfer"
        title="Transactions"
        to="/transactions"
        class="ma-1"
      />
      <!-- <v-list-item prepend-icon="mdi-link" title="Stake" to="/stake">
        <template #append>
          <v-badge content="12" color="primary" inline />
        </template>
      </v-list-item> -->
      <!-- <v-list-item
        prepend-icon="mdi-bank"
        title="Organization tree"
        to="/tree"
        class="ma-1"
      ></v-list-item> -->
      <!-- <v-list-item
        prepend-icon="mdi-gift"
        title="Rewards"
        to="/rewards"
        class="ma-1"
      />
      <v-list-item
        prepend-icon="mdi-cog"
        title="Settings"
        :to="{ path: '/settings' }"
      /> -->
    </v-list>
  </v-container>
  <!-- Menu Settings -->
  <v-spacer />

  <!-- Nút Logout cố định ở đáy -->
  <div class="logout-wrapper">
    <v-container class="pa-2 pt-0" fluid>
      <v-list>
        <v-list-item
          prepend-icon="mdi-logout"
          title="Logout"
          class="logout-item"
          @click="handleLogout"
        />
      </v-list>
    </v-container>
  </div>
</template>
<style scoped lang="scss">
.sidebar {
  width: 250px !important;
  height: 100vh;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  padding-top: 20px; /* Khoảng cách với top là 20px */
}

.balance-section {
  margin-top: 30px;
  margin-bottom: 20px;
}

.balance-section .v-list-item__title {
  font-size: 24px;
  font-weight: bold;
}

.balance-section .v-list-item__subtitle {
  font-size: 14px;
  color: #666;
}

.v-list-item--active {
  background-color: #204274 !important; /* Màu nền xanh nhạt */
  color: #ffffff !important; /* Màu chữ xanh đậm */
}

.v-list-item {
  border-radius: 10px; /* Bo góc 10px cho tất cả v-list-item */
}

.v-list-item:hover {
  background-color: #f0f0f0; /* Màu nền khi hover */
}

.logout-wrapper {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
}
</style>
