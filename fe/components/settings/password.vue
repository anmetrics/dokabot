<template>
  <v-container class="pa-0">
    <v-card max-width="400" flat>
      <v-card-title class="headline">
        <v-icon left color="#1976D2">mdi-lock</v-icon>
        <span class="title-text">Change Password</span>
      </v-card-title>
      <v-card-text class="pt-0">
        <p class="description-text">
          To change your password, please fill in the fields below. Your
          password must contain at least 8 characters, including one upper case
          letter, one lower case letter, one number and one special character.
        </p>
        <v-form ref="form" v-model="valid" lazy-validation>
          <v-text-field
            v-model="currentPassword"
            label="Current Password"
            prepend-icon="mdi-lock"
            :type="showCurrentPassword ? 'text' : 'password'"
            :append-inner-icon="showCurrentPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :rules="passwordRules"
            required
            outlined
            dense
            class="custom-field"
            @click:append-inner="showCurrentPassword = !showCurrentPassword"
          ></v-text-field>
          <v-text-field
            v-model="newPassword"
            label="New Password"
            prepend-icon="mdi-lock"
            :type="showNewPassword ? 'text' : 'password'"
            :append-inner-icon="showNewPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :rules="passwordRules"
            required
            outlined
            dense
            class="custom-field"
            @click:append-inner="showNewPassword = !showNewPassword"
          ></v-text-field>
          <v-text-field
            v-model="confirmPassword"
            label="Confirm Password"
            prepend-icon="mdi-lock"
            :type="showConfirmPassword ? 'text' : 'password'"
            :append-inner-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
            :rules="[...passwordRules, confirmRule]"
            required
            outlined
            dense
            class="custom-field"
            @click:append-inner="showConfirmPassword = !showConfirmPassword"
          ></v-text-field>
        </v-form>
      </v-card-text>

      <v-card-actions class="px-6 pb-6 justify-center">
        <doka-button
          label="Change Password"
          color="blue"
          size="medium"
          :width="150"
          @click="submit"
        >
        </doka-button>
      </v-card-actions>
    </v-card>
  </v-container>
</template>

<script>
export default {
  data: () => ({
    valid: true,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    showCurrentPassword: false, // Track visibility for current password
    showNewPassword: false,    // Track visibility for new password
    showConfirmPassword: false, // Track visibility for confirm password
    passwordRules: [
      v => !!v || 'Password is required',
      v => (v && v.length >= 8) || 'Password must be at least 8 characters',
      v => /(?=.*[a-z])/.test(v) || 'Must contain a lowercase letter',
      v => /(?=.*[A-Z])/.test(v) || 'Must contain an uppercase letter',
      v => /(?=.*\d)/.test(v) || 'Must contain a number',
      v => /(?=.*[!@#$%^&*])/.test(v) || 'Must contain a special character'
    ]
  }),
  computed: {
    confirmRule() {
      return this.newPassword === this.confirmPassword || 'Passwords must match'
    }
  },
  methods: {
    submit() {
      if (this.$refs.form.validate()) {
        console.log('Form submitted:', {
          currentPassword: this.currentPassword,
          newPassword: this.newPassword,
          confirmPassword: this.confirmPassword
        })
      }
    }
  }
}
</script>

<style scoped>
/* Container and card styling */
.v-container {
  padding: 0;
}

.v-card {
  padding: 16px;
  box-shadow: none !important;
}

/* Title styling */
.headline {
  padding: 0 0 16px 0 !important;
  display: flex;
  align-items: center;
}

.title-text {
  font-family: 'Roboto', sans-serif;
  font-size: 24px;
  font-weight: 500;
  color: #212121;
}

/* Description text styling */
.description-text {
  font-family: 'Roboto', sans-serif;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
  margin-bottom: 24px;
}

/* Text field styling */
.custom-field {
  margin-bottom: 16px;
}

.custom-field .v-label {
  font-family: 'Roboto', sans-serif;
  font-size: 14px;
  color: #666;
}

.custom-field .v-input__prepend-outer {
  margin-right: 8px;
}

.custom-field .v-input__append-inner {
  margin-left: 8px;
  cursor: pointer;
}

.custom-field .v-icon {
  color: #666;
}

.custom-field .v-input__slot {
  border: 1px solid #b0bec5 !important;
  border-radius: 4px;
  font-family: 'Roboto', sans-serif;
  font-size: 14px;
}

/* Button styling */
.custom-button {
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 500;
  text-transform: none;
  height: 50px !important;
  border-radius: 8px;
  letter-spacing: 0.5px;
  background: #0961a4 !important;
  transition: all 0.3s ease;
}

.custom-button .v-btn__content {
  color: #ffffff;
}

/* Override Vuetify default margins */
.v-card__text {
  padding: 0 !important;
}

.v-card__actions {
  padding: 0 !important;
}
</style>
