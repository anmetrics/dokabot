<template>
  <v-app class="layout-anonymous">
    <v-main class="main-content" :style="{ minHeight: '100vh' }">
      <NuxtPage />
    </v-main>
  </v-app>
</template>

<style scoped lang="scss">
.layout-anonymous {
  background-color: rgb(var(--v-theme-background));
  /* Có thể thêm background gradient, ảnh nền ở đây nếu muốn */
}

.main-content {
  background-color: inherit;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  /* Giúp căn giữa nội dung login hoặc các form */
  min-height: 100vh; /* Đảm bảo chiều cao full màn hình */
}
</style>
