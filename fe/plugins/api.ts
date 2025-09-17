import ky from 'ky-universal'

export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig()

  const alphaApiClient = createAPI(runtimeConfig.public.API_BASE_URL)
  const apis: any = { doka: alphaApiClient }

  return {
    provide: { apis }
  }
})

function createAPI(baseURL: string) {
  return ky.create({
    prefixUrl: baseURL,
    timeout: 30000,
    // credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    hooks: {
      beforeRequest: [
        request => {
          const token = localStorage.getItem('token')
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`)
          }
        }
      ],
      afterResponse: [
        (req, options, res) => {
          if (res.status === 401) {
            const currentPath = window.location.pathname

            // Nếu không nằm trong /calc hoặc các trang con của /calc
            if (!currentPath.startsWith('/calc')) {
              localStorage.removeItem('token')
              window.location.href = '/authentication/login'
            }
          }
        }
      ]
    }
  })
}
