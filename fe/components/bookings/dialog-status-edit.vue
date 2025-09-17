<script lang="ts" setup>
import pick from 'lodash/fp/pick'
import { startOfDay, differenceInDays, isBefore } from 'date-fns'
import { VNodeRef } from 'vue'
import {
  RoomBookingDetail,
  BookingStatusesEditPayload,
  cancelTypes,
  bookingStatuses
} from '~/store/booking'
import { Staff } from '~/store/staff'

const normalStatus = [
  bookingStatuses.official.value,
  bookingStatuses.temporary.value,
  bookingStatuses.waitingCancel.value,
  bookingStatuses.checkIn.value
]

const route = useRoute()
const bookingId = Number(route.params.bookingId)
type Status = { value: number; label: string }
const currentDate = startOfDay(new Date())

const { closeDialog } = useDialogStore()
const bookingDetailStore = useBookingDetailStore()
const {
  bookingDetailSearchParams,
  bookingDetails,
  selectedBookingDetailIds,
  isLoadings
} = storeToRefs(bookingDetailStore)
const staffStore = useStaffStore()
const { staffs: allStaffs } = storeToRefs(staffStore)
const staffList = allStaffs.value.map(staff => {
  return {
    ...staff,
    staffIdSearchParam: `${staff.id} ${staff.name}`
  }
})
const activeStaffs = computed<Staff[]>(() => {
  return staffList.filter(({ isEnabled }: Staff) => isEnabled)
})
const formRef = ref<VNodeRef | null>(null)
const selectedBookingDetails = computed<RoomBookingDetail[]>(() =>
  bookingDetails.value.filter(({ bookingDetailId }) =>
    selectedBookingDetailIds.value.includes(bookingDetailId)
  )
)

const statusKeys = computed<string[]>(() => {
  if (normalStatus.includes(selectedBookingDetails.value[0].status)) {
    return [
      'official',
      'temporary',
      'checkIn',
      'waitingCancel',
      'withholdPayment',
      'completePayment',
      'canceled'
    ]
  } else if (
    selectedBookingDetails.value[0].status === bookingStatuses.canceled.value
  ) {
    return ['canceled', 'withholdPayment', 'completePayment']
  } else {
    return ['withholdPayment', 'completePayment']
  }
})
const statusOptions: Status[] = Object.values(
  pick(statusKeys.value, bookingStatuses)
)
const booking = reactive<BookingStatusesEditPayload>({
  status: selectedBookingDetails.value[0].status
})
const staffIdFormRef = ref<VNodeRef | null>(null)
const cancelStaffName = ref<string>('')
function selectStaff(staff: Staff) {
  booking.cancelStaffId = staff.id
  cancelStaffName.value = staff.name
  staffIdFormRef.value.$el.querySelector('input').blur()
}

const staffs = ref<Staff[]>([])
const staffIdSearchParam = ref<string>('')
function focusStaffIdInput() {
  staffs.value = activeStaffs.value.filter(staff => {
    return (
      staffIdSearchParam.value &&
      staff.staffIdSearchParam?.toString().includes(staffIdSearchParam.value)
    )
  })
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

const rules = {
  isTel: (v: string) => !v || isDashNumber(v) || '電話番号を入力してください',
  isRequired: (v: string) => isNotEmpty(v) || 'Not entered.'
}

const hasFinishedBooking = computed<boolean>(() =>
  selectedBookingDetails.value.some(({ startDatetime }) =>
    isBefore(new Date(startDatetime), currentDate)
  )
)

const isDisableButton = computed<boolean>(
  () =>
    booking.status === bookingStatuses.canceled.value &&
    booking.status === selectedBookingDetails.value[0].status
)

function hasCancellationFee() {
  const noCancellationFeeStatuses: number[] = [
    bookingStatuses.temporary.value,
    bookingStatuses.waitingCancel.value
  ]
  const selectedBookingsWithCancelType = selectedBookingDetails.value.filter(
    ({ status, cancelType }) =>
      !!cancelType && !noCancellationFeeStatuses.includes(status)
  )
  if (!selectedBookingsWithCancelType.length) {
    return false
  }

  return selectedBookingsWithCancelType.some(booking => {
    const startDate = startOfDay(new Date(booking.startDatetime))
    const diffDays = differenceInDays(startDate, currentDate)
    return (
      diffDays <= 0 ||
      isExceedDayLimit(diffDays, {
        cancelType: booking.cancelType,
        cancellationFeeDays: booking.cancellationFeeDays
      })
    )
  })
}
function isExceedDayLimit(
  diffDays: number,
  {
    cancelType,
    cancellationFeeDays
  }: { cancelType: number; cancellationFeeDays: number }
) {
  const cancelDayLimitKeys = Object.keys(cancelDayLimit)
  const dayLimit: { [key: number]: number } = cancelDayLimitKeys.reduce(
    (dayLimit, key) => {
      return {
        ...dayLimit,
        // @ts-ignore
        [cancelTypes[key].value]: cancelDayLimit[key]
      }
    },
    { [cancelTypes.others.value]: cancellationFeeDays }
  )
  return dayLimit[cancelType] >= diffDays
}

function formatStatusPayload(booking: BookingStatusesEditPayload) {
  let payloadKeys = ['status']
  switch (booking.status) {
    case bookingStatuses.official.value:
    case bookingStatuses.checkIn.value:
      break
    case bookingStatuses.temporary.value:
      payloadKeys = [...payloadKeys, 'scheduledReplyDate']
      break
    case bookingStatuses.canceled.value:
      payloadKeys = [
        ...payloadKeys,
        'cancelRequesterName',
        'cancelRequesterTel',
        'cancelStaffId'
      ]
      break
  }
  return pick(payloadKeys, {
    ...booking,
    ...(booking.cancelStaffId && {
      cancelStaffId: Number(booking.cancelStaffId)
    })
  })
}
async function updateBookingStatus() {
  const { valid } = await formRef.value.validate()
  if (!valid) {
    return
  }

  if (
    booking.status === bookingStatuses.canceled.value &&
    hasCancellationFee() &&
    !confirm('キャンセル料が発生する予約です。キャンセルしてもよろしいですか？')
  ) {
    return
  }

  await bookingDetailStore.updateBookingStatuses(
    selectedBookingDetailIds.value,
    formatStatusPayload(booking) as BookingStatusesEditPayload
  )
  await bookingDetailStore.fetchBookingDetails({
    ...bookingDetailSearchParams.value,
    bookingId
  })
  closeDialog()
}
</script>

<template>
  <div class="dialog-status-edit">
    <h3 class="title">予約状況変更</h3>
    <v-form ref="formRef" validate-on="blur" class="form">
      <div class="field -status">
        <v-select
          v-model="booking.status"
          class="input"
          item-title="label"
          item-value="value"
          :items="statusOptions"
          :hide-details="false"
        >
          <template #item="{ item, props }">
            <v-list-item
              v-bind="props"
              :title="item.title"
              :disabled="
                item.value === bookingStatuses.canceled.value &&
                hasFinishedBooking
              "
            />
          </template>
          <template #append>
            <span class="append">に変更する</span>
          </template>
        </v-select>
      </div>
      <div
        v-if="
          booking.status === bookingStatuses.temporary.value &&
          selectedBookingDetails[0].status !== bookingStatuses.temporary.value
        "
        class="field -date"
      >
        <label class="label">仮予約回答日</label>
        <doka-date-picker v-model="booking.scheduledReplyDate" class="input" />
      </div>
      <template
        v-if="
          booking.status === bookingStatuses.canceled.value &&
          selectedBookingDetails[0].status !== bookingStatuses.canceled.value
        "
      >
        <div class="field -cancel-requester-name">
          <label class="label">
            キャンセル依頼者
            <doka-required-label />
          </label>
          <v-text-field
            v-model.trim="booking.cancelRequesterName"
            class="input"
            :rules="[rules.isRequired]"
            :hide-details="false"
          />
        </div>
        <div class="field -cancel-requester-tel">
          <label class="label">
            キャンセル連絡先
            <doka-required-label />
          </label>
          <v-text-field
            v-model.trim="booking.cancelRequesterTel"
            class="input"
            :hide-details="false"
            :rules="[rules.isRequired, rules.isTel]"
          />
        </div>
        <div class="field -cancel-staff-id">
          <label class="label">
            キャンセル担当者
            <doka-required-label />
          </label>
          <v-autocomplete
            ref="staffIdFormRef"
            v-model="cancelStaffName"
            v-model:search="staffIdSearchParam"
            class="input"
            item-value="id"
            item-title="staffIdSearchParam"
            variant="outlined"
            :items="staffs"
            :menu-icon="false"
            :rules="[rules.isRequired]"
            @update:search="focusStaffIdInput"
          >
            <template #item="{ item: staff }">
              <template v-if="staffIdSearchParam">
                <p
                  :class="[
                    'option',
                    { '-active': staff.raw.id === booking.cancelStaffId }
                  ]"
                  @click="selectStaff(staff.raw)"
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
              <p v-show="staffIdSearchParam" class="nodata">
                {{ generateMessageStaff }}
              </p>
            </template>
          </v-autocomplete>
        </div>
      </template>
    </v-form>
    <div class="actions">
      <v-btn
        variant="plain"
        size="large"
        color="text-placeholder"
        class="button -close"
        @click="closeDialog"
      >
        キャンセル
      </v-btn>
      <v-btn
        size="large"
        class="button -submit"
        :loading="isLoadings.updateStatus"
        :disabled="isDisableButton"
        @click="updateBookingStatus"
      >
        更新
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dialog-status-edit {
  min-width: 450px;
  > .title {
    font-size: 16px;
    line-height: 1;
  }
  > .form {
    margin: 20px 0;
  }
  > .form > .field {
    &.-status > .input,
    &.-date > .input {
      grid-template-columns: max-content 180px max-content;
    }
    &:not(:last-child) {
      margin-bottom: 5px;
    }
  }
  > .form > .field > .label {
    display: block;
    margin-bottom: 4px;
    font-weight: 700;
  }
  > .actions {
    display: flex;
    justify-content: flex-end;
    column-gap: 8px;
  }
  > .actions > .button.-close {
    font-weight: 400;
  }
}
</style>
