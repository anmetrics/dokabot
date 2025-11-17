export default defineNuxtRouteMiddleware((to) => {
  if (to.path === "/authentication/login") return;

  const authToken = useCookie("auth_token", {
    maxAge: 60 * 60 * 24 * 30, // 30d
    sameSite: "none",
    secure: true,
  });
  if (!authToken.value) {
    return navigateTo("/authentication/login");
  }
});
