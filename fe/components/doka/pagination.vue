<script lang="ts" setup>
const props = defineProps<{
  modelValue: number;
  itemsPerPage: number;
  total: number;
}>()
const emit = defineEmits(['next', 'prev', 'update:modelValue'])

const currentPage = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value)
})
</script>

<template>
  <div class="doka-pagination">
    <p class="total">
      {{
        `${total > 0 ? itemsPerPage * (currentPage - 1) + 1 : 0} ~ ${
          itemsPerPage * currentPage > total
            ? total
            : itemsPerPage * currentPage
        }件 / ${total}件`
      }}
    </p>
    <v-pagination
      v-model="currentPage"
      :length="Math.ceil(total / itemsPerPage)"
      :total-visible="1"
      @prev="$emit('prev')"
      @next="$emit('next')"
    />
  </div>
</template>

<style lang="scss" scoped>
.doka-pagination {
  display: flex;
  align-items: center;
  color: rgb(var(--v-theme-text-placeholder));
  > .total {
    text-align: center;
    margin-right: 10px;
  }
}
</style>
