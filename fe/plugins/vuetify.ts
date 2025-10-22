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
        color: "card",
        hover: true,
      },
      VList: { bgColor: "background", color: "text-primary" },
      VListItem: { rounded: "lg", density: "compact" },
      VCard: { elevation: 2, rounded: "lg", color: "card" },
      VBtn: {
        color: "primary",
        rounded: "lg",
        elevation: 0,
        density: "comfortable",
      },
      VPagination: { activeColor: "accent", color: "accent", size: "30px" },
      VAppBar: { color: "surface", elevation: 0 },
      VNavigationDrawer: { color: "background", elevation: 0 },
    },
    theme: {
      defaultTheme: "darkTheme",
      themes: {
        darkTheme: {
          dark: true,
          colors: {
            primary: "#0EB3E8",
            background: "#0D1A26",
            surface: "#1E1E2F",
            secondary: "#2A3B4C",
            accent: "#4FC3F7",
            success: "#00E676",
            error: "#FF5252",
            warning: "#FFC107",
            info: "#2196F3",
            "on-primary": "#FFFFFF",
            "on-background": "#E0E0E0",
            "on-surface": "#E0E0E0",
            "text-primary": "#E0E0E0",
            "text-secondary": "rgba(224, 224, 224, 0.7)",
            "text-disabled": "rgba(224, 224, 224, 0.38)",
            border: "#2A3B4C",
            hover: "rgba(255, 255, 255, 0.1)",
            card: "#1E1E2F",
            tableHeader: "#2A3B4C",
            tableRowHover: "rgba(255, 255, 255, 0.05)",
          },
        },
      },
    },
  });

  nuxtApp.vueApp.use(vuetify);
});
