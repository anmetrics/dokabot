<script setup lang="ts">
import { defineProps, computed } from 'vue'

// Định nghĩa các props cho button
const props = defineProps({
  label: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value: string) => ['small', 'medium', 'large'].includes(value)
  },
  icon: {
    type: String,
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'flat',
    validator: (value: string) =>
      ['flat', 'outlined', 'text', 'tonal'].includes(value)
  },
  centered: {
    type: Boolean,
    default: false
  },
  width: {
    type: [String, Number],
    default: 'auto', // Mặc định tự động điều chỉnh
    validator: (value: string | number) =>
      typeof value === 'string' || typeof value === 'number'
  }
})

// Tùy chỉnh kích thước dựa trên prop size
const buttonSize = computed(() => {
  switch (props.size) {
    case 'small':
      return { height: '32px', fontSize: '12px', padding: '0 12px' }
    case 'large':
      return { height: '48px', fontSize: '16px', padding: '0 24px' }
    default:
      return { height: '40px', fontSize: '14px', padding: '0 16px' }
  }
})

// Chuyển đổi width thành kiểu CSS
const buttonWidth = computed(() => {
  if (typeof props.width === 'number') {
    return `${props.width}px`
  }
  return props.width
})
</script>

<template>
  <div :class="{ 'centered-wrapper': centered }">
    <v-btn
      :color="color"
      :variant="variant"
      :disabled="disabled"
      :style="{
        height: buttonSize.height,
        fontSize: buttonSize.fontSize,
        padding: buttonSize.padding,
        width: buttonWidth,
      }"
      class="custom-button"
      rounded="lg"
    >
      <v-icon v-if="icon" :left="!label" :right="!!label" class="mr-2">
        {{ icon }}
      </v-icon>
      <span v-if="label">{{ label }}</span>
    </v-btn>
  </div>
</template>

<style scoped lang="scss">
.custom-button {
  text-transform: none !important;
  font-weight: 600;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .centered-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }
}
</style>
