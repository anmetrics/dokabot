<script lang="ts" setup>
import { toTypedSchema } from '@vee-validate/zod'
import { VNodeRef } from 'vue'
// eslint-disable-next-line import/named
import { debounce } from 'lodash/fp'
import { startOfDay } from 'date-fns'
import { Staff } from '~/store/staff'
import {
  BookingList,
  BookingCreateSchema,
  BookingCreateBookingDetailFormSchema
} from '~/store/booking'

const {
  handleSubmit,
  validate: validateBooking,
  resetForm: resetBookingForm
} = useForm({ validationSchema: toTypedSchema(BookingCreateSchema) })
const fieldSettings: any = {
  customerId: { initialValue: null },
  customerName: { initialValue: null },
  customerRepName: { initialValue: null },
  customerTel: { initialValue: null },
  customerFax: { initialValue: null },
  customerMail: { initialValue: null },
  bookingDetails: { initialValue: [] },
  services: { initialValue: [] },
  createdStaffId: { initialValue: null },
  updatedStaffId: { initialValue: null }
}
const booking = generateModel(fieldSettings)

const {
  validate: validateBookingDetailSummary,
  resetForm: resetSummaryBookingDetailForm
} = useForm({
  validationSchema: toTypedSchema(BookingCreateBookingDetailFormSchema)
})
const bookingDetailSummaryFieldSettings: any = {
  roomId: { initialValue: null },
  title: { initialValue: null },
  date: { initialValue: '' },
  startTime: { initialValue: '' },
  endTime: { initialValue: '' },
  status: { initialValue: null },
  cancelType: { initialValue: null },
  isCocktailStyle: { initialValue: false },
  layoutType: { initialValue: null },
  guestCount: { initialValue: null },
  extraTableCount: { initialValue: null },
  extraChairCount: { initialValue: null },
  layoutLocation: { initialValue: null },
  note: { initialValue: null },
  memo: { initialValue: null },
  scheduledReplyDate: { initialValue: null },
  cancellationFeeDays: { initialValue: null }
}
const summaryBookingDetail = generateModel(bookingDetailSummaryFieldSettings)

const bookingFormStore = useBookingFormStore()
const bookingScheduleStore = useBookingScheduleStore()
const snackbarStore = useSnackbarStore()
const {
  booking: bookingInfo,
  rooms,
  customers,
  staffs: allStaffs,
  summaryBookingDetail: summaryBookingDetailInfo,
  modifiedBookingDetail,
  bookingDetails,
  isClearBookingProcessing,
  isLoading
} = storeToRefs(bookingFormStore)
const dialogStore = useDialogStore()
function openSearchCustomerDialog () {
  dialogStore.showDialog(resolveComponent('bookings-search-customer'))
}

const canShowBookingService = computed(
  () =>
    summaryBookingDetail.date.value.value &&
    summaryBookingDetail.endTime.value.value &&
    summaryBookingDetail.startTime.value.value &&
    booking.customerId.value.value
)
const staffIdSearchParam = ref<string>()
const createdStaffIdFormRef = ref<VNodeRef | null>(null)
const updatedStaffIdFormRef = ref<VNodeRef | null>(null)
const activeStaffs = computed<Staff[]>(() => {
  return allStaffs.value.filter(({ isEnabled }: Staff) => isEnabled)
})
const staffs = ref<Staff[]>(activeStaffs.value)
function selectCustomer (customerId: number) {
  bookingInfo.value.customerId = customerId
  customerIdFormRef.value.$el.querySelector('input').blur()
  bookingFormStore.fillBookingCustomer(
    customers.value.find(({ id }) => id === customerId)!
  )
}
function validateBookingCustomerInfo () {
  booking.customerId.validate()
  booking.customerName.validate()
  booking.customerRepName.validate()
  booking.customerTel.validate()
  booking.customerFax.validate()
  booking.customerMail.validate()
}

function selectStaff (staffId: number, field: string) {
  if (field === 'createdStaffId') {
    booking.createdStaffId.value.value = staffId
    createdStaffIdFormRef.value.$el.querySelector('input').blur()
  } else if (field === 'updatedStaffId') {
    booking.updatedStaffId.value.value = staffId
    updatedStaffIdFormRef.value.$el.querySelector('input').blur()
  }
}

async function handleCreatedStaffInput () {
  await nextTick()
  staffs.value = activeStaffs.value.filter((staff: Staff) => {
    return (
      staffIdSearchParam.value &&
      staff.id?.toString().includes(staffIdSearchParam.value)
    )
  })

  if (staffIdSearchParam.value) {
    const staff = activeStaffs.value.find(
      staff => staff.id === Number(staffIdSearchParam.value)
    )
    booking.createdStaffId.value.value = staff && staff?.id
  }
}

async function handleUpdatedStaffInput () {
  await nextTick()
  staffs.value = [...activeStaffs.value].filter((staff: Staff) => {
    return (
      staffIdSearchParam.value &&
      staff.id?.toString().includes(staffIdSearchParam.value)
    )
  })
  if (staffIdSearchParam.value) {
    const staff = activeStaffs.value.find(
      staff => staff.id === Number(staffIdSearchParam.value)
    )
    booking.updatedStaffId.value.value = staff && staff.id
  }
}

const generateMessageStaff = computed<string>(() => {
  const disabledStaff = allStaffs.value.find(
    (staff: Staff) =>
      !staff.isEnabled && Number(staffIdSearchParam.value) === staff.id
  )
  return disabledStaff
    ? '無効な担当者が設定されています。'
    : '該当する情報が見つかりません'
})

const notShowStatusCancelBookingStatus = [
  bookingStatuses.official.value,
  bookingStatuses.temporary.value,
  bookingStatuses.waitingCancel.value,
  bookingStatuses.checkIn.value
]

const canCancelBookingDetail = computed<boolean>(() => {
  return (
    startOfDay(new Date()) <=
    new Date(
      `${modifiedBookingDetail.value.date} ${modifiedBookingDetail.value.startTime}`
    )
  )
})

const isCanceledBookingDetail = computed(
  () => modifiedBookingDetail.value.status === bookingStatuses.canceled.value
)
const isShowButtonCancel = computed(
  () =>
    bookingInfo.value.id &&
    canCancelBookingDetail.value &&
    !isCanceledBookingDetail.value &&
    ![
      bookingStatuses.withholdPayment.value,
      bookingStatuses.completePayment.value
    ].includes(modifiedBookingDetail.value.status)
)

const acceptedBookingStatuses = computed(() => {
  if (bookingInfo.value.id) {
    return bookingStatuses.valueLabelList.filter(
      (bookingStatus: { value: number }) => {
        if (isCanceledBookingDetail.value) {
          return (
            bookingStatus.value === bookingStatuses.completePayment.value ||
            bookingStatus.value === bookingStatuses.withholdPayment.value ||
            bookingStatus.value === bookingStatuses.canceled.value
          )
        } else if (
          modifiedBookingDetail.value.status ===
            bookingStatuses.withholdPayment.value ||
          modifiedBookingDetail.value.status ===
            bookingStatuses.completePayment.value
        ) {
          return (
            bookingStatus.value === bookingStatuses.completePayment.value ||
            bookingStatus.value === bookingStatuses.withholdPayment.value
          )
        } else if (
          !canCancelBookingDetail.value ||
          notShowStatusCancelBookingStatus.includes(
            modifiedBookingDetail.value.status
          )
        ) {
          return bookingStatus.value !== bookingStatuses.canceled.value
        } else {
          return true
        }
      }
    )
  }

  return [
    bookingStatuses.official,
    bookingStatuses.temporary,
    bookingStatuses.waitingCancel
  ]
})

const isLoadingCustomer = ref<boolean>(false)
const customerIdFormRef = ref<VNodeRef | null>(null)
const customerIdSearchParam = ref<string>()
const debounceSearchCustomers = debounce(300, searchCustomers)
async function searchCustomers (matchableId: string) {
  customers.value = []
  customerIdSearchParam.value = matchableId
  if (matchableId) {
    isLoadingCustomer.value = true
    await bookingFormStore.getCustomers({
      matchableId,
      page: 1,
      orderBy: 4
    })

    const customer = customers.value.find(({ id }) => id === +matchableId)
    if (customer) {
      bookingFormStore.fillBookingCustomer(customer)
    }
    isLoadingCustomer.value = false
  }
}
const minEndTime = computed(() => {
  if (!summaryBookingDetail.startTime.value.value) {
    return '07:30'
  }
  return addMinutes(summaryBookingDetail.startTime.value.value!, BLOCK_TIME)
})
const maxStartTime = computed(() => {
  if (!summaryBookingDetail.endTime.value.value) {
    return '22:30'
  }
  return addMinutes(summaryBookingDetail.endTime.value.value!, -BLOCK_TIME)
})

const createdStaffName = computed(() => {
  const staff = allStaffs.value.find(
    ({ id }) => id === booking.createdStaffId.value.value
  )

  return staff ? staff.name : ''
})
const updatedStaffName = computed(() => {
  const staff = allStaffs.value.find(
    ({ id }) => id === booking.updatedStaffId.value.value
  )

  return staff ? staff.name : ''
})

watch(
  () => summaryBookingDetailInfo.value.status,
  () => {
    if (
      summaryBookingDetailInfo.value.status === bookingStatuses.canceled.value
    ) {
      openBookingDetailCancelDialog()
    }
  }
)

watch(
  () => booking.customerId.value.value,
  (newValue) => {
    if (!newValue) {
      booking.customerName.value.value = null
      booking.customerTel.value.value = null
      booking.customerFax.value.value = null
      booking.customerRepName.value.value = null
      booking.customerMail.value.value = null
      bookingInfo.value = {}
    }
  }
)

watch(
  () => [
    summaryBookingDetail.cancelType.value.value,
    summaryBookingDetail.cancellationFeeDays.value.value
  ],
  ([cancelType, cancellationFeeDays]) => {
    if (!cancelType) {
      return
    }

    summaryBookingDetailInfo.value.cancelType = cancelType
    summaryBookingDetailInfo.value.cancellationFeeDays = cancellationFeeDays
  }
)

watch(
  () => [bookingInfo.value.customerId, bookingInfo.value.id],
  ([newCustomerId, _]) => {
    if (newCustomerId) {
      booking.customerId.value.value = bookingInfo.value.customerId
      booking.customerName.value.value = bookingInfo.value.customerName
      booking.customerTel.value.value = bookingInfo.value.customerTel
      booking.customerFax.value.value = bookingInfo.value.customerFax
      booking.customerRepName.value.value = bookingInfo.value.customerRepName
      booking.customerMail.value.value = bookingInfo.value.customerMail
      booking.createdStaffId.value.value = bookingInfo.value.createdStaffId
      booking.updatedStaffId.value.value = bookingInfo.value.updatedStaffId
      validateBookingCustomerInfo()
    } else {
      resetBookingForm()
    }
  },
  { immediate: true }
)

watch(
  () => summaryBookingDetailInfo.value.id,
  (newBookingDetailId) => {
    if (newBookingDetailId) {
      summaryBookingDetail.roomId.value.value =
        summaryBookingDetailInfo.value.roomId
      summaryBookingDetail.title.value.value =
        summaryBookingDetailInfo.value.title
      summaryBookingDetail.date.value.value =
        summaryBookingDetailInfo.value.date
      summaryBookingDetail.startTime.value.value =
        summaryBookingDetailInfo.value.startTime
      summaryBookingDetail.endTime.value.value =
        summaryBookingDetailInfo.value.endTime
      summaryBookingDetail.layoutType.value.value =
        summaryBookingDetailInfo.value.layoutType
      summaryBookingDetail.guestCount.value.value =
        summaryBookingDetailInfo.value.guestCount
      summaryBookingDetail.status.value.value =
        summaryBookingDetailInfo.value.status
      summaryBookingDetail.isCocktailStyle.value.value =
        summaryBookingDetailInfo.value.isCocktailStyle
      summaryBookingDetail.scheduledReplyDate.value.value =
        summaryBookingDetailInfo.value.scheduledReplyDate
      summaryBookingDetail.extraTableCount.value.value =
        summaryBookingDetailInfo.value.extraTableCount
      summaryBookingDetail.extraChairCount.value.value =
        summaryBookingDetailInfo.value.extraChairCount
      summaryBookingDetail.layoutLocation.value.value =
        summaryBookingDetailInfo.value.layoutLocation
      summaryBookingDetail.note.value.value =
        summaryBookingDetailInfo.value.note
      summaryBookingDetail.cancelType.value.value =
        summaryBookingDetailInfo.value.cancelType
      summaryBookingDetail.cancellationFeeDays.value.value =
        summaryBookingDetailInfo.value.cancellationFeeDays
      summaryBookingDetail.memo.value.value =
        summaryBookingDetailInfo.value.memo
    } else {
      resetSummaryBookingDetailForm()
    }
  },
  { immediate: true }
)

watch(
  () => [
    summaryBookingDetailInfo.value.roomId,
    summaryBookingDetailInfo.value.date,
    summaryBookingDetailInfo.value.startTime,
    summaryBookingDetailInfo.value.endTime,
    summaryBookingDetailInfo.value.cancelType
  ],
  ([
    newBookingDetailRoomId,
    newBookingDetailDate,
    newBookingDetailStartTime,
    newBookingDetailEndTime,
    newBookingDetailCancelType
  ]) => {
    if (
      newBookingDetailRoomId ||
      newBookingDetailDate ||
      newBookingDetailStartTime ||
      newBookingDetailEndTime ||
      newBookingDetailCancelType
    ) {
      if (isClearBookingProcessing.value) {
        return
      }
      if (newBookingDetailRoomId) {
        summaryBookingDetail.roomId.value.value =
          summaryBookingDetailInfo.value.roomId
        summaryBookingDetail.roomId.validate()
      }
      if (newBookingDetailDate) {
        summaryBookingDetail.date.value.value =
          summaryBookingDetailInfo.value.date
        summaryBookingDetail.date.validate()
      }
      if (newBookingDetailStartTime) {
        summaryBookingDetail.startTime.value.value =
          summaryBookingDetailInfo.value.startTime
        summaryBookingDetail.startTime.validate()
      }
      if (newBookingDetailEndTime) {
        summaryBookingDetail.endTime.value.value =
          summaryBookingDetailInfo.value.endTime
        summaryBookingDetail.endTime.validate()
      }
      if (newBookingDetailCancelType) {
        summaryBookingDetail.cancelType.value.value =
          summaryBookingDetailInfo.value.cancelType
        summaryBookingDetail.cancellationFeeDays.value.value =
          summaryBookingDetailInfo.value.cancellationFeeDays
        summaryBookingDetail.cancelType.validate()
      }
      if (summaryBookingDetailInfo.value.status) {
        summaryBookingDetail.status.value.value =
          summaryBookingDetailInfo.value.status
        summaryBookingDetail.status.validate()
      }
    }
  }
)

watch(
  () => [
    summaryBookingDetail.startTime.value.value,
    summaryBookingDetail.endTime.value.value,
    summaryBookingDetail.date.value.value,
    summaryBookingDetail.roomId.value.value,
    booking.customerId.value.value
  ],
  ([newStartTime, newEndTime, newDate, newRoomId]) => {
    if (newStartTime) {
      summaryBookingDetailInfo.value.startTime = newStartTime
    }
    if (newEndTime) {
      summaryBookingDetailInfo.value.endTime = newEndTime
    }
    if (newDate) {
      summaryBookingDetailInfo.value.date = newDate
    }
    if (newRoomId) {
      summaryBookingDetailInfo.value.roomId = newRoomId
    }
  }
)

watch(
  () => booking.createdStaffId.value.value,
  (newCreatedStaffId) => {
    if (!bookingInfo.value.id) {
      booking.updatedStaffId.value.value = newCreatedStaffId
    }
    bookingInfo.value.createdStaffId = newCreatedStaffId
  }
)

watch(
  () => booking.updatedStaffId.value.value,
  (newUpdatedStaffId) => {
    bookingInfo.value.updatedStaffId = newUpdatedStaffId
  }
)

watch(
  () => summaryBookingDetail.cancelType.value.value,
  (newCancelType) => {
    summaryBookingDetail.cancellationFeeDays.resetField()
    if (newCancelType === cancelTypes.others.value) {
      summaryBookingDetail.cancellationFeeDays.value.value = ''
    } else {
      summaryBookingDetail.cancellationFeeDays.value.value = null
    }
  }
)

function openServiceDialog () {
  dialogStore.showDialog(resolveComponent('bookings-adjust-services'))
}
function openBookingDetailDialog () {
  dialogStore.showPersistentDialog(
    resolveComponent('bookings-adjust-booking-details')
  )
}
function openBookingDetailCancelDialog () {
  dialogStore.showDialog(resolveComponent('bookings-cancel-form'))
}

function handleIntegerNumber ($event: any, field: string) {
  const value = $event.target.value
  if (value) {
    if (!isNaN(value)) {
      summaryBookingDetail[field].handleChange(Number(value), false)
    } else {
      summaryBookingDetail[field].handleChange(value, false)
    }
  } else {
    summaryBookingDetail[field].handleChange(null, false)
  }
}

function handleNotNullableIntegerNumber ($event: any, field: string) {
  const value = $event.target.value
  if (value) {
    if (!isNaN(value)) {
      summaryBookingDetail[field].handleChange(Number(value), false)
    } else {
      summaryBookingDetail[field].handleChange(value, false)
    }
  } else {
    summaryBookingDetail[field].handleChange('', false)
  }
}

async function checkValidAndSubmitBooking () {
  const { valid: isBookingValid } = await validateBooking()
  const { valid: isSummaryBookingDetailValid, ...bookingDetailInvalidInfo } =
    await validateBookingDetailSummary()
  if (isBookingValid && isSummaryBookingDetailValid) {
    return submitBooking()
  }

  if (!isSummaryBookingDetailValid) {
    const errorKeys = Object.keys(bookingDetailInvalidInfo.errors)
    if (errorKeys.length === 1 && errorKeys[0] === 'cancellationFeeDays') {
      return snackbarStore.showSnackbar({
        message:
          'キャンセル区分に「その他」を選択している場合は、キャンセル発生の日数を入力してください。',
        type: SnackbarTypes.error
      })
    }
  }

  const isNewBooking = !bookingInfo.value.id
  if (!isSummaryBookingDetailValid || !isBookingValid) {
    return snackbarStore.showSnackbar({
      message: isNewBooking
        ? '予約登録ができませんでした。設定条件などご確認ください。'
        : '予約更新ができませんでした。設定条件などご確認ください。',
      type: SnackbarTypes.error
    })
  }
}

const submitBooking = handleSubmit(async (booking) => {
  isLoading.value = true
  await nextTick()
  const isOverlapRoomTime = checkOverlapRoomTime(
    bookingDetails.value,
    summaryBookingDetail
  )
  if (isOverlapRoomTime) {
    const isNewBooking = !bookingInfo.value.id
    return snackbarStore.showSnackbar({
      message: isNewBooking
        ? '予約登録ができませんでした。設定条件などご確認ください。'
        : '予約更新ができませんでした。設定条件などご確認ください。',
      type: SnackbarTypes.error
    })
  }
  const maybeModifiedBookingForm = {
    ...bookingInfo.value,
    ...booking,
    ...{ id: bookingInfo.value.id }
  }

  const maybeModifiedSummaryBookingDetail = {
    ...summaryBookingDetailInfo.value,
    roomId: summaryBookingDetail.roomId.value.value,
    title: summaryBookingDetail.title.value.value,
    date: summaryBookingDetail.date.value.value,
    startTime: summaryBookingDetail.startTime.value.value,
    endTime: summaryBookingDetail.endTime.value.value,
    layoutType: summaryBookingDetail.layoutType.value.value,
    guestCount: summaryBookingDetail.guestCount.value.value,
    status: summaryBookingDetail.status.value.value,
    isCocktailStyle: summaryBookingDetail.isCocktailStyle.value.value,
    scheduledReplyDate: summaryBookingDetail.scheduledReplyDate.value.value,
    extraTableCount: summaryBookingDetail.extraTableCount.value.value,
    extraChairCount: summaryBookingDetail.extraChairCount.value.value,
    layoutLocation: summaryBookingDetail.layoutLocation.value.value,
    note: summaryBookingDetail.note.value.value,
    cancelType: summaryBookingDetail.cancelType.value.value,
    cancellationFeeDays: summaryBookingDetail.cancellationFeeDays.value.value,
    memo: summaryBookingDetail.memo.value.value
  }
  bookingFormStore.fillBooking(maybeModifiedBookingForm)
  bookingFormStore.fillSummaryBookingDetail(maybeModifiedSummaryBookingDetail)

  await bookingFormStore.submitBooking()
  if (
    (!summaryBookingDetailInfo.value.id && !bookingInfo.value.id) ||
    summaryBookingDetail.status.value.value === bookingTypes.waitingCancel.value
  ) {
    snackbarStore.showSnackbar({
      message: '新しい予約を登録しました。',
      type: SnackbarTypes.success
    })
    bookingFormStore.clearBookingData()
    resetBookingForm()
    resetSummaryBookingDetailForm()
  } else {
    bookingFormStore.fillModifiedBookingDetail(
      maybeModifiedSummaryBookingDetail
    )

    const relatedBookingDetails = await bookingScheduleStore.getBookingDetails({
      bookingId: bookingInfo.value.id!
    })

    bookingFormStore.fillBookingDetails(
      relatedBookingDetails
        .filter(
          (currentBookingDetail: BookingList) =>
            +currentBookingDetail.bookingDetailId !==
            +summaryBookingDetailInfo.value.id!
        )
        .map((bookingDetail: BookingList) => {
          return {
            id: bookingDetail.bookingDetailId,
            roomId: bookingDetail.roomId,
            date: formatDateTime(
              new Date(bookingDetail.startDatetime),
              'yyyy-MM-dd'
            ),
            startTime: formatDateTime(
              new Date(bookingDetail.startDatetime),
              'HH:mm'
            ),
            endTime: formatDateTime(
              new Date(bookingDetail.endDatetime),
              'HH:mm'
            ),
            layoutType: bookingDetail.layoutType,
            guestCount: bookingDetail.guestCount,
            status: bookingDetail.status,
            isCocktailStyle: bookingDetail.isCocktailStyle,
            scheduledReplyDate: bookingDetail.scheduledReplyDate
              ? formatDateTime(
                new Date(bookingDetail.scheduledReplyDate),
                'yyyy-MM-dd'
              )
              : bookingDetail.scheduledReplyDate
          }
        })
    )

    snackbarStore.showSnackbar({
      message: '予約情報を更新しました。',
      type: SnackbarTypes.success
    })
  }
  await bookingScheduleStore.fetchSchedules()
})
await Promise.all([bookingFormStore.getRooms(), bookingFormStore.getStaffs()])
</script>

<template>
  <v-form ref="bookingFormRef" class="booking-form">
    <div v-if="bookingInfo.id" class="heading">
      <div class="column">
        <p class="text">
          予約番号：{{ bookingInfo.id }}
        </p>
      </div>
      <div class="column">
        <p class="text">
          予約登録日：
          {{
            formatDayJp(summaryBookingDetailInfo.createdDatetime!, {
              includeDayOfWeek: false,
            })
          }}
        </p>
        <p class="text">
          予約更新日：
          {{
            formatDayJp(summaryBookingDetailInfo.updatedDatetime!, {
              includeDayOfWeek: false,
            })
          }}
        </p>
      </div>
    </div>
    <div class="row -customer-id">
      <v-autocomplete
        ref="customerIdFormRef"
        v-model="booking.customerId.value.value"
        class="input -small"
        item-value="id"
        item-title="id"
        label="顧客番号"
        variant="outlined"
        no-data
        hide-details
        :error-messages="booking.customerId.errorMessage.value"
        :menu-icon="false"
        :loading="isLoadingCustomer"
        :items="customers"
        @update:search="debounceSearchCustomers"
        @blur="booking.customerId.validate"
      >
        <template #item="{ item: customer }">
          <p
            class="option"
            :class="{
              '-active': customer.raw.id === booking.customerId.value.value,
            }"
            @click="selectCustomer(customer.raw.id)"
          >
            <span class="id">
              {{ customer.raw.id }}
            </span>
            <span class="name">
              {{ customer.raw.name }}
            </span>
          </p>
        </template>
        <template #no-data>
          <p v-if="customerIdSearchParam && !isLoadingCustomer" class="nodata">
            該当する情報が見つかりません
          </p>
        </template>
      </v-autocomplete>
      <v-btn
        class="button"
        variant="outlined"
        append-icon="mdi-magnify"
        color="primary"
        @click="openSearchCustomerDialog"
      >
        顧客検索
      </v-btn>
    </div>
    <div class="row">
      <v-text-field
        v-model="booking.customerName.value.value"
        class="input"
        label="会社名"
        variant="outlined"
        hide-details
      />
    </div>
    <div class="row">
      <v-text-field
        v-model="summaryBookingDetail.title.value.value"
        class="input"
        label="会合名"
        variant="outlined"
        hide-details
      />
    </div>
    <div class="row">
      <v-text-field
        v-model="booking.customerRepName.value.value"
        class="input"
        label="予約者"
        variant="outlined"
        hide-details
        :error-messages="booking.customerRepName.errorMessage.value"
      />
    </div>
    <div class="row">
      <v-text-field
        v-model="booking.customerTel.value.value"
        class="input"
        label="電話番号"
        variant="outlined"
        hide-details
        :error-messages="booking.customerTel.errorMessage.value"
        @blur="booking.customerTel.validate"
      />
      <v-text-field
        v-model="booking.customerFax.value.value"
        class="input"
        label="FAX番号"
        variant="outlined"
        hide-details
        :error-messages="booking.customerFax.errorMessage.value"
        @blur="booking.customerFax.validate"
      />
    </div>
    <div class="row">
      <v-text-field
        v-model="booking.customerMail.value.value"
        class="input"
        label="メールアドレス"
        variant="outlined"
        hide-details
        :error-messages="booking.customerMail.errorMessage.value"
        @blur="booking.customerMail.validate"
      />
    </div>
    <div class="row">
      <v-select
        v-model="summaryBookingDetail.roomId.value.value"
        class="select -small"
        label="会議室"
        variant="outlined"
        item-title="name"
        item-value="id"
        hide-details
        :items="rooms"
        :error-messages="summaryBookingDetail.roomId.errorMessage.value"
      />
    </div>
    <div class="row">
      <doka-date-picker
        v-model="summaryBookingDetail.date.value.value"
        class="input -date"
        type="date"
        placeholder="利用日"
        variant="outlined"
        hide-details
        :error-messages="summaryBookingDetail.date.errorMessage.value"
        :label="summaryBookingDetail.date.value.value && '利用日'"
      />
      <v-checkbox
        v-model="summaryBookingDetail.isCocktailStyle.value.value"
        class="checkbox"
        label="立食"
        hide-details
      />
    </div>
    <div class="row -no-space">
      <doka-time-picker
        v-model="summaryBookingDetail.startTime.value.value"
        class="input -medium"
        min="07:00"
        :max="maxStartTime"
        label="開始時間"
        variant="outlined"
        hide-details
        :step="BLOCK_TIME"
        :error-messages="summaryBookingDetail.startTime.errorMessage.value"
      />
      <span class="icon">〜</span>
      <doka-time-picker
        v-model="summaryBookingDetail.endTime.value.value"
        class="input -medium"
        max="23:00"
        label="終了時間"
        variant="outlined"
        hide-details
        :min="minEndTime"
        :step="BLOCK_TIME"
        :error-messages="summaryBookingDetail.endTime.errorMessage.value"
      />
    </div>
    <div class="row">
      <v-select
        v-model="summaryBookingDetail.status.value.value"
        class="select -medium"
        label="予約タイプ"
        variant="outlined"
        item-title="label"
        item-value="value"
        hide-details
        :items="acceptedBookingStatuses"
        :error-messages="summaryBookingDetail.status.errorMessage.value"
        @blur="summaryBookingDetail.status.validate"
      />
      <doka-date-picker
        v-if="
          summaryBookingDetail.status.value.value ===
            bookingTypes.temporary.value
        "
        v-model="summaryBookingDetail.scheduledReplyDate.value.value"
        class="input"
        type="date"
        label="回答予定日"
        variant="outlined"
        hide-details
      />
    </div>
    <div class="row">
      <v-select
        v-model="summaryBookingDetail.layoutType.value.value"
        class="select -medium"
        label="レイアウト"
        variant="outlined"
        item-title="label"
        item-value="value"
        hide-details
        clearable
        :items="layoutTypes.valueLabelList"
      />
      <v-text-field
        v-model.number="summaryBookingDetail.guestCount.value.value"
        class="input -small"
        label="利用人数"
        variant="outlined"
        hide-details
        :error-messages="summaryBookingDetail.guestCount.errorMessage.value"
        @blur="summaryBookingDetail.guestCount.validate"
        @change="handleIntegerNumber($event, 'guestCount')"
      />
      <v-btn
        class="button"
        variant="text"
        min-width="0"
        height="auto"
        @click="openBookingDetailDialog"
      >
        <v-icon color="primary" size="x-large">
          mdi-plus
        </v-icon>
        <v-tooltip activator="parent" location="top">
          複数予約する
        </v-tooltip>
      </v-btn>
    </div>
    <div class="row">
      <v-text-field
        v-model.number="summaryBookingDetail.extraChairCount.value.value"
        class="input -small"
        label="追加椅子"
        variant="outlined"
        hide-details
        :error-messages="
          summaryBookingDetail.extraChairCount.errorMessage.value
        "
        @blur="summaryBookingDetail.extraChairCount.validate"
        @change="handleIntegerNumber($event, 'extraChairCount')"
      />
      <v-text-field
        v-model.number="summaryBookingDetail.extraTableCount.value.value"
        class="input -small"
        label="追加机"
        variant="outlined"
        hide-details
        :error-messages="
          summaryBookingDetail.extraTableCount.errorMessage.value
        "
        @blur="summaryBookingDetail.extraTableCount.validate"
        @change="handleIntegerNumber($event, 'extraTableCount')"
      />
      <v-btn
        :disabled="!canShowBookingService"
        class="button"
        variant="text"
        min-width="0"
        height="auto"
        @click="openServiceDialog"
      >
        <v-icon
          size="x-large"
          :color="canShowBookingService ? 'primary' : 'border'"
        >
          mdi-plus
        </v-icon>
        <v-tooltip activator="parent" location="top">
          <span>備品を登録する</span>
        </v-tooltip>
      </v-btn>
    </div>
    <div class="row">
      <v-text-field
        v-model="summaryBookingDetail.layoutLocation.value.value"
        class="input -small"
        label="図面F"
        variant="outlined"
        hide-details
      />
      <v-select
        v-model="summaryBookingDetail.cancelType.value.value"
        class="select"
        label="キャンセル規定"
        variant="outlined"
        item-title="label"
        item-value="value"
        hide-details
        clearable
        :items="cancelTypes.valueLabelList"
        :error-messages="summaryBookingDetail.cancelType.errorMessage.value"
        @blur="summaryBookingDetail.cancelType.validate"
      />
    </div>
    <div
      v-if="
        summaryBookingDetail.cancelType.value.value === cancelTypes.others.value
      "
      class="row -cancel-day"
    >
      <span class="text">利用日を除く</span>
      <v-text-field
        v-model="summaryBookingDetail.cancellationFeeDays.value.value"
        class="input -supersmall"
        variant="outlined"
        hide-details
        :error-messages="
          summaryBookingDetail.cancellationFeeDays.errorMessage.value
        "
        @blur="summaryBookingDetail.cancellationFeeDays.validate"
        @change="handleNotNullableIntegerNumber($event, 'cancellationFeeDays')"
      />
      <span class="text">日前よりキャンセル料発生</span>
    </div>
    <div class="row">
      <v-textarea
        v-model="summaryBookingDetail.note.value.value"
        class="textarea"
        label="注意事項"
        variant="outlined"
        rows="2"
        no-resize
      />
    </div>
    <div class="row">
      <v-textarea
        v-model="summaryBookingDetail.memo.value.value"
        class="textarea"
        label="変更事項"
        variant="outlined"
        rows="2"
        no-resize
        hide-details
      />
    </div>
    <div v-if="!bookingInfo.id" class="row -createdstaff">
      <v-autocomplete
        ref="createdStaffIdFormRef"
        v-model="booking.createdStaffId.value.value"
        v-model:search="staffIdSearchParam"
        :items="staffs"
        :menu-icon="false"
        class="input -small"
        label="担当者番号"
        item-value="id"
        item-title="id"
        variant="outlined"
        hide-details
        :error-messages="booking.createdStaffId.errorMessage.value"
        @blur="booking.createdStaffId.validate"
        @update:search="handleCreatedStaffInput"
      >
        <template #item="{ item: staff }">
          <template v-if="staffIdSearchParam">
            <p
              class="option"
              :class="{
                '-active': staff.raw.id === booking.createdStaffId.value.value,
              }"
              @click="selectStaff(staff.raw.id, 'createdStaffId')"
            >
              <span class="id">
                {{ staff.raw.id }}
              </span>
              <span class="name">
                {{ staff.raw.name }}
              </span>
            </p>
          </template>
        </template>
        <template #no-data>
          <p v-if="staffIdSearchParam" class="nodata">
            {{ generateMessageStaff }}
          </p>
        </template>
      </v-autocomplete>
      <template v-if="booking.createdStaffId.value.value">
        <p class="text">
          {{ createdStaffName }}
        </p>
      </template>
    </div>
    <div v-else class="row -updatedstaff">
      <v-autocomplete
        ref="updatedStaffIdFormRef"
        v-model="booking.updatedStaffId.value.value"
        v-model:search="staffIdSearchParam"
        :items="staffs"
        :menu-icon="false"
        class="input -small"
        label="担当者番号"
        item-value="id"
        item-title="id"
        variant="outlined"
        hide-details
        :error-messages="booking.updatedStaffId.errorMessage.value"
        @blur="booking.updatedStaffId.validate"
        @update:search="handleUpdatedStaffInput"
      >
        <template #item="{ item: staff }">
          <template v-if="staffIdSearchParam">
            <p
              class="option"
              :class="{
                '-active': staff.raw.id === booking.updatedStaffId.value.value,
              }"
              @click="selectStaff(staff.raw.id, 'updatedStaffId')"
            >
              <span class="id">
                {{ staff.raw.id }}
              </span>
              <span class="name">
                {{ staff.raw.name }}
              </span>
            </p>
          </template>
        </template>
        <template #no-data>
          <p v-if="staffIdSearchParam" class="nodata">
            {{ generateMessageStaff }}
          </p>
        </template>
      </v-autocomplete>
      <template v-if="booking.updatedStaffId.value.value">
        <p class="text">
          {{ updatedStaffName }}
        </p>
      </template>
    </div>
    <div v-if="bookingInfo.id" class="row">
      <nuxt-link class="link" :to="`/bookings/${bookingInfo.id}`">
        詳細を編集する
        <v-icon icon="mdi-chevron-right" />
      </nuxt-link>
    </div>
  </v-form>
  <div class="action-area">
    <v-btn
      v-if="isShowButtonCancel"
      class="button"
      color="error"
      variant="text"
      @click="openBookingDetailCancelDialog"
    >
      キャンセル
    </v-btn>
    <v-btn
      class="button"
      :loading="isLoading"
      @click="checkValidAndSubmitBooking"
    >
      {{ !bookingInfo.id ? "予約" : "予約情報を更新" }}
    </v-btn>
  </div>
</template>

<style scoped lang="scss">
.booking-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 16px 16px;
  > .heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    > .column > .text {
      font-size: 10px;
      color: rgb(var(--v-theme-text-placeholder));
    }
  }
  > .row {
    display: flex;
    align-items: center;
    gap: 12px;
    > .checkbox {
      --v-input-control-height: 40px;
      flex: unset;
    }
    &.-no-space {
      justify-content: space-between;
      gap: 0;
    }
    &.-cancel-day {
      gap: 4px;
      &:deep(.v-field__input) {
        text-align: center;
        padding-inline: 5px;
      }
      > .text {
        font-size: 11.5px;
      }
    }
    &.-customer-id > .button {
      align-self: end;
      height: 28px;
      line-height: 2;
      &:deep(.v-btn__content) {
        font-weight: normal;
      }
    }
    &:not(.-actions, .-customer-id) > .button {
      padding: 0;
      font-size: 1.5em;
      margin-left: auto;
    }
    &.-createdstaff > .text,
    &.-updatedstaff > .text {
      color: rgb(var(--v-theme-text-placeholder));
    }
    &.row > .link {
      display: flex;
      align-items: center;
      margin-left: auto;
    }
    > .input,
    > .select {
      flex: 1;
      &.-supersmall {
        flex: 0 32px;
      }
      &.-small {
        flex: 0 150px;
      }
      &.-medium {
        flex: 0 150px;
      }
      &.-date {
        flex: 0 150px;
      }
    }
    > .text {
      font-size: 12px;
    }
    > .link {
      font-size: 12px;
      color: rgb(var(--v-theme-primary));
      font-weight: bold;
    }
    &:deep(.v-field__clearable) {
      color: rgb(var(--v-theme-primary));
      > .v-icon {
        opacity: 1;
      }
    }
    &:deep(.v-checkbox .v-label) {
      margin-top: 3px;
    }
  }
}
.action-area {
  display: flex;
  justify-content: flex-end;
  padding: 0 16px;
}
</style>
