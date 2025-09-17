<script lang="ts" setup>
import { InvoiceItemPayload } from '~/store/invoice'

const nuxtRoute = useRoute()
const invoiceId = Number(nuxtRoute.params.invoiceId)
const invoiceDetailStore = useInvoiceDetailStore()
const { isLoadings } = storeToRefs(invoiceDetailStore)
const dialogStore = useDialogStore()
const {
  dialog: {
    value: { data: receivedData }
  }
} = storeToRefs(dialogStore)
const snackbarStore = useSnackbarStore()

const headers = [
  { title: '商品名', key: 'invoiceItem' },
  { title: '予約', key: 'bookingDetails', width: '320px' }
]

const bookingDetails = receivedData?.bookingDetails ?? []
const oldInvoiceItems = receivedData!.invoiceItems.filter(
  (item: InvoiceItemPayload) => !!item.id
)
const newInvoiceItems = ref(
  receivedData!.invoiceItems
    .filter((item: InvoiceItemPayload) => !item.id)
    .map(({ bookingDetailId, ...item }: InvoiceItemPayload) => ({
      ...item,
      bookingDetailId: bookingDetailId || (bookingDetails[0]?.id ?? null)
    }))
)

async function updateInvoice () {
  await invoiceDetailStore.updateInvoice(invoiceId, {
    invoice: receivedData!.invoice,
    invoiceItems: [...oldInvoiceItems, ...newInvoiceItems.value]
  })
  await invoiceDetailStore.fetchInvoice(invoiceId)
  receivedData!.updateInvoiceData()
  dialogStore.closeDialog()
  snackbarStore.showSnackbar({
    message: '精算を保存しました',
    type: SnackbarTypes.success
  })
}
</script>

<template>
  <div class="dialog-invoice-item-classify">
    <h3 class="title">
      以下を確認してください
    </h3>
    <h4 class="subtitle">
      追加する商品項目
    </h4>
    <p class="note">
      どの予約に対し該当の商品を追加するか選択してください<br>(選択した予約の明細に追加されます)
    </p>
    <v-data-table
      class="table-invoice-items"
      :headers="headers"
      :items="newInvoiceItems"
      :items-per-page="newInvoiceItems.length"
    >
      <template #[`item.invoiceItem`]="{ item }">
        <strong class="serviceid">{{ item.raw.serviceId }}</strong>
        {{ item.raw.name }}
      </template>
      <template #[`item.bookingDetails`]="{ item }">
        <v-radio-group v-model="item.raw.bookingDetailId" class="radios">
          <v-radio
            v-for="booking in bookingDetails"
            :key="booking.id"
            :label="`${formatDayJp(booking.startDatetime)}${formatDateTime(
              new Date(booking.startDatetime),
              'HH:mm'
            )}〜${formatDateTime(new Date(booking.endDatetime), 'HH:mm')}、${
              booking?.room?.name || ''
            }`"
            :value="booking.id"
          />
        </v-radio-group>
      </template>
      <template #bottom />
    </v-data-table>
    <div class="actions">
      <v-btn
        color="border"
        variant="plain"
        class="button -cancel"
        :disabled="isLoadings.update"
        @click="dialogStore.closeDialog"
      >
        キャンセル
      </v-btn>
      <v-btn
        class="button -update"
        :loading="isLoadings.update"
        @click="updateInvoice"
      >
        精算を保存
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dialog-invoice-item-classify {
  min-width: 550px;
  > .title {
    font-size: 16px;
    line-height: 16px;
    margin-bottom: 25px;
  }
  > .subtitle {
    font-size: 14px;
  }
  > .note {
    margin: 15px 0;
  }
  > .actions {
    padding-top: 15px;
    text-align: right;
  }
  > .actions > .button.-cancel {
    margin-right: 10px;
  }
}
.table-invoice-items {
  max-height: calc(100vh - 350px);
  > :deep(.v-table__wrapper) .radios {
    margin-left: -5px;
  }
  > :deep(.v-table__wrapper) .radios > .v-input__control {
    padding-left: 5px;
  }
}
</style>
