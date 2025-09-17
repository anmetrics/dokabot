<script lang="ts" setup>
import { PropType, VNodeRef } from 'vue'

const props = defineProps({
  modelValue: {
    type: String as PropType<string | Date | null | undefined>,
    required: true
  },
  placeholder: {
    type: String,
    default: ''
  },
  getRef: {
    type: Function,
    default: (): VNodeRef | undefined => undefined
  }
})
const emit = defineEmits(['update:modelValue'])

const placeholder = ref<string>(`"${props.placeholder}"`)
const vModel = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})

function showDatePicker (event: Event) {
  const target = event.target as HTMLInputElement
  target?.showPicker()
}
</script>
<template>
  <v-text-field
    :ref="(getRef as VNodeRef)"
    v-model="vModel"
    type="date"
    :class="['doka-date-picker', { '-no-placeholder': !!vModel }]"
    v-bind="$attrs"
    @click="showDatePicker"
  >
    <template v-for="(_, name) in $slots" #[name]="slotData">
      <slot :name="name" v-bind="slotData || {}" />
    </template>
  </v-text-field>
</template>
<style lang="scss" scoped>
.doka-date-picker {
  > :deep(.v-input__control) > .v-field > .v-field__field > .v-field__input {
    position: relative;
    text-indent: -100%;
    &::after {
      content: v-bind(placeholder);
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      text-indent: initial;
      color: rgba(var(--v-theme-text-placeholder));
    }
  }
  &.-no-placeholder
    > :deep(.v-input__control)
    > .v-field
    > .v-field__field
    > .v-field__input {
    text-indent: unset;
    &::after {
      content: "";
    }
  }
}
</style>
