<template>
  <v-container
    class="fill-height d-flex flex-column align-center justify-center text-center"
  >
    <v-icon color="error" size="100">
      mdi-alert-circle-outline
    </v-icon>
    <h1 class="text-h2 font-weight-bold mt-4">
      {{ error.statusCode }}
    </h1>
    <h2 class="text-h5 mb-2">
      {{ title }}
    </h2>
    <p class="text-body-1 mb-6">
      {{ error.message }}
    </p>
    <v-btn color="primary" @click="navigateTo('/')">
      Go to Homepage
    </v-btn>
  </v-container>
</template>

<script setup lang="ts">
defineProps({
  error: {
    type: Object,
    required: true
  }
})

const title = computed(() => {
  if (error.statusCode === 404) { return 'Page Not Found' }
  return 'Something went wrong'
})
</script>
