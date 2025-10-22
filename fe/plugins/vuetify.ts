import { createVuetify } from "vuetify";
import { aliases, mdi } from "vuetify/iconsets/mdi";
import * as components from "vuetify/components";

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    icons: {
      defaultSet: "mdi",
      aliases,
      sets: { mdi },
    },
    defaults: {
      VCheckbox: { hideDetails: "auto", color: "primary", density: "compact" },
      VRadio: { hideDetails: "auto", color: "primary", density: "compact" },
      VRadioGroup: {
        hideDetails: "auto",
        color: "primary",
        density: "compact",
      },
      VSelect: {
        hideDetails: "auto",
        color: "primary",
        density: "compact",
        variant: "outlined",
      },
      VAutocomplete: {
        hideDetails: "auto",
        color: "primary",
        density: "compact",
        variant: "outlined",
      },
      VTextarea: { hideDetails: "auto", color: "primary", variant: "outlined" },
      VTextField: {
        hideDetails: "auto",
        color: "primary",
        density: "compact",
        variant: "outlined",
      },
      VDataTable: {
        height: "100%",
        fixedHeader: true,
        noDataText: "Không có dữ liệu.",
      },
      VList: { bgColor: "#1B1B1F", color: "#FFFFFF" },
      VCard: { elevation: 2, rounded: "lg", color: "#1E1E2F" },
      VBtn: { color: "primary", rounded: "lg", elevation: 0 },
      VPagination: { activeColor: "#0EB3E8", color: "#0EB3E8", size: "30px" },
    },
    theme: {
      defaultTheme: "darkTheme",
      themes: {
        darkTheme: {
          dark: true,
          colors: {
            primary: "#0EB3E8",
            background: "#121212",
            surface: "#1E1E2F",
            secondary: "#2A2A3A",
            accent: "#0EB3E8",
            success: "#4CAF50",
            error: "#F44336",
            warning: "#FFC107",
            info: "#2196F3",
            "on-primary": "#FFFFFF",
            "on-background": "#FFFFFF",
            "on-surface": "#FFFFFF",
            "text-primary": "#FFFFFF",
            "text-secondary": "rgba(255,255,255,0.7)",
            "text-disabled": "rgba(255,255,255,0.38)",
            border: "#2A2A3A",
            hover: "rgba(255,255,255,0.08)",
            card: "#1E1E2F",
            tableHeader: "#2A2A3A",
            tableRowHover: "rgba(255,255,255,0.05)",
          },
        },
      },
    },
  });

  nuxtApp.vueApp.use(vuetify);
});
