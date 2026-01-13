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
            primary: "#7C3AED", // Purple primary
            background: "#0F172A", // Dark slate background
            surface: "#1E293B", // Card surface
            secondary: "#334155",
            accent: "#A78BFA", // Light purple accent
            success: "#10B981", // Green success
            error: "#EF4444", // Red error
            warning: "#F59E0B",
            info: "#3B82F6",
            "on-primary": "#FFFFFF",
            "on-background": "#F1F5F9",
            "on-surface": "#F1F5F9",
            "text-primary": "#F1F5F9",
            "text-secondary": "rgba(241, 245, 249, 0.7)",
            "text-disabled": "rgba(241, 245, 249, 0.38)",
            border: "#334155",
            hover: "rgba(167, 139, 250, 0.1)",
            card: "#1E293B",
            tableHeader: "#334155",
            tableRowHover: "rgba(167, 139, 250, 0.05)",
          },
        },
      },
    },
  });

  nuxtApp.vueApp.use(vuetify);
});
