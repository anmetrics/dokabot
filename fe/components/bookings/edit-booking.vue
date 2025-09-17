<script lang="ts" setup>
// import pick from 'lodash/fp/pick'
import { VNodeRef } from 'vue'
import { BookingEditBookingPayloadSchema } from '~/store/booking'
import { Staff } from '~/store/staff'

const route = useRoute()
const bookingId = Number(route.params.bookingId)

const bookingDetailStore = useBookingDetailStore()
const { booking: bookingInfo, isLoadings } = storeToRefs(bookingDetailStore)

const staffStore = useStaffStore()
const { staffs: staffList } = storeToRefs(staffStore)

const staffIdFormRef = ref<VNodeRef | null>(null)
const activeStaffs = ref<Staff[]>(staffList.value.filter(({ isEnabled }: Staff) => isEnabled))
const staffs = ref<Staff[]>(activeStaffs.value)
const staffIdSearchParam = ref<string>('')
function selectStaff (staffId: number) {
  booking.updatedStaffId.value.value = staffId
  staffIdFormRef.value.$el.querySelector('input').blur()
}

const generateMessageStaff = computed<string>(() => {
  const disabledStaff = staffList.value.find(
    (staff: Staff) =>
      !staff.isEnabled && Number(staffIdSearchParam.value) === staff.id
  )
  return disabledStaff
    ? '無効な担当者が設定されています。'
    : '該当する情報が見つかりません'
})

function focusStaffIdInput () {
  staffs.value = activeStaffs.value.filter((staff) => {
    return (
      staffIdSearchParam.value &&
      staff.id?.toString().includes(staffIdSearchParam.value)
    )
  })
  if (staffIdSearchParam.value) {
    const staff = activeStaffs.value.find(staff => staff.id === Number(staffIdSearchParam.value))
    booking.updatedStaffId.value.value = staff && staff?.id
  }
}

const { handleSubmit } = useForm({ validationSchema: toTypedSchema(BookingEditBookingPayloadSchema) })
const fieldSettings: any = {
  customerFax: { initialValue: bookingInfo.value.customerFax },
  customerName: { initialValue: bookingInfo.value.customerName },
  customerRepName: { initialValue: bookingInfo.value.customerRepName },
  customerTel: { initialValue: bookingInfo.value.customerTel },
  note: { initialValue: bookingInfo.value.note },
  updatedStaffId: { initialValue: bookingInfo.value.updatedStaffId }
}
const booking = generateModel(fieldSettings)
const updateBooking = handleSubmit(async (booking) => {
  await bookingDetailStore.updateBooking(bookingId, booking)
})
</script>

<template>
  <v-form class="edit-booking-form">
    <v-text-field
      v-model.trim="booking.customerName.value.value"
      class="input -customer-name"
      :hide-details="false"
    >
      <template #prepend>
        <strong class="label">会社名</strong>
      </template>
    </v-text-field>
    <v-text-field
      v-model.trim="booking.customerRepName.value.value"
      class="input -customer-rep-name"
      :hide-details="false"
    >
      <template #prepend>
        <strong class="label">予約者</strong>
      </template>
    </v-text-field>
    <v-text-field
      v-model.trim="booking.customerTel.value.value"
      class="input -tel"
      :hide-details="false"
      :error-messages="booking.customerTel.errorMessage.value"
      @blur="booking.customerTel.validate"
    >
      <template #prepend>
        <strong class="label">電話番号</strong>
      </template>
    </v-text-field>
    <v-text-field
      v-model.trim="booking.customerFax.value.value"
      class="input -fax"
      :hide-details="false"
      :error-messages="booking.customerFax.errorMessage.value"
      @blur="booking.customerFax.validate"
    >
      <template #prepend>
        <strong class="label">FAX番号</strong>
      </template>
    </v-text-field>
    <v-textarea
      v-model.trim="booking.note.value.value"
      class="input -note"
      rows="2"
      no-resize
      :hide-details="false"
      :error-messages="booking.note.errorMessage.value"
      @blur="booking.note.validate"
    >
      <template #prepend>
        <strong class="label">備考</strong>
      </template>
    </v-textarea>
    <div class="group">
      <v-autocomplete
        ref="staffIdFormRef"
        v-model="booking.updatedStaffId.value.value"
        v-model:search="staffIdSearchParam"
        class="input"
        item-value="id"
        item-title="id"
        variant="outlined"
        :items="staffs"
        :menu-icon="false"
        :hide-details="false"
        :error-messages="booking.updatedStaffId.errorMessage.value"
        @blur="booking.updatedStaffId.validate"
        @update:search="focusStaffIdInput"
      >
        <template #prepend>
          <strong class="label">担当者番号</strong>
        </template>
        <template #item="{ item: staff }">
          <template v-if="staffIdSearchParam">
            <p
              :class="[
                'option',
                { '-active': staff.raw.id === booking.updatedStaffId.value.value }
              ]"
              @click="selectStaff(staff.raw.id)"
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
      <v-btn class="button" :loading="isLoadings.update" @click="updateBooking">
        保存
      </v-btn>
    </div>
  </v-form>
</template>

<style scoped lang="scss">
.edit-booking-form {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  grid-template-rows: 1fr 80px;
  gap: 5px 30px;
  > .input {
    &.-customer-name {
      grid-column: 1 / 3;
    }
    &.-customer-rep-name {
      grid-column: 3 / 5;
    }
    &.-note {
      grid-column: 1 / 5;
    }
    &:deep(.v-input__prepend),
    &:deep(.v-input__prepend) {
      min-width: 60px;
    }
  }
  > .group {
    display: flex;
    gap: 16px;
    grid-column: 5 / 7;
    align-self: end;
  }
  > .group > .input,
  > .input {
    > :deep(.v-input__details) {
      width: max-content;
      white-space: nowrap;
    }
  }
}
</style>
