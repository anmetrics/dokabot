<script lang="ts" setup>
import { VNodeRef } from 'vue'
import { InvoicePDFExportParams } from '~/store/booking'

type Option = { value: number; label: string }
const defaultInvoicePdfTypes: number[] = invoicePdfTypes.valueLabelList.map(
  ({ value }: Option) => value
)
const bookingTypeOptions: Array<Option> = [
  invoiceBookingTypes.official,
  invoiceBookingTypes.temporary
]

const route = useRoute()
const bookingId = Number(route.params.bookingId)
const invoicePDFsExportStore = useInvoicePDFsExportStore()
const { isLoadings } = storeToRefs(invoicePDFsExportStore)
const bookingDetailStore = useBookingDetailStore()
const { closeDialog } = useDialogStore()

const formRef = ref<VNodeRef | null>(null)
const booking = reactive<InvoicePDFExportParams>({
  bookingDetailIds: bookingDetailStore.selectedBookingDetailIds,
  invoicePdfTypes: [...defaultInvoicePdfTypes],
  bookingType: invoiceBookingTypes.official.value,
  cancelType: typesOfCancellation.normal.value,
  confirmationNote: typesOfCancellation.normal.note,
  isDisplayStamp: stampStatuses.display.value
})
const rules = {
  isRequired: (v: string) => isNotEmpty(v) || 'Not entered.',
  isValidCancelType: (v: string) => {
    return !isEnabledCancelTypes.value || rules.isRequired(v)
  }
}

const isEnabledCancelTypes = computed<boolean>(() => {
  return (
    !`${booking.invoicePdfTypes}` ||
    booking.invoicePdfTypes.includes(invoicePdfTypes.confirmation.value)
  )
})
watch(isEnabledCancelTypes, isEnabled => {
  booking.cancelType = isEnabled ? typesOfCancellation.normal.value : 0
})

watch(
  () => booking.cancelType,
  (newType?: number) => {
    booking.confirmationNote =
      typesOfCancellation.valueLabelList.find(
        (cancelType: { [key: string]: number | string }) =>
          cancelType.value === newType
      )?.note ?? ''
  }
)

async function exportInvoicePDF() {
  const { valid } = await formRef.value.validate()
  if (!valid) {
    return
  }

  const pdfTypes = !booking.invoicePdfTypes.length
    ? defaultInvoicePdfTypes
    : booking.invoicePdfTypes

  await invoicePDFsExportStore.exportInvoicePDFs(bookingId, {
    ...booking,
    invoicePdfTypes: pdfTypes
  })
  closeDialog()
}
</script>

<template>
  <div class="dialog-export-invoice-pdf">
    <h3 class="title">確認書・見積書の発行</h3>
    <v-form ref="formRef" validate-on="blur" class="form">
      <div class="field -type">
        <strong class="label">印刷対象</strong>
        <div class="checkboxes">
          <v-checkbox
            v-for="(type, index) in invoicePdfTypes.valueLabelList"
            :key="`invoice-pdf-type-${index}`"
            v-model="booking.invoicePdfTypes"
            class="input"
            :label="type.label"
            :value="type.value"
            :hide-details="false"
          />
        </div>
      </div>
      <div class="field -booking-type">
        <strong class="label">予約種別</strong>
        <v-radio-group
          v-model="booking.bookingType"
          inline
          class="input -radio-group"
          :hide-details="false"
        >
          <v-radio
            v-for="(bookingType, index) in bookingTypeOptions"
            :key="`booking-type-${index}`"
            class="radio"
            :label="bookingType.label"
            :value="bookingType.value"
          />
        </v-radio-group>
      </div>
      <div class="field -cancel-type">
        <strong class="label">確認書注意書き</strong>
        <v-radio-group
          v-model="booking.cancelType"
          inline
          class="input -radio-group"
          :rules="[rules.isValidCancelType]"
        >
          <v-radio
            v-for="(cancelType, index) in typesOfCancellation.valueLabelList"
            :key="`cancel-type-${index}`"
            class="radio"
            :label="cancelType.label"
            :value="cancelType.value"
            :disabled="!isEnabledCancelTypes"
          />
        </v-radio-group>
      </div>
      <div
        :class="[
          'field -cancel-type-note',
          { '-disabled': !isEnabledCancelTypes }
        ]"
      >
        <v-textarea
          v-model="booking.confirmationNote"
          class="input"
          variant="outlined"
          no-resize
          :bg-color="!isEnabledCancelTypes ? 'background' : undefined"
          :hide-details="false"
          :rules="[rules.isValidCancelType]"
        />
      </div>
      <div class="field -stamp-status">
        <strong class="label">社判</strong>
        <v-radio-group
          v-model="booking.isDisplayStamp"
          inline
          class="input -radio-group"
        >
          <v-radio
            v-for="(status, index) in stampStatuses.valueLabelList"
            :key="`stamp-status-${index}`"
            class="radio"
            :label="status.label"
            :value="status.value"
          />
        </v-radio-group>
      </div>
    </v-form>
    <div class="actions">
      <v-btn
        variant="plain"
        color="text-placeholder"
        class="button -close"
        @click="closeDialog"
      >
        キャンセル
      </v-btn>
      <v-btn
        class="button -submit"
        size="large"
        :loading="isLoadings.confirmationAndQuote"
        @click="exportInvoicePDF"
      >
        発行
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dialog-export-invoice-pdf {
  min-width: 500px;
  > .title {
    font-size: 16px;
    line-height: 16px;
  }
  > .form {
    margin: 20px 0;
  }
  > .form > .field {
    &.-type > .label {
      display: block;
    }
    &.-type > .checkboxes {
      display: inline-flex;
      column-gap: 25px;
      margin-left: -5px;
    }
    &.-cancel-type {
      margin-bottom: 5px;
    }
    &.-cancel-type-note :deep(.v-field__input) {
      height: 150px;
      line-height: 1.65;
      mask-image: unset;
    }
    &.-disabled {
      pointer-events: none;
      opacity: 0.5;
    }
  }
  > .actions {
    text-align: right;
  }
  > .actions > .button {
    &.-submit {
      width: 75px;
    }
    &.-close {
      margin-right: 10px;
      font-weight: 400;
    }
  }
}
</style>
