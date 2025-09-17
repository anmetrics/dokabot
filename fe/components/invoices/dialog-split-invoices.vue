<script setup lang="ts">
import { VNodeRef } from 'vue'
import { InvoiceItem } from '~/store/booking-detail'
import { Invoice, InvoicePayload } from '~/store/invoice'

const invoiceItemTableHeaders = [
  { title: '商品番号', key: 'serviceId', width: '100' },
  { title: '商品名', key: 'name', width: '220', align: 'start' },
  { title: '単価', key: 'unitAmount', width: '120' },
  { title: '税込単価', key: 'unitAmountWithTax', width: '120' },
  { title: '数量', key: 'count', width: '120' },
  { title: '金額', key: 'subtotalAmount', width: '150' }
]

const invoiceRules = {
  isPositiveNumber: (v: string) =>
    !v || isPositiveNumber(v) || '数字でご入力ください。'
}
const isLoadingSplitInvoice = ref<boolean>(false)
const isLoadingSaveInvoice = ref<boolean>(false)

const nuxtRoute = useRoute()
const bookingDetailIdQuery = nuxtRoute.query.bookingDetailId
const bookingId = Number(nuxtRoute.params.bookingId)
const bookingDetailIds = Array.isArray(bookingDetailIdQuery)
  ? bookingDetailIdQuery.map(Number)
  : [Number(bookingDetailIdQuery)]

const dialogStore = useDialogStore()
const bookingInvoiceStore = useBookingInvoiceStore()
const {
  bookingDetails,
  bookingDetailIndex,
  voucherNum,
  storedInvoices,
  invoiceItems,
  totalRemainingDepositAmount,
  totalRemainingDiscountAmount
} = storeToRefs(bookingInvoiceStore)
const bookingDetail = computed(
  () => bookingDetails.value[bookingDetailIndex.value]
)
const taxRate = computed(() => Number(bookingDetail.value.taxRate))

const segmentNum = ref<number>()
const invoiceFormRef = ref<VNodeRef | null>(null)
const discountAmountWithoutTax = ref<number>()
const depositAmount = ref<number>()
const currentInvoiceItems = computed(() => bookingDetail.value.invoiceItems)
const segmentInvoice = computed(() => {
  return storedInvoices.value.find(
    invoice => Number(segmentNum.value) === invoice.segmentNum
  )
})
const linkedInvoiceItems = computed(() => {
  return currentInvoiceItems.value.filter(
    invoiceItem =>
      invoiceItem.invoiceId &&
      invoiceItem.invoice?.segmentNum !== Number(segmentNum.value)
  )
})
const selectableInvoiceItems = computed(() => {
  return currentInvoiceItems.value.filter(
    invoiceItem =>
      !invoiceItem.invoiceId ||
      invoiceItem.invoice?.segmentNum === Number(segmentNum.value)
  )
})
const selectedInvoiceItemIds = ref<number[]>([])
const isSelectedAll = ref<boolean>(selectableInvoiceItems.value.length === 0)
watch(
  () => selectedInvoiceItemIds.value,
  () => {
    isSelectedAll.value =
      selectableInvoiceItems.value.length ===
      selectedInvoiceItemIds.value.length
  }
)
watch(
  () => selectableInvoiceItems.value,
  () => {
    isSelectedAll.value =
      selectableInvoiceItems.value.length === 0 ||
      selectedInvoiceItemIds.value.length ===
        selectableInvoiceItems.value.length
  }
)
function toggleSelectedAll () {
  if (!isSelectedAll.value) {
    selectedInvoiceItemIds.value = selectableInvoiceItems.value.map(item =>
      Number(item.id)
    )
  } else {
    selectedInvoiceItemIds.value = []
  }
}
function isDisabledRow (invoiceItem: InvoiceItem & { invoice: Invoice }) {
  return (
    invoiceItem.invoiceId &&
    invoiceItem.invoice.segmentNum !== Number(segmentNum.value)
  )
}

const selectedInvoiceItems = computed(() =>
  currentInvoiceItems.value.filter(({ id }) =>
    selectedInvoiceItemIds.value.includes(Number(id))
  )
)
const serviceFeeWithoutTax = computed(() =>
  calculateServiceFee(selectedInvoiceItems.value)
)
const selectedTotalAmountInfo = computed(() =>
  calculateTotalAmountInfo(
    selectedInvoiceItems.value,
    serviceFeeWithoutTax.value - formatAmount(discountAmountWithoutTax.value),
    bookingDetail.value.taxRate
  )
)

const linkedServiceFeeWithoutTax = computed(() =>
  calculateServiceFee(linkedInvoiceItems.value)
)
const linkedAmountInfo = computed(() => {
  return calculateTotalAmountInfo(
    linkedInvoiceItems.value,
    linkedServiceFeeWithoutTax.value,
    bookingDetail.value.taxRate
  )
})

const remainingAmountInfo = computed(() => {
  const discountTaxAmount = Math.floor(formatAmount(discountAmountWithoutTax.value) * taxRate.value / 100)
  const discountAmount = formatAmount(discountAmountWithoutTax.value) + discountTaxAmount
  return {
    serviceFeeWithoutTax:
      formatAmount(bookingDetail.value.totalServiceAmountWithoutTax) -
      linkedServiceFeeWithoutTax.value -
      serviceFeeWithoutTax.value,
    discountAmountWithoutTax:
      totalRemainingDiscountAmount.value -
      formatAmount(discountAmountWithoutTax.value),
    depositAmount:
      totalRemainingDepositAmount.value -
      formatAmount(depositAmount.value),
    totalAmount:
      bookingDetail.value.totalAmount -
      linkedAmountInfo.value.totalAmount -
      discountAmount -
      selectedTotalAmountInfo.value.totalAmount,
    totalTaxAmount:
      bookingDetail.value.totalTax -
      linkedAmountInfo.value.totalTaxAmount -
      discountTaxAmount -
      selectedTotalAmountInfo.value.totalTaxAmount,
    totalAmountWithoutTax:
      bookingDetail.value.totalAmountWithoutTax +
      formatAmount(bookingDetail.value.totalServiceAmountWithoutTax) -
      formatAmount(discountAmountWithoutTax.value) -
      linkedAmountInfo.value.totalAmountWithoutTax -
      selectedTotalAmountInfo.value.totalAmountWithoutTax
  }
})

watch(
  () => segmentNum.value,
  () => {
    selectedInvoiceItemIds.value = currentInvoiceItems.value
      .filter(item => item.invoice?.segmentNum === Number(segmentNum.value))
      .map(item => Number(item.id))
    discountAmountWithoutTax.value = segmentNum.value ? remainingAmountInfo.value.discountAmountWithoutTax : undefined
    depositAmount.value = segmentNum.value ? remainingAmountInfo.value.depositAmount : undefined
  }
)

async function submitSegmentInvoice (shouldCloseDialog = false) {
  if (!shouldCloseDialog) {
    isLoadingSplitInvoice.value = true
  } else {
    isLoadingSaveInvoice.value = true
  }

  const { valid } = await invoiceFormRef.value.validate()
  if (!valid) {
    return
  }

  const invoice: InvoicePayload = {
    id: segmentInvoice.value?.id,
    segmentNum: segmentNum.value ? Number(segmentNum.value) : undefined,
    recipientName: segmentInvoice.value?.id ? undefined : bookingDetail.value.customerName,
    voucherNum: voucherNum.value,
    bookingId,
    ...generateInvoiceAmount()
  }

  bookingInvoiceStore.submitInvoice(invoice)
    .then(() => refreshBookingDetails())
    .finally(() => {
      if (shouldCloseDialog) {
        closeDialog()
      }

      clearSegmentInvoice()

      isLoadingSplitInvoice.value = false
      isLoadingSaveInvoice.value = false
    })
}
function clearSegmentInvoice () {
  segmentNum.value = undefined
  discountAmountWithoutTax.value = undefined
}
function closeDialog () {
  dialogStore.closeDialog()
}
async function refreshBookingDetails () {
  await bookingInvoiceStore.getBookingDetails({ bookingId, bookingDetailIds })
}

function generateInvoiceAmount () {
  const targetedInvoiceItems = invoiceItems.value.filter((invoiceItem) => {
    return (
      selectedInvoiceItemIds.value.includes(Number(invoiceItem.id)) ||
      (invoiceItem.invoice?.segmentNum === Number(segmentNum.value) &&
        invoiceItem.bookingDetailId !== Number(bookingDetail.value.id))
    )
  })

  const discountWithoutTax =
    formatAmount(discountAmountWithoutTax.value) +
    formatAmount(segmentInvoice.value?.discountWithoutTaxAmount)
  const discountAmount = Math.floor(
    (formatAmount(discountWithoutTax) * (100 + taxRate.value)) / 100
  )
  const totalDepositAmount = formatAmount(depositAmount.value) +
    formatAmount(segmentInvoice.value?.depositAmount)

  const serviceWithoutTaxAmount = calculateServiceFee(targetedInvoiceItems)
  const invoiceAmountInfo = calculateTotalAmountInfo(
    targetedInvoiceItems,
    serviceWithoutTaxAmount - formatAmount(discountWithoutTax),
    taxRate.value
  )

  return {
    totalAmount: formatAmount(invoiceAmountInfo.totalAmount),
    totalWithoutTaxAmount: formatAmount(invoiceAmountInfo.totalAmountWithoutTax),
    totalTaxAmount: formatAmount(invoiceAmountInfo.totalTaxAmount),
    serviceWithoutTaxAmount: formatAmount(serviceWithoutTaxAmount),
    serviceAmount: Math.floor(
      formatAmount(serviceWithoutTaxAmount) * (1 + taxRate.value / 100)
    ),
    discountWithoutTaxAmount: discountWithoutTax,
    discountAmount,
    invoiceItemIds: targetedInvoiceItems.map(x => Number(x.id)),
    depositAmount: totalDepositAmount
  }
}
</script>
<template>
  <div class="split-invoices">
    <h3 class="title">
      分割精算
    </h3>
    <v-form ref="invoiceFormRef" class="invoice-wrapper">
      <v-data-table
        v-if="bookingDetail.invoiceItems.length"
        class="invoice-items-table"
        :headers="invoiceItemTableHeaders"
        :items="bookingDetail.invoiceItems"
        :items-per-page="bookingDetail.invoiceItems.length"
      >
        <template #headers>
          <tr class="row">
            <th width="65" class="column -checkboxes">
              <v-checkbox
                v-model="isSelectedAll"
                :disabled="selectableInvoiceItems.length === 0"
                @click="toggleSelectedAll"
              />
            </th>
            <th
              v-for="header in invoiceItemTableHeaders"
              :key="header.key"
              class="column"
              :width="header.width || null"
            >
              {{ header.title }}
            </th>
          </tr>
        </template>
        <template #[`item`]="{ item }">
          <tr class="row">
            <td class="column -selective">
              <v-checkbox
                v-if="!isDisabledRow(item.raw)"
                v-model="selectedInvoiceItemIds"
                class="checkbox"
                :value="item.raw.id"
              />
              <v-checkbox
                v-else
                :model-value="true"
                disabled
                class="checkbox"
              />
            </td>
            <td class="column">
              {{ item.raw.serviceId }}
            </td>
            <td class="column">
              {{ item.raw.name }}
            </td>
            <td class="column">
              {{ formatPrice(item.raw.unitAmount) }}円
            </td>
            <td class="column">
              {{
                formatPrice(
                  Number(item.raw.taxAmount) + Number(item.raw.unitAmount)
                )
              }}円
            </td>
            <td class="column">
              {{ Number(item.raw.count).toFixed(1) }}
            </td>
            <td class="column">
              <b>{{ formatPrice(item.raw.subtotalAmount) }}円</b>
            </td>
          </tr>
        </template>
        <template #bottom>
          <div class="bottom">
            <p class="amount">
              <label class="label">精算済みの合計</label>
              <b class="value">
                {{ formatPrice(linkedAmountInfo.totalAmount) }}円
              </b>
            </p>
            <p class="amount">
              <label class="label">選択中の計算合計</label>
              <b class="value">
                {{ formatPrice(selectedTotalAmountInfo.totalAmount) }}円
              </b>
            </p>
            <p class="amount">
              <label class="label">この予約の合計</label>
              <b class="value">
                {{ formatPrice(bookingDetail.totalAmount) }}円
              </b>
            </p>
          </div>
        </template>
        <template #top>
          <div class="top">
            <div class="wrapper-form">
              <div class="box">
                <label class="label">分割番号</label>
                <v-text-field
                  v-model="segmentNum"
                  :rules="[invoiceRules.isPositiveNumber]"
                  hide-details
                  class="input"
                />
              </div>
            </div>
          </div>
        </template>
      </v-data-table>
      <div class="invoice-amount">
        <div class="wrapper-row">
          <p class="subtitle">
            選択（精算）
          </p>
          <p class="subtitle">
            未精算
          </p>
        </div>
        <div class="wrapper-row">
          <label class="label">内SC（税抜）</label>
          <span class="value -linked">
            {{ formatPrice(serviceFeeWithoutTax) }}円
          </span>
          <span class="value">
            {{ formatPrice(remainingAmountInfo.serviceFeeWithoutTax) }}円
          </span>
        </div>
        <div class="wrapper-row">
          <label class="label">前受金</label>
          <v-text-field
            v-model="depositAmount"
            :rules="[invoiceRules.isPositiveNumber]"
            hide-details
            class="value -input"
          >
            <template #append>
              円
            </template>
          </v-text-field>
          <span class="value">
            {{ formatPrice(remainingAmountInfo.depositAmount) }}円
          </span>
        </div>
        <div class="wrapper-row">
          <label class="label">値引（税抜）</label>
          <v-text-field
            v-model="discountAmountWithoutTax"
            :rules="[invoiceRules.isPositiveNumber]"
            hide-details
            class="value -input"
          >
            <template #append>
              円
            </template>
          </v-text-field>
          <span class="value">
            {{ formatPrice(remainingAmountInfo.discountAmountWithoutTax) }}円
          </span>
        </div>
        <div class="wrapper-row">
          <label class="label">小計（税抜）</label>
          <span class="value -linked">
            {{ formatPrice(selectedTotalAmountInfo.totalAmountWithoutTax) }}円
          </span>
          <span class="value">
            {{ formatPrice(remainingAmountInfo.totalAmountWithoutTax) }}円
          </span>
        </div>
        <div class="wrapper-row">
          <label class="label">消費税</label>
          <span class="value -linked">
            {{ formatPrice(selectedTotalAmountInfo.totalTaxAmount) }}円
          </span>
          <span class="value">
            {{ formatPrice(remainingAmountInfo.totalTaxAmount) }}円
          </span>
        </div>
        <div class="wrapper-row">
          <label class="label">合計</label>
          <span class="value -total -linked">
            {{
              formatPrice(
                selectedTotalAmountInfo.totalAmount
                  - formatAmount(depositAmount)
              )
            }}円
          </span>
          <span class="value -total">
            {{ formatPrice(remainingAmountInfo.totalAmount) }}円
          </span>
        </div>
      </div>
    </v-form>
    <div class="actions">
      <v-btn class="button -back" variant="plain" @click="closeDialog">
        キャンセル
      </v-btn>
      <v-btn
        variant="outlined"
        :color="!segmentNum ? 'border' : 'primary'"
        :disabled="!segmentNum"
        :loading="isLoadingSplitInvoice"
        @click="submitSegmentInvoice()"
      >
        続けて分割精算
      </v-btn>
      <v-btn :disabled="!segmentNum" :loading="isLoadingSaveInvoice" @click="submitSegmentInvoice(true)">
        分割精算を保存
      </v-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.split-invoices {
  min-width: 1024px;
  > .title {
    font-size: 20px;
    line-height: 20px;
  }
  > .invoice-wrapper {
    margin-bottom: 30px;
  }
  > .actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    > .button.-back {
      font-weight: normal;
      color: rgb(var(--v-theme-text-placeholder)) !important;
    }
  }
  &:deep(.v-btn__prepend),
  &:deep(.v-btn__append) {
    margin-inline: 2px;
    margin-top: 2px;
  }
}
.invoice-wrapper {
  display: flex;
  > .invoice-amount {
    flex: 1 1;
    padding: 0 20px;
  }
  > .invoice-items-table {
    flex: 1 1 600px;
    min-width: 650px;
    padding: 10px 20px;
    border-right: 1px solid rgb(var(--v-theme-border));
  }
}
.invoice-items-table {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 220px);
  overflow-y: scroll;
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
  &:deep(.v-table__wrapper) {
    padding-bottom: 30px;
  }
  > .bottom {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 40px;
  }
  > .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    margin-bottom: 16px;
  }
  &:deep(.amount > .label) {
    padding: 6px;
    color: rgb(var(--v-theme-text-placeholder));
    font-weight: bold;
  }
  &:deep(.amount > .value) {
    display: inline-block;
    margin-left: 5px;
  }
  &:deep(.wrapper-form) {
    display: flex;
    align-items: center;
    gap: 20px;
    > .box {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    > .box > .label {
      font-weight: bold;
    }
    > .box > .input {
      width: 80px;
      &.-larger {
        width: 200px;
      }
    }
  }
  &:deep(.v-table__wrapper) > table > tbody > .row {
    &.-disabled > .column {
      background-color: rgb(var(--v-theme-border));
    }
  }
}

.wrapper-row {
  display: grid;
  grid-template-columns: 80px 130px 130px;
  justify-items: stretch;
  gap: 10px;
  &:has(> .value.-input) > :not(.-input) {
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }
  > .subtitle {
    text-align: center;
    margin-bottom: 5px;
    font-weight: bold;
    &:first-child {
      grid-column: 1/2;
    }
    &:first-child {
      grid-column: 2/3;
    }
  }
  > .value {
    padding: 4px;
    text-align: right;
    background-color: rgb(var(--v-theme-background));
    &.-total {
      font-size: 14px;
      font-weight: bold;
      color: rgb(var(--v-theme-primary));
    }
    &.-input:deep(.v-field__input) {
      background-color: rgb(var(--v-theme-on-primary));
    }
  }
  > .label {
    font-weight: bold;
    justify-self: start;
    color: rgb(var(--v-theme-text-placeholder));
  }
  &:deep(.v-input__append) {
    margin: 0 0 0 5px;
  }
}
</style>
