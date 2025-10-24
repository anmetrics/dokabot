export default defineNuxtPlugin(() => {
  return {
    provide: {
      auth: {
        getToken: () => localStorage.getItem("jwt") || "",
        setToken: (token: string) => localStorage.setItem("jwt", token),
        clearToken: () => localStorage.removeItem("jwt"),
        isLoggedIn: () => !!localStorage.getItem("jwt"),
      },
    },
  };
});
