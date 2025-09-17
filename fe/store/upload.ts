export const useUploadStore = defineStore('upload', () => {
  const { $apis } = useNuxtApp()
  const isLoading = ref<boolean>(false)

  async function upload(formData: FormData) {
    isLoading.value = true
    const result = await $apis.doka
      .post('upload/excel', { json: formData })
      .json()
      .finally(() => {
        isLoading.value = false
      })
    return result
  }

  return {
    upload
  }
})
