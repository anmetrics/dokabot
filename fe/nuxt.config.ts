import vuetify from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  ssr: false,
  app: {
    head: {
      title: 'Dokasan',
      meta: [{ name: 'description', content: 'Dokasan site' }]
    }
  },
  css: [
    'vuetify/lib/styles/main.sass',
    '@mdi/font/css/materialdesignicons.min.css',
    '@/assets/scss/vuetify.override.scss',
    '@/assets/scss/main.scss'
  ],
  modules: [
    [
      '@pinia/nuxt',
      {
        autoImports: ['defineStore', 'storeToRefs']
      }
    ],
    [
      '@vee-validate/nuxt',
      {
        // disable or enable auto imports
        autoImports: true,
        // Use different names for components
        componentNames: {
          Form: 'VeeForm',
          Field: 'VeeField',
          FieldArray: 'VeeFieldArray',
          ErrorMessage: 'VeeErrorMessage'
        }
      }
    ],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config: any) => {
        config.plugins?.push(
          vuetify({
            styles: {
              configFile: './assets/scss/vuetify.settings.scss'
            }
          })
        )
      })
    }
  ],
  imports: {
    dirs: ['store', 'utils']
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@import "@/assets/scss/utils/_mixins.scss";'
        }
      }
    }
  },
  runtimeConfig: {
    public: {
      BASE_URL: process.env.BASE_URL,
      API_BASE_URL: process.env.API_BASE_URL,
      ROOM_SET_ID: process.env.ROOM_SET_ID,
      ROOM_IN_SET_IDS: process.env.ROOM_IN_SET_IDS,
      BASIC_FEE_SERVICE_ID: process.env.BASIC_FEE_SERVICE_ID,
      EXTENSION_FEE_SERVICE_ID: process.env.EXTENSION_FEE_SERVICE_ID,
      ALL_DAY_FEE_SERVICE_ID: process.env.ALL_DAY_FEE_SERVICE_ID,
      CANCELLATION_FEE_SERVICE_ID: process.env.CANCELLATION_FEE_SERVICE_ID,
      INCURRED_FEE_SERVICE_ID: process.env.INCURRED_FEE_SERVICE_ID
    }
  }
})
