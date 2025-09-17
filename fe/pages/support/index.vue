<template>
  <v-container fluid class="pa-0">
    <v-card class="elevation-0 rounded-lg">
      <!-- Header -->
      <v-card-title class="primary white--text pa-5">
        <v-icon left color="white">
          mdi-face-agent
        </v-icon>
        <span class="text-h5 font-weight-bold">Support Center</span>
        <v-spacer />
        <v-btn icon color="white">
          <v-icon>mdi-dots-vertical</v-icon>
        </v-btn>
      </v-card-title>

      <v-row no-gutters class="pa-4">
        <!-- Contact Form Section -->
        <v-col cols="12" md="6" class="pa-2">
          <v-card class="pa-6 rounded-lg" elevation="2">
            <v-card-text class="pa-0">
              <h3 class="text-h6 font-weight-bold mb-4">
                Contact Us
              </h3>
              <v-form ref="form" v-model="valid" @submit.prevent="submitForm">
                <v-select
                  v-model="form.category"
                  :items="categories"
                  label="Issue Category"
                  outlined
                  dense
                  :rules="[rules.required]"
                  class="mb-3"
                />
                <v-textarea
                  v-model="form.message"
                  label="Your Message"
                  outlined
                  dense
                  :rules="[rules.required, rules.minMessage]"
                  rows="4"
                />
                <v-btn
                  color="primary"
                  rounded
                  :disabled="!valid"
                  type="submit"
                  class="mt-2"
                >
                  Submit
                </v-btn>
              </v-form>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Live Chat and Quick Links Section -->
        <v-col cols="12" md="6" class="pa-2">
          <v-card class="pa-6 rounded-lg" elevation="2">
            <v-card-text class="pa-0">
              <h3 class="text-h6 font-weight-bold mb-4">
                Need Immediate Help?
              </h3>
              <v-btn
                color="yellow darken-3"
                dark
                rounded
                block
                class="mb-4 hover-effect"
                @click="startLiveChat"
              >
                <v-icon left>
                  mdi-chat
                </v-icon>
                Start Live Chat
              </v-btn>
              <h4 class="text-subtitle-1 font-weight-medium mb-2">
                Quick Links
              </h4>
              <v-list dense>
                <v-list-item
                  v-for="link in quickLinks"
                  :key="link.title"
                  :href="link.href"
                  target="_blank"
                  class="mb-2 rounded-lg hover-effect"
                >
                  <v-list-item-icon>
                    <v-icon color="primary">
                      {{ link.icon }}
                    </v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title class="text-body-1">
                      {{ link.title }}
                    </v-list-item-title>
                  </v-list-item-content>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Knowledge Base Section -->
    </v-card>
  </v-container>
</template>

<script>
export default {
  data () {
    return {
      valid: false,
      form: {
        name: '',
        email: '',
        category: '',
        message: ''
      },
      rules: {
        required: value => !!value || 'This field is required.',
        min: value => value.length >= 3 || 'Minimum 3 characters.',
        minMessage: value => value.length >= 10 || 'Minimum 10 characters.',
        email: (value) => {
          const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          return pattern.test(value) || 'Invalid email address.'
        }
      },
      categories: [
        'Account Issues',
        'Rewards Program',
        'Technical Support',
        'Billing',
        'Other'
      ],
      quickLinks: [
        { title: 'FAQ', icon: 'mdi-help-circle', href: '/faq' },
        { title: 'Community Forum', icon: 'mdi-forum', href: '/community' },
        {
          title: 'User Guide',
          icon: 'mdi-book-open-page-variant',
          href: '/guide'
        }
      ],
      knowledgeBase: [
        {
          title: 'How to reset my password?',
          content:
            'To reset your password, go to the login page and click "Forgot Password." Follow the instructions to receive a reset link via email.'
        },
        {
          title: 'Why can’t I redeem my reward?',
          content:
            'Ensure you have enough points and the reward is unlocked. If the issue persists, contact support with your account details.'
        },
        {
          title: 'How do I update my profile information?',
          content:
            'Navigate to your profile settings, click "Edit Profile," and update your details. Save changes to apply them.'
        }
      ],
      searchQuery: '',
      filteredArticles: []
    }
  },
  created () {
    this.filteredArticles = [...this.knowledgeBase]
  },
  methods: {
    submitForm () {
      if (this.$refs.form.validate()) {
        // Simulate form submission
        alert('Form submitted successfully!')
        this.$refs.form.reset()
      }
    },
    startLiveChat () {
      // Placeholder for live chat integration
      alert('Live chat feature coming soon!')
    },
    filterKnowledgeBase () {
      const query = this.searchQuery.toLowerCase()
      this.filteredArticles = this.knowledgeBase.filter(
        article =>
          article.title.toLowerCase().includes(query) ||
          article.content.toLowerCase().includes(query)
      )
    }
  }
}
</script>

<style scoped>
.v-card {
  transition: transform 0.2s ease-in-out;
}

.rounded-lg {
  border-radius: 12px !important;
}

.primary {
  background-color: #1976d2 !important;
}

.yellow--text.text--darken-3 {
  color: #f57c00 !important;
}

.hover-effect:hover {
  background-color: #f5f5f5;
  transform: translateY(-2px);
}

.v-expansion-panel {
  border: 1px solid #e0e0e0;
}

.v-expansion-panel-header {
  font-weight: 500;
}

.v-btn {
  text-transform: none;
}

.v-chip {
  font-weight: 500;
}
</style>
