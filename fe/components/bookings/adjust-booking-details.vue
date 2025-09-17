<script setup lang="ts">
import {
  BookingCreateBookingDetailForm,
  BookingCreateBookingDetailFormSchema
} from '~/store/booking'
const headers = [
  { title: '会議室', key: 'roomName', align: 'start' },
  {
    title: '利用日時',
    key: 'datetime',
    align: 'start',
    sortable: false,
    width: 250
  },
  { title: 'レイアウト', key: 'layoutType', align: 'start' },
  { title: '利用人数', key: 'guestCount', align: 'start' },
  { title: '予約タイプ', key: 'status', align: 'start' },
  {
    title: '回答予定日',
    key: 'scheduledReplyDate',
    align: 'start',
    width: 200
  },
  { title: '立食', key: 'isCocktailStyle', align: 'start' },
  { title: '', key: 'actions', align: 'start', width: 80 }
]

const bookingStore = useBookingFormStore()
const dialogStore = useDialogStore()
const snackBarStore = useSnackbarStore()
const {
  rooms,
  bookingDetails: bookingDetailStore,
  summaryBookingDetail
} = storeToRefs(bookingStore)
const isLoading = ref<boolean>(false)

const bookingDetails = ref<BookingCreateBookingDetailForm[]>(
  bookingDetailStore.value.map((bookingDetail, index) => {
    return {
      ...bookingDetail,
      temporaryId: index
    }
  })
)

const canSubmit = computed<boolean>(
  () =>
    bookingDetails.value.length !== bookingDetailStore.value.length ||
    bookingDetails.value.some(
      (bookingDetail: BookingCreateBookingDetailForm) => !bookingDetail.id
    )
)

const scheduledReplyDates = ref<{ [key: number]: string }>(
  bookingDetailStore.value.reduce(
    (scheduledReplyDates, bookingDetail, index) => {
      return {
        ...scheduledReplyDates,
        [index]: bookingDetail.scheduledReplyDate
      }
    },
    {}
  )
)

const { handleSubmit, resetForm: resetBookingDetailForm } = useForm({
  validationSchema: toTypedSchema(BookingCreateBookingDetailFormSchema)
})
const fieldSettings: any = {
  roomId: { initialValue: null },
  date: { initialValue: '' },
  startTime: { initialValue: '' },
  endTime: { initialValue: '' },
  layoutType: { initialValue: null },
  guestCount: { initialValue: null },
  status: { initialValue: null },
  isCocktailStyle: { initialValue: false },
  extraChairCount: { initialValue: null },
  extraTableCount: { initialValue: null },
  cancelType: { initialValue: 0 },
  cancellationFeeDays: { initialValue: null }
}
const bookingDetail = generateModel(fieldSettings)

const minEndTime = computed(() => {
  if (!bookingDetail.startTime.value.value) {
    return '07:30'
  }
  return addMinutes(bookingDetail.startTime.value.value, BLOCK_TIME)
})
const maxStartTime = computed(() => {
  if (!bookingDetail.endTime.value.value) {
    return '22:30'
  }
  return addMinutes(bookingDetail.endTime.value.value!, -BLOCK_TIME)
})

const addBookingDetail = handleSubmit(async (bookingDetail) => {
  isLoading.value = true
  const isOverlapRoomTime = checkOverlapRoomTime(
    [...bookingDetails.value, summaryBookingDetail.value],
    bookingDetail
  )
  if (isOverlapRoomTime) {
    isLoading.value = false
    return snackBarStore.showSnackbar({
      type: SnackbarTypes.error,
      message: '予約登録ができませんでした。設定条件などご確認ください。'
    })
  }
  const { temporaryId, ...remainBookingDetail } = bookingDetail
  const formatedBookingDetail = {
    ...remainBookingDetail,
    scheduledReplyDate: scheduledReplyDates.value[temporaryId!]
  }
  const isValidBooking = await bookingStore
    .validateBookingDetail(formatedBookingDetail)
    .finally(() => {
      isLoading.value = false
    })
  if (isValidBooking) {
    bookingDetails.value = [
      ...bookingDetails.value,
      {
        ...bookingDetail,
        temporaryId: new Date().getTime()
      }
    ]
    resetBookingDetailForm()
  }
})

function removeBookingDetail (bookingDetail: BookingCreateBookingDetailForm) {
  bookingDetails.value = bookingDetails.value.filter(({ temporaryId }) => {
    return bookingDetail.temporaryId !== temporaryId
  })
}
function fillBookingDetail () {
  const formatedBookingDetails = bookingDetails.value.map((bookingDetail) => {
    const { temporaryId, ...remainBookingDetail } = bookingDetail
    return {
      ...remainBookingDetail,
      scheduledReplyDate: scheduledReplyDates.value[temporaryId!]
    }
  })
  bookingStore.fillBookingDetails(formatedBookingDetails)
  snackBarStore.showSnackbar({
    message: '複数予約を追加しました。',
    type: SnackbarTypes.success
  })
  resetBookingDetailForm()
  dialogStore.closeDialog()
}
function closeDialog () {
  dialogStore.closeDialog()
  resetBookingDetailForm()
}
</script>

<template>
  <div class="booking-detail">
    <div class="header">
      <h2 class="title">
        複数予約
      </h2>
    </div>
    <v-form class="form-area">
      <div class="wrapper">
        <v-select
          v-model="bookingDetail.roomId.value.value"
          class="select"
          label="会議室"
          variant="outlined"
          item-title="name"
          item-value="id"
          hide-details
          :items="rooms"
          :error-messages="bookingDetail.roomId.errorMessage.value"
        />
      </div>
      <div class="wrapper">
        <doka-date-picker
          v-model="bookingDetail.date.value.value"
          class="datetime"
          type="date"
          placeholder="利用日"
          variant="outlined"
          hide-details
          :label="bookingDetail.date.value.value && '利用日'"
          :error-messages="bookingDetail.date.errorMessage.value"
        />
      </div>
      <div class="wrapper">
        <doka-time-picker
          v-model="bookingDetail.startTime.value.value"
          min="07:00"
          :max="maxStartTime"
          class="input"
          label="開始時間"
          variant="outlined"
          hide-details
          :step="BLOCK_TIME"
          :error-messages="bookingDetail.startTime.errorMessage.value"
        />
        <span>〜</span>
        <doka-time-picker
          v-model="bookingDetail.endTime.value.value"
          max="23:00"
          class="input"
          label="終了時間"
          variant="outlined"
          hide-details
          :step="BLOCK_TIME"
          :min="minEndTime"
          :error-messages="bookingDetail.endTime.errorMessage.value"
        />
      </div>
      <div class="wrapper">
        <v-select
          v-model="bookingDetail.layoutType.value.value"
          :items="layoutTypes.valueLabelList"
          class="select"
          label="レイアウト"
          variant="outlined"
          item-title="label"
          item-value="value"
          hide-details
        />
      </div>
      <div class="wrapper">
        <v-text-field
          v-model.number="bookingDetail.guestCount.value.value"
          class="input"
          label="利用人数"
          hide-details
          :error-messages="bookingDetail.guestCount.errorMessage.value"
          @blur="bookingDetail.guestCount.validate"
        />
      </div>
      <div class="wrapper">
        <v-select
          v-model="bookingDetail.status.value.value"
          class="select"
          label="予約タイプ"
          variant="outlined"
          item-title="label"
          item-value="value"
          hide-details
          :items="bookingTypes.valueLabelList"
          :error-messages="bookingDetail.status.errorMessage.value"
        />
      </div>
      <div class="wrapper">
        <v-checkbox
          v-model="bookingDetail.isCocktailStyle.value.value"
          label="立食"
        />
      </div>
      <v-btn
        class="button"
        color="primary"
        height="30"
        :disabled="isLoading"
        :loading="isLoading"
        @click="addBookingDetail"
      >
        追加
      </v-btn>
    </v-form>
    <div class="content">
      <template v-if="bookingDetails.length">
        <v-data-table
          class="customer-table"
          :headers="headers"
          :items="bookingDetails"
          :items-per-page="bookingDetails.length"
        >
          <template #[`item.actions`]="{ item }">
            <v-btn
              v-if="!item.raw.id"
              variant="text"
              color="error"
              @click="removeBookingDetail(item.raw)"
            >
              削除
            </v-btn>
          </template>
          <template #[`item.roomName`]="{ item }">
            {{ rooms.find(({ id }) => id === item.raw.roomId)!.name }}
          </template>
          <template #[`item.datetime`]="{ item }">
            {{ formatDayJp(item.raw.date) }}
            {{ item.raw.startTime }} ~
            {{ item.raw.endTime }}
          </template>
          <template #[`item.status`]="{ item }">
            {{ bookingStatuses.labelOf(item.raw.status) }}
          </template>
          <template #[`item.layoutType`]="{ item }">
            {{ layoutTypes.labelOf(item.raw.layoutType) }}
          </template>
          <template #[`item.isCocktailStyle`]="{ item }">
            <v-icon v-if="item.raw.isCocktailStyle" color="primary">
              mdi-check
            </v-icon>
          </template>
          <template #[`item.scheduledReplyDate`]="{ item }">
            <template v-if="item.raw.status === bookingTypes.temporary.value">
              <div v-if="canSubmit" class="wrapper">
                <doka-date-picker
                  v-model="scheduledReplyDates[item.raw.temporaryId]"
                  class="datetime"
                  type="date"
                  variant="outlined"
                  hide-details
                />
              </div>
              <div v-else>
                {{ scheduledReplyDates[item.raw.temporaryId] || "-" }}
              </div>
            </template>
            <template v-else>
              -
            </template>
          </template>
          <template #bottom />
        </v-data-table>
      </template>
      <template v-else>
        <doka-empty-data text="該当する情報が見つかりません" />
      </template>
    </div>
    <div class="footer">
      <v-btn
        variant="text"
        color="text-placeholder"
        class="button"
        @click="closeDialog"
      >
        キャンセル
      </v-btn>
      <v-btn :disabled="!canSubmit" class="button" @click="fillBookingDetail">
        複数予約を登録
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.booking-detail {
  min-width: 960px;
  .header > .title {
    margin-bottom: 16px;
  }
  > .footer {
    display: flex;
    margin-top: 15px;
    justify-content: flex-end;
    &:deep(.v-btn__content) {
      font-weight: normal;
    }
  }
  > .content {
    max-height: calc(100vh - 300px);
    overflow-y: auto;
    margin-top: 10px;
    &:deep(.datetime) {
      width: 150px;
    }
  }
  > .content > .nodata {
    padding: 10px;
    text-align: center;
  }
}
.form-area {
  display: flex;
  align-items: center;
  gap: 8px;
  > .wrapper {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  > .wrapper > :where(.input, .select) {
    width: 120px;
  }
  > .wrapper > .datetime {
    width: 150px;
  }
  > .button {
    margin-left: 10px;
  }
}
</style>
