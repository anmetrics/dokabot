<script lang="ts" setup>
import { VNodeRef } from 'vue'
import { ServiceSearchParams } from '~/store/service'

const serviceTypeOptions: Array<{ label: string; value: number }> = [
  { label: 'すべての項目', value: 0 },
  ...serviceTypes.valueLabelList
]
const serviceStore = useServiceStore()
const { serviceSearchParams, isLoading } = storeToRefs(serviceStore)
const serviceParams = ref<ServiceSearchParams>({
  ...serviceSearchParams.value
})

const formRef = ref<VNodeRef | null>(null)
const rules = {
  isNumber: (v: string) => !v || isNumeric(v) || '数字でご入力ください。'
}

async function searchServices () {
  const { valid } = await formRef.value.validate()
  if (valid) {
    serviceSearchParams.value.page = 1
    serviceSearchParams.value.id = serviceParams.value.id
    serviceSearchParams.value.name = serviceParams.value.name
    serviceSearchParams.value.type = serviceParams.value.type
    serviceSearchParams.value.locationType = serviceParams.value.locationType

    await serviceStore.fetchServices()
  }
}
</script>

<template>
  <v-form ref="formRef" class="services-search">
    <v-text-field
      v-model.trim="serviceParams.id"
      class="input -id"
      label="商品番号"
      bg-color="white"
      :hide-details="false"
      :rules="[rules.isNumber]"
    />
    <v-text-field
      v-model.trim="serviceParams.name"
      class="input -name"
      label="商品名"
      bg-color="white"
      :hide-details="false"
    />
    <v-select
      v-model="serviceParams.type"
      class="input -type"
      bg-color="white"
      item-title="label"
      item-value="value"
      :items="serviceTypeOptions"
      :hide-details="false"
    />
    <v-checkbox
      v-for="lt in locationTypes.valueLabelList"
      :key="lt.value"
      v-model="serviceParams.locationType"
      :label="lt.label"
      :value="lt.value"
      :hide-details="false"
    />
    <v-btn class="button" :loading="isLoading" @click="searchServices">
      検索
    </v-btn>
  </v-form>
</template>

<style scoped lang="scss">
.services-search {
  display: flex;
  gap: 10px;
  > .input {
    &.-id {
      flex: 21;
    }
    &.-name {
      flex: 40;
    }
    &.-type {
      flex: 22;
    }
  }
}
</style>
