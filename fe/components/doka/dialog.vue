<script lang="ts" setup>
const dialogStore = useDialogStore()
const { dialog } = storeToRefs(dialogStore)
</script>

<template>
  <v-dialog
    v-model="dialog.isVisible"
    width="auto"
    :persistent="dialog.isPersistent"
  >
    <!-- eslint-disable vue/no-v-html -->
    <div
      v-if="typeof dialog.content === 'string'"
      class="content"
      v-html="dialog.content"
    />
    <component :is="dialog.content" v-else />
  </v-dialog>
</template>
