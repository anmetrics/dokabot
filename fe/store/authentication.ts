import { LoginPayload, RegisterPayload } from './types/authentication'

const defaultCurrentUser = {
  username: '',
  name: '',
  isLoggedIn: false
}

export const useAuthenticationStore = defineStore('auth', () => {
  const { $apis } = useNuxtApp()
  const isLoading = ref<boolean>(false)
  const currentUser = ref<CurrentUser>(defaultCurrentUser)

  async function login(payload: LoginPayload) {
    isLoading.value = true
    const userCredential = await $apis.doka
      .post('authentication/login', { json: payload })
      .json()
      .finally(() => {
        isLoading.value = false
      })
    if (userCredential.token) {
      currentUser.value = { ...userCredential?.user, isLoggedIn: true }
      localStorage.setItem('token', userCredential.token)
      navigateTo('/')
    }
  }

  async function register(payload: RegisterPayload) {
    isLoading.value = true
    const { user, token } = await $apis.doka
      .post('authentication/register', { json: payload })
      .json()
      .finally(() => {
        isLoading.value = false
      })

    currentUser.value = { ...user, isLoggedIn: false }
    localStorage.setItem('token', token)
    navigateTo('/')
  }

  async function checkUsernameExists(username: string): Promise<boolean> {
    isLoading.value = true
    const res = await $apis.doka
      .post('authentication/check-username', { json: { username } })
      .json()
      .finally(() => {
        isLoading.value = false
      })
    return res.isRegistered
  }

  async function checkEmailExists(email: string): Promise<boolean> {
    isLoading.value = true
    const res = await $apis.doka
      .post('authentication/check-email', { json: { email } })
      .json()
      .finally(() => {
        isLoading.value = false
      })
    return res.isRegistered
  }

  async function logout() {
    localStorage.removeItem('token')
    await $apis.doka.post('logout').json()
    currentUser.value = defaultCurrentUser
    navigateTo('login')
  }

  async function fetchMe() {
    const userCredential = await $apis.doka.get('user/me').json()
    currentUser.value = { ...userCredential, isLoggedIn: true }
  }

  return {
    currentUser,
    isLoading,
    login,
    register,
    logout,
    fetchMe,
    checkUsernameExists,
    checkEmailExists
  }
})
