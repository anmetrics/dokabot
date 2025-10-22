import vuetify from "vite-plugin-vuetify";

export default defineNuxtConfig({
  css: ["vuetify/styles"],
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
});
