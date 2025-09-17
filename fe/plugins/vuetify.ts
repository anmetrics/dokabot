import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { VDataTable } from 'vuetify/labs/VDataTable'
// Vuetify comes with vite-plugin-vuetify that enable automatic treeshaking.
// Vuetify components and directives will be automatically imported

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components: {
      VDataTable
    },
    icons: {
      defaultSet: 'mdi',
      aliases,
      sets: {
        mdi
      }
    },
    defaults: {
      VCheckbox: {
        hideDetails: 'auto',
        color: 'primary',
        density: 'compact'
      },
      VRadio: {
        hideDetails: 'auto',
        color: 'primary',
        density: 'compact'
      },
      VRadioGroup: {
        hideDetails: 'auto',
        color: 'primary',
        density: 'compact'
      },
      VSelect: {
        hideDetails: 'auto',
        color: 'primary',
        density: 'compact',
        variant: 'outlined'
      },
      VAutocomplete: {
        hideDetails: 'auto',
        color: 'primary',
        density: 'compact',
        variant: 'outlined'
      },
      VTextarea: {
        hideDetails: 'auto',
        color: 'primary',
        variant: 'outlined'
      },
      VTextField: {
        hideDetails: 'auto',
        color: 'primary',
        density: 'compact',
        variant: 'outlined'
      },
      VList: {
        bgColor: '#FFFFFF',
        color: 'primary'
      },
      VPagination: {
        activeColor: '#FFFFFF',
        size: '30px',
        color: 'primary'
      },
      VDataTable: {
        height: '100%',
        fixedHeader: true,
        noDataText: 'データーが見つけられませんでした。'
      },
      VBreadcrumbs: {
        color: 'primary'
      }
    },
    theme: {
      defaultTheme: 'defaultTheme',
      themes: {
        defaultTheme: {
          dark: false,
          colors: {
            primary: '#174E69',
            background: '#f9f9f7',
            'success-darken': '#007F5F',
            error: '#CD2B21',
            'on-primary': '#FFFFFF',
            'on-background': '#212321',
            border: '#CBCDCB',
            text: '#212321',
            'on-text': '#666666',
            'text-placeholder': '#8C8F8C',
            'primary-light': '#E2EAED',
            'primary-lighten': '#0077B5',
            'background-disabled': '#E4E5E4',
            warning: '#FCE2AC',
            'in-warning': '#E99E00',
            active: '#CFF2FD',
            'on-active': '#0EB3E8',
            'success-lighten': '#A5FFA2',
            'cocktail-style': '#FF7175',
            'background-jp-holiday': '#F5F6CE'
          }
        }
      }
    }
  })

  nuxtApp.vueApp.use(vuetify)
})
