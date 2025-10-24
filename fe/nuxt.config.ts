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
  runtimeConfig: {},
});
