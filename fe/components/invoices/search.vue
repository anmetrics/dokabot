<script lang="ts" setup>
import { isAfter } from 'date-fns'
import { TemplateRef } from '~/store/app'
import { invoiceStatuses } from '~/store/invoice'

const rules = {
  isNumeric: (v: string) => !v || isNumeric(v) || '数字でご入力ください。',
  isValidTimeInterval: (fromDate: string, toDate: string) => {
    return (
      (!fromDate && !toDate) ||
      !isAfter(new Date(fromDate), new Date(toDate)) ||
      '日付範囲が無効です。'
    )
  }
}

const invoiceStatusOptions: Array<{ label: string; value: number }> = [
  { label: 'すべての項目', value: '' },
  ...invoiceStatuses.valueLabelList
]
const locationTypeOptions: Array<{ label: string; value: number }> =
  invoiceLocationTypes.valueLabelList

const invoiceStore = useInvoiceStore()
const { invoiceSearchParams, isLoading } = storeToRefs(invoiceStore)
const invoiceSearchForm = ref<VNodeRef | null>(null)
const inputRefs = reactive<{
  startDatetime: TemplateRef;
  endDatetime: TemplateRef;
}>({ startDatetime: null, endDatetime: null })

const searchInvoices = async () => {
  const { valid } = await invoiceSearchForm.value.validate()
  if (valid) {
    invoiceStore.fetchInvoices(invoiceSearchParams.value)
  }
}
</script>
<template>
  <v-form
    ref="invoiceSearchForm"
    class="invoices-search"
    @submit.prevent="searchInvoices"
  >
    <v-text-field
      v-model="invoiceSearchParams.id"
      label="精算番号"
      class="input -invoice"
      :hide-details="false"
      :rules="[rules.isNumeric]"
    />
    <v-text-field
      v-model="invoiceSearchParams.bookingId"
      label="予約番号"
      class="input -booking"
      :hide-details="false"
      :rules="[rules.isNumeric]"
    />
    <v-text-field
      v-model="invoiceSearchParams.customerName"
      label="顧客名"
      class="input -customer"
      :hide-details="false"
    />
    <doka-date-picker
      v-model="invoiceSearchParams.startDatetime"
      class="input -start"
      placeholder="登録日"
      :label="invoiceSearchParams.startDatetime && '登録日'"
      :get-ref="(el: TemplateRef) => (inputRefs.startDatetime = el)"
      :hide-details="false"
      :rules="[
        rules.isValidTimeInterval(
          `${invoiceSearchParams.startDatetime}`,
          `${invoiceSearchParams.endDatetime}`
        ),
      ]"
    />
    <span class="about">〜</span>
    <doka-date-picker
      v-model="invoiceSearchParams.endDatetime"
      class="input -end"
      placeholder="登録日"
      :label="invoiceSearchParams.endDatetime && '登録日'"
      :get-ref="(el: TemplateRef) => (inputRefs.endDatetime = el)"
      :hide-details="false"
      :rules="[
        rules.isValidTimeInterval(
          `${invoiceSearchParams.startDatetime}`,
          `${invoiceSearchParams.endDatetime}`
        ),
      ]"
    />
    <v-select
      v-model="invoiceSearchParams.status"
      label="精算状況"
      class="input -status"
      item-title="label"
      item-value="value"
      :items="invoiceStatusOptions"
      menu-icon="mdi mdi-chevron-down"
      :hide-details="false"
    />
    <v-checkbox
      v-for="(locationType, index) in locationTypeOptions"
      :key="`invoice-pdf-type-${index}`"
      v-model="invoiceSearchParams.locationType"
      class="input"
      :label="locationType.label"
      :value="locationType.value"
      :hide-details="false"
    />
    <div class="action">
      <v-btn
        color="primary"
        class="button"
        :loading="isLoading"
        @click="searchInvoices"
      >
        検索
      </v-btn>
    </div>
  </v-form>
</template>
<style lang="scss" scoped>
.invoices-search {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 95%;
  margin-top: 20px;
  > .input:deep(.v-input__control) {
    background: rgb(var(--v-theme-surface));
  }
  > .input:deep(.v-input__details) {
    padding: 5px 0;
    padding-inline-start: 5px;
    padding-inline-end: 5px;
  }
  > .input:deep(.v-field__field) > .v-field__input {
    padding-block-start: 5px;
    padding-block-end: 5px;
  }
  > .input:deep(.v-input__control) {
    background: none;
  }
  > .input.-invoice {
    flex: 12;
  }
  > .input.-booking {
    flex: 12;
  }
  > .input.-customer {
    flex: 20;
  }
  > .input.-start {
    flex: 20;
  }
  > .input.-end {
    flex: 20;
  }
  > .input.-status {
    flex: 16;
  }
  > input.-radio-group > .radio {
    margin-bottom: 25px;
  }
  > .about {
    margin-bottom: 22px;
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
    font-size: 18px;
  }

  > .action {
    margin-left: 10px;
    margin-bottom: 22px;
  }
  > .action > .button {
    width: 70px;
    font-size: 15px;
    font-weight: 700;
  }
}
</style>
