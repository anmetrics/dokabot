export default defineNuxtRouteMiddleware((to) => {
  if (to.path === "/authentication/login") return;

  const authToken = useCookie("auth_token");
  if (!authToken.value) {
    return navigateTo("/authentication/login");
  }
});
