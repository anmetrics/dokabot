<!-- pages/profile.vue -->
<template>
    <v-container class="pa-4">
      <!-- Header -->
      <h1 class="text-h6 font-weight-regular mb-2">My profile</h1>
      <p class="text-body-2 text-grey mb-6">Manage your profile.</p>
  
      <!-- Personal Section -->
      <v-card flat class="pa-4">
        <h2 class="text-subtitle-1 font-weight-medium mb-4">Personal</h2>
  
        <!-- Full Name -->
        <v-row align="center" class="mb-4">
          <v-col cols="12" sm="3">
            <span class="text-body-2">Full name</span>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="fullName"
              variant="outlined"
              density="compact"
              hide-details
              :readonly="!isEditingFullName"
              class="custom-text-field"
            />
          </v-col>
          <v-col cols="12" sm="3" class="text-right">
            <div v-if="isEditingFullName">
              <v-btn
                variant="text"
                color="grey"
                class="text-capitalize mr-2"
                @click="cancelEdit('fullName')"
              >
                Cancel
              </v-btn>
              <v-btn
                variant="flat"
                color="black"
                class="text-capitalize"
                @click="saveEdit('fullName')"
              >
                Save
              </v-btn>
            </div>
            <v-btn
              v-else
              variant="text"
              color="black"
              class="text-capitalize"
              @click="startEdit('fullName')"
            >
              Edit
            </v-btn>
          </v-col>
        </v-row>
  
        <!-- Email Address -->
        <v-row align="center" class="mb-4">
          <v-col cols="12" sm="3">
            <span class="text-body-2">Email address</span>
          </v-col>
          <v-col cols="12" sm="6">
            <span class="text-body-1">{{ email }}</span>
            <div>
              <a href="#" class="text-body-2 text-decoration-none text-blue">
                + Add email address
              </a>
            </div>
          </v-col>
          <v-col cols="12" sm="3" class="text-right">
            <v-btn
              variant="text"
              color="black"
              class="text-capitalize"
              @click="startEdit('email')"
            >
              Edit
            </v-btn>
          </v-col>
        </v-row>
  
        <!-- Position -->
        <v-row align="center" class="mb-4">
          <v-col cols="12" sm="3">
            <span class="text-body-2">Position</span>
          </v-col>
          <v-col cols="12" sm="6">
            <span class="text-body-1">{{ position }}</span>
          </v-col>
          <v-col cols="12" sm="3" class="text-right">
            <v-btn
              variant="text"
              color="black"
              class="text-capitalize"
              @click="startEdit('position')"
            >
              Edit
            </v-btn>
          </v-col>
        </v-row>
  
        <!-- Location -->
        <v-row align="center">
          <v-col cols="12" sm="3">
            <span class="text-body-2">Location</span>
          </v-col>
          <v-col cols="12" sm="6">
            <span class="text-body-1">{{ location }}</span>
          </v-col>
          <v-col cols="12" sm="3" class="text-right">
            <v-btn
              variant="text"
              color="black"
              class="text-capitalize"
              @click="startEdit('location')"
            >
              Edit
            </v-btn>
          </v-col>
        </v-row>
      </v-card>
    </v-container>
  </template>
  
  <script setup>
  import { ref } from 'vue'
  
  // Reactive state for profile data
  const fullName = ref('Dominik Tyka')
  const email = ref('dom@designme.agency')
  const position = ref('Product Designer')
  const location = ref('Cracow, Poland')
  
  // State for editing
  const isEditingFullName = ref(false)
  const originalFullName = ref('')
  
  // Methods for editing
  const startEdit = (field) => {
    if (field === 'fullName') {
      originalFullName.value = fullName.value
      isEditingFullName.value = true
    }
    // Add logic for other fields if needed
  }
  
  const cancelEdit = (field) => {
    if (field === 'fullName') {
      fullName.value = originalFullName.value
      isEditingFullName.value = false
    }
  }
  
  const saveEdit = (field) => {
    if (field === 'fullName') {
      isEditingFullName.value = false
    }
  }
  </script>
  
  <style scoped>
  /* Custom styles to match the design */
  .custom-text-field {
    max-width: 100%;
  }
  
  /* Remove extra padding/margin from Vuetify components if needed */
  :deep(.v-text-field .v-input__control) {
    min-height: 40px !important;
  }
  
  :deep(.v-text-field .v-field) {
    border-radius: 4px;
    font-size: 1rem;
  }
  
  /* Adjust button styles */
  .v-btn {
    font-size: 0.875rem;
    letter-spacing: normal;
  }
  
  /* Ensure proper spacing for the 'Add email address' link */
  a.text-blue {
    color: #1976d2 !important;
  }
  </style>
