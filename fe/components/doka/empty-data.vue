<script lang="ts" setup>
withDefaults(defineProps<{ text: string }>(), {
  text: '検索条件に当てはまる結果がありません。'
})
</script>
<template>
  <div class="doka-emptydata">
    <p class="text">
      {{ text }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.doka-emptydata {
  padding: 30px 25px;
  background-color: rgb(var(--v-theme-on-primary));
  border-radius: 8px;
  > .text {
    font-size: 14px;
    text-align: center;
    color: rgb(var(--v-theme-text));
  }
}
</style>
