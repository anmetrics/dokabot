import { VNodeRef } from 'vue'
import { ConcreteComponent } from 'nuxt/dist/app/compat/capi'

type DialogContent = ConcreteComponent | string

export interface Dialog {
  isVisible?: boolean
  isPersistent?: boolean
  data?: { [key: string]: any }
  content: DialogContent
}

export enum SnackbarTypes {
  error = 'error',
  success = 'success',
}

export const snackbarTypes = generateConstants({
  error: { value: SnackbarTypes.error, label: '失敗' },
  success: { value: SnackbarTypes.success, label: '成功' }
})

export interface Snackbar {
  isVisible?: boolean
  type: SnackbarTypes
  message?: string
}

export interface Breadcrumb {
  href?: string
  title: string
  disabled?: boolean
}

export type TemplateRef = VNodeRef | Element | ComponentPublicInstance | null

export const useAppStore = defineStore('app', () => {
  const meta = reactive({
    title: 'Home'
  })
  const isExpandSidebar = ref<Boolean>(true)

  return { meta, isExpandSidebar }
})

export const useSnackbarStore = defineStore('snackbar', () => {
  const snackbar = ref<Snackbar>({
    isVisible: false,
    type: SnackbarTypes.success,
    message: ''
  })

  function showSnackbar (snackbarInfo: Snackbar) {
    snackbar.value = {
      ...snackbarInfo,
      isVisible: true
    }
  }

  return { snackbar, showSnackbar }
})

export const useBreadcrumbStore = defineStore('breadcrumb', () => {
  const breadcrumbs = ref<Breadcrumb[]>([])

  function setBreadcrumbs (newBreadcrumbs: Breadcrumb[]) {
    breadcrumbs.value = newBreadcrumbs
  }

  return { breadcrumbs, setBreadcrumbs }
})

export const useDialogStore = defineStore('dialog', () => {
  const defaultDialog = { isVisible: false, isPersistent: false, data: undefined, content: '' }
  const dialog = ref<Dialog>(defaultDialog)

  function showDialog (content: DialogContent, data?: { [key: string]: any }) {
    dialog.value = { isVisible: true, isPersistent: false, content, data }
  }

  function showPersistentDialog (content: DialogContent, data?: { [key: string]: any }) {
    dialog.value = { isVisible: true, isPersistent: true, content, data }
  }

  function closeDialog () {
    dialog.value = defaultDialog
  }

  return { dialog, showDialog, showPersistentDialog, closeDialog }
})
