<script lang="ts" setup>
import { VNodeRef } from 'vue'
import { CustomerSearchParams } from '~/store/customer'

const customerStore = useCustomerStore()
const { customerSearchParams, isLoading } = storeToRefs(customerStore)
const customerParams = ref<CustomerSearchParams>({
  ...customerSearchParams.value
})

const formRef = ref<VNodeRef | null>(null)
const rules = {
  isNumber: (value: string) =>
    !value || isNumeric(value) || '数字でご入力ください。'
}

async function fetchCustomers () {
  const { valid } = await formRef.value.validate()
  if (valid) {
    customerSearchParams.value.page = 1
    customerSearchParams.value.id = customerParams.value.id
    customerSearchParams.value.customerName = customerParams.value.customerName
    customerSearchParams.value.contactName = customerParams.value.contactName
    customerSearchParams.value.tel = customerParams.value.tel

    await customerStore.fetchCustomers()
  }
}
</script>

<template>
  <v-form ref="formRef" class="customers-search">
    <v-text-field
      v-model.trim="customerParams.id"
      class="input -id"
      label="顧客番号"
      bg-color="white"
      :hide-details="false"
      :rules="[rules.isNumber]"
    />
    <v-text-field
      v-model.trim="customerParams.customerName"
      class="input -name"
      label="顧客名"
      bg-color="white"
      :hide-details="false"
    />
    <v-text-field
      v-model.trim="customerParams.contactName"
      class="input -contactname"
      label="顧客担当者名"
      bg-color="white"
      :hide-details="false"
    />
    <v-text-field
      v-model.trim="customerParams.tel"
      class="input -tel"
      label="電話番号"
      bg-color="white"
      :hide-details="false"
    />
    <v-btn class="button" :loading="isLoading" @click="fetchCustomers">
      検索
    </v-btn>
  </v-form>
</template>

<style lang="scss" scoped>
.customers-search {
  display: flex;
  > .input {
    flex: 1;
    &.-id {
      flex: 0.75;
    }
  }
  > .input + .input {
    margin-left: 10px;
  }
  > .input + .button {
    margin-left: 12px;
  }
}
</style>
