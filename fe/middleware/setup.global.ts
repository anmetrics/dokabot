export default defineNuxtRouteMiddleware(to => {
  // Chỉ chạy trên client để tránh lỗi localStorage trên server
  if (process.client) {
    const token = localStorage.getItem('token') // Giả sử token lưu với key 'jwt'
    return

    if (to.path.startsWith('/calc') || to.path.startsWith('/trade')) {
      return
    }

    if (!token && !to.path.startsWith('/authentication')) {
      return navigateTo('/authentication/login')
    }

    // Nếu đang ở trang login hoặc register và có token, chuyển hướng về home
    if (
      token &&
      (to.path === '/authentication/login' ||
        to.path === '/authentication/register')
    ) {
      return navigateTo('/')
    }
  }
})
