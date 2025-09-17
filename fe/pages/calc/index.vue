<template>
  <v-container>
    <v-card class="mx-auto pa-6" max-width="500" elevation="4">
      <v-card-title class="text-h5 font-weight-bold text-center">
        Upload File Excel
      </v-card-title>
      <v-card-text>
        <v-file-input v-model="file" label="Chọn file Excel" accept=".xlsx, .xls" prepend-icon="mdi-file-excel"
          variant="outlined" :error-messages="errorMessage" />
        <v-progress-linear v-if="uploading" v-model="progress" color="primary" height="10" rounded class="mt-4">
          <template v-slot:default="{ value }">
            {{ Math.round(value) }}%
          </template>
        </v-progress-linear>
        <v-btn color="primary" block class="mt-4" :disabled="!file || uploading" :loading="uploading"
          @click="uploadFile">
          Upload
        </v-btn>
        <v-alert v-if="message" :type="messageType" class="mt-4" dismissible>
          {{ message }}
        </v-alert>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import ky from 'ky'
definePageMeta({
  layout: 'blank'
})

const file = ref(null)
const uploading = ref(false)
const progress = ref(0)
const errorMessage = ref('')
const message = ref('')
const messageType = ref('success')

const uploadFile = async () => {
  if (!file.value) {
    errorMessage.value = 'Vui lòng chọn file Excel'
    return
  }

  const formData = new FormData()
  formData.append('files', file.value[0], file.value[0].name) // 'files' là tên field bạn đã dùng trong @UploadedFiles()

  // Debug kiểm tra đúng file
  const value = formData.get('files')
  console.log('Is File?', value instanceof File) // ✅ nên là true
  console.log('Value:', value)

  uploading.value = true
  errorMessage.value = ''
  message.value = ''

  try {
    const blob = await ky
      .post('https://api.dokasan.com/api/upload/excel', {
        body: formData,
        timeout: false, // nếu file lớn
        hooks: {
          beforeRequest: [
            () => {
              uploading.value = true
              progress.value = 0
            }
          ]
        }
      })
      .blob()

    // Tạo link tải
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'output.xlsx') // Tên file tải xuống
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    message.value = 'Tải file thành công!'
    messageType.value = 'success'
    file.value = null
  } catch (error) {
    const errMsg =
      error?.response && error?.response.status === 400
        ? 'File không hợp lệ hoặc lỗi server'
        : 'Upload thất bại, vui lòng thử lại.'
    message.value = errMsg
    messageType.value = 'error'
  } finally {
    uploading.value = false
    progress.value = 0
  }
}
</script>
<style scoped>
.v-card {
  border-radius: 12px;
}
</style>
