import vuetify from "vite-plugin-vuetify";

export default defineNuxtConfig({
  ssr: false,
  css: [
    "vuetify/styles",
    "@mdi/font/css/materialdesignicons.min.css",
    "vuetify/lib/styles/main.sass",
  ],
  build: {
    transpile: ["vuetify"],
  },
  vite: {
    plugins: [
      vuetify({
        autoImport: true,
      }),
    ],
  },
  devServer: {
    port: 3001,
  },
  runtimeConfig: {
    public: {
      // Set NUXT_PUBLIC_API_BASE_URL per environment; never hardcode a host.
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api",
    },
  },
});
