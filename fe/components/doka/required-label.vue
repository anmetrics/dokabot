<script lang="ts" setup>
withDefaults(defineProps<{ requiredLabel?: string }>(), {
  requiredLabel: '必須'
})
</script>

<template>
  <span class="required">{{ requiredLabel }}</span>
</template>

<style scoped>
.required {
  display: inline-block;
  margin-left: 8px;
  padding: 0 6px;
  border-radius: 2px;
  color: rgb(var(--v-theme-on-primary));
  background-color: rgb(var(--v-theme-error));
  font-size: 10px;
  line-height: 18px;
}
</style>
