<script lang="ts" setup>
import { VNodeRef } from 'vue'
import { startOfDay, differenceInDays } from 'date-fns'
import { cancelTypes, bookingStatuses } from '~/store/booking'
import { Staff } from '~/store/staff'

const bookingFormStore = useBookingFormStore()
const {
  modifiedBookingDetail,
  summaryBookingDetail,
  staffs: allStaffs,
  cancelInfo
} = storeToRefs(bookingFormStore)
const bookingScheduleStore = useBookingScheduleStore()
const dialogStore = useDialogStore()

const cancelFormRef = ref<VNodeRef | null>(null)
const hasCancelFee = computed<Boolean>(() => {
  const { cancelType, startTime, date, status } = modifiedBookingDetail.value

  const startDatetime = new Date(`${date} ${startTime}`)
  if (
    !cancelType ||
    [
      bookingStatuses.temporary.value,
      bookingStatuses.waitingCancel.value
    ].includes(status)
  ) {
    return false
  }
  const currentDate = startOfDay(new Date())
  const startDate = startOfDay(startDatetime)
  const diffDays = differenceInDays(startDate, currentDate)

  if (diffDays <= 0 || isExceedDayLimit(diffDays, cancelType)) {
    return true
  }

  return false
})
const isExceedDayLimit = (diffDays: number, cancelType: number) => {
  const cancelDayLimitKeys = Object.keys(cancelDayLimit)
  const dayLimit = cancelDayLimitKeys.reduce(
    (dayLimit, key) => {
      return {
        ...dayLimit,
        // @ts-ignore
        [cancelTypes[key].value]: cancelDayLimit[key]
      }
    },
    {
      [cancelTypes.others.value]:
        modifiedBookingDetail.value.cancellationFeeDays
    }
  ) as { [key: number]: number }
  return dayLimit[cancelType] >= diffDays
}
const confirmCancelBookingDetail = async () => {
  const { valid } = await cancelFormRef.value.validate()
  if (valid) {
    if (
      !hasCancelFee.value ||
      confirm(
        'キャンセル料が発生する予約です。キャンセルしてもよろしいですか？'
      )
    ) {
      return await cancelBookingDetail()
    }
    closeBookingCancelDialog()
  }
}

const staffStore = allStaffs.value.map((staff) => {
  return {
    ...staff,
    staffIdSearchParam: `${staff.id} ${staff.name}`
  }
})

const staffIdSearchParam = ref<string>()
const staffIdFormRef = ref<VNodeRef | null>(null)
const activeStaffs = staffStore.filter(({ isEnabled }: Staff) => isEnabled)
const staffs = ref<Staff[]>(activeStaffs)

function searchStaff () {
  staffs.value = activeStaffs.filter(
    (staff: Staff & { staffIdSearchParam: string }) => {
      return (
        (staffIdSearchParam.value &&
          staff.staffIdSearchParam.includes(staffIdSearchParam.value)) ||
        staff.staffIdSearchParam === staffIdSearchParam.value
      )
    }
  )
}
async function focusStaffInput () {
  staffIdSearchParam.value = cancelInfo.value.cancelStaffName
  staffs.value = activeStaffs.filter(
    (staff: Staff & { staffIdSearchParam: string }) => {
      return (
        cancelInfo.value.cancelStaffName &&
        (staff.staffIdSearchParam.includes(
          String(cancelInfo.value.cancelStaffName)
        ) ||
          cancelInfo.value.cancelStaffName === staff.staffIdSearchParam)
      )
    }
  )
  await nextTick()
}
function blurStaffInput () {
  const matchedStaff = activeStaffs.find(
    (staff: Staff & { staffIdSearchParam: string }) =>
      (staffIdSearchParam.value &&
        staff.staffIdSearchParam.includes(staffIdSearchParam.value)) ||
      staff.staffIdSearchParam === staffIdSearchParam.value
  )

  cancelInfo.value.cancelStaffId = matchedStaff?.id
  cancelInfo.value.cancelStaffName = matchedStaff?.staffIdSearchParam
}
async function selectStaff (staff: Staff & { staffIdSearchParam: string }) {
  staffIdFormRef.value.$el.querySelector('input').blur()
  await nextTick()
  cancelInfo.value.cancelStaffId = staff.id
  cancelInfo.value.cancelStaffName = staff.staffIdSearchParam
}

const generateMessageStaff = computed<string>(() => {
  const disabledStaff = staffStore.find(
    (staff: Staff) =>
      !staff.isEnabled && Number(staffIdSearchParam.value) === staff.id
  )
  return disabledStaff
    ? '無効な担当者が設定されています。'
    : '該当する情報が見つかりません'
})

const cancelBookingDetail = async () => {
  await bookingFormStore.cancelBookingDetail()
  bookingFormStore.clearBookingData()
  closeBookingCancelDialog()
  await bookingScheduleStore.fetchSchedules()
}
const closeBookingCancelDialog = () => {
  cancelInfo.value = {}
  if (summaryBookingDetail.value.status === bookingStatuses.canceled.value) {
    summaryBookingDetail.value.status = modifiedBookingDetail.value.status
  }
  dialogStore.closeDialog()
}
</script>

<template>
  <div class="booking-cancel">
    <h3 class="title">
      予約のキャンセル に変更
    </h3>
    <v-form ref="cancelFormRef" class="cancel-form">
      <div class="row">
        <label class="label">
          キャンセル依頼者
          <doka-required-label />
        </label>
        <v-text-field
          v-model="cancelInfo.cancelRequesterName"
          :rules="[bookingRules.isRequired]"
          hide-details
          class="input"
        />
      </div>
      <div class="row">
        <label class="label">
          キャンセル連絡先
          <doka-required-label />
        </label>
        <v-text-field
          v-model="cancelInfo.cancelRequesterTel"
          :rules="[bookingRules.isRequired, bookingRules.isDashNumber]"
          hide-details
          class="input"
        />
      </div>
      <div class="row">
        <label class="label">
          キャンセル担当者
          <doka-required-label />
        </label>
        <v-autocomplete
          ref="staffIdFormRef"
          v-model="cancelInfo.cancelStaffName"
          v-model:search="staffIdSearchParam"
          :items="staffs"
          :rules="[bookingRules.isRequired]"
          :menu-icon="false"
          class="input -small"
          item-value="id"
          item-title="staffIdSearchParam"
          variant="outlined"
          hide-details
          @focus="focusStaffInput"
          @update:search="searchStaff"
          @blur="blurStaffInput"
        >
          <template #item="{ item: staff }">
            <template v-if="staffIdSearchParam">
              <p
                class="option"
                :class="{
                  '-active': staff.raw.id === cancelInfo.cancelStaffId,
                }"
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
            <p v-if="staffIdSearchParam" class="nodata">
              {{ generateMessageStaff }}
            </p>
          </template>
        </v-autocomplete>
      </div>
    </v-form>
    <div class="action">
      <v-btn
        class="button -close"
        variant="text"
        size="large"
        color="text-placeholder"
        @click="closeBookingCancelDialog"
      >
        キャンセル
      </v-btn>
      <v-btn class="button" size="large" @click="confirmCancelBookingDetail">
        確定
      </v-btn>
    </div>
  </div>
</template>
<style lang="scss" scoped>
.booking-cancel {
  min-width: 350px;
  > .title {
    font-size: 16px;
    margin-bottom: 24px;
  }
  > .action {
    display: flex;
    justify-content: flex-end;
    column-gap: 8px;
    margin-top: 20px;
  }
  > .action > .button.-close {
    font-weight: 400;
  }
}
.cancel-form {
  > .row {
    margin-bottom: 20px;
  }
  > .row > .label {
    font-weight: bold;
  }
  > .row > .input {
    margin-top: 5px;
    &.-small {
      min-width: 120px;
      width: max-content;
    }
  }
}
</style>
