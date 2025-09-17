import { AxiosError } from 'axios'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = async (error: any) => {
    if (error instanceof AxiosError) {
      let generalErrorMessage = 'エラーが発生されています'
      if (error?.response?.status === 400) {
        generalErrorMessage = '正しく入力されていない項目があります'
      } else if (error?.response?.status === 404) {
        generalErrorMessage = '当該データが見つかりませんでした'
      }

      const errorResponse = await error?.response?.data
      const [{ message: zodSpecificMessage }] = errorResponse?.error || [{}]
      const { errorMessage: specificMessage } = errorResponse
      const { showSnackbar } = useSnackbarStore()
      showSnackbar({
        type: SnackbarTypes.error,
        message: specificMessage || zodSpecificMessage || generalErrorMessage
      })
    }
    throw error
  }
})
