<script lang="ts" setup>
const snackbarStore = useSnackbarStore()
const { snackbar } = storeToRefs(snackbarStore)
</script>

<template>
  <v-snackbar
    v-model="snackbar.isVisible"
    timeout="2000"
    location="top right"
    :color="snackbar.type"
  >
    {{ snackbar.message || snackbarTypes.labelOf(snackbar.type) }}
  </v-snackbar>
</template>
