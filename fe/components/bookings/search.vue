<script lang="ts" setup>
import { isAfter } from 'date-fns'
import { TemplateRef } from '~/store/app'
import {
  BookingActions,
  BookingActionKeys,
  BookingSearchParams
} from '~/store/booking'

const today: string = formatDateTime(new Date(), 'yyyy-MM-dd')
const bookingStatusOptions: Array<{ label: string; value: number }> = [
  { label: 'すべての項目', value: 0 },
  ...bookingStatuses.valueLabelList
]

const bookingStore = useBookingStore()
const { bookingSearchParams, isLoadings } = storeToRefs(bookingStore)

const formRef = ref<TemplateRef>(null)
const inputRefs = reactive<{
  startDate: TemplateRef;
  endDate: TemplateRef;
}>({ startDate: null, endDate: null })

const rules = {
  isNumeric: (v: string) => !v || isNumeric(v) || '数字でご入力ください。',
  isValidRangeDates: (fromDate: string, toDate: string) => {
    return (
      (!fromDate && !toDate) ||
      !isAfter(new Date(fromDate), new Date(toDate)) ||
      '日付範囲が無効です。'
    )
  }
}

function validateRelatedField (field: keyof typeof inputRefs) {
  const hasError = inputRefs[field]?.rules.some(
    (rule: Function | boolean | string) => typeof rule === 'string'
  )
  if (!hasError) {
    inputRefs[field].validate()
  }
}

async function searchBookings (action: BookingActions) {
  bookingSearchParams.value.page = 1
  const { search, fetchByToday, fetchByCanceledStatus } = BookingActions
  if (action === search) {
    const { valid } = await formRef.value.validate()
    if (valid) {
      await bookingStore.fetchBookings()
    }
    return
  }

  const params: BookingSearchParams = {
    page: 1,
    limit: 50,
    startDate: today,
    ...(action === fetchByToday
      ? { endDate: today }
      : action === fetchByCanceledStatus && {
        status: bookingStatuses.canceled.value
      })
  }
  await bookingStore.fetchBookings(params, action)
}

function isDisabledAction (action: BookingActionKeys) {
  return (
    !isLoadings.value[action] && Object.values(isLoadings.value).some(Boolean)
  )
}
</script>

<template>
  <div class="bookings-search">
    <v-form
      ref="formRef"
      validate-on="blur"
      class="form"
      @submit.prevent="searchBookings(BookingActions.search)"
    >
      <v-text-field
        v-model.trim="bookingSearchParams.bookingId"
        class="input -id"
        label="予約番号"
        variant="outlined"
        :hide-details="false"
        :rules="[rules.isNumeric]"
      />
      <div class="dates">
        <doka-date-picker
          v-model="bookingSearchParams.startDate"
          class="date -start-date"
          variant="outlined"
          placeholder="利用日"
          :label="bookingSearchParams.startDate && '利用日'"
          :get-ref="(el: TemplateRef) => (inputRefs.startDate = el)"
          :hide-details="false"
          :rules="[
            rules.isValidRangeDates(
              `${bookingSearchParams.startDate}`,
              `${bookingSearchParams.endDate}`
            ),
          ]"
          @blur="validateRelatedField('endDate')"
        >
          <template #append>
            〜
          </template>
        </doka-date-picker>
        <doka-date-picker
          v-model="bookingSearchParams.endDate"
          class="date -end-date"
          variant="outlined"
          placeholder="利用日"
          :label="bookingSearchParams.endDate && '利用日'"
          :get-ref="(el: TemplateRef) => (inputRefs.endDate = el)"
          :hide-details="false"
          :rules="[
            rules.isValidRangeDates(
              `${bookingSearchParams.startDate}`,
              `${bookingSearchParams.endDate}`
            ),
          ]"
          @blur="validateRelatedField('startDate')"
        />
      </div>
      <v-text-field
        v-model.trim="bookingSearchParams.customerName"
        class="input -name"
        label="顧客名"
        variant="outlined"
        :hide-details="false"
      />
      <v-select
        v-model="bookingSearchParams.status"
        class="input -status"
        item-title="label"
        item-value="value"
        label="予約状況"
        variant="outlined"
        :items="bookingStatusOptions"
        :hide-details="false"
      />
      <v-btn
        type="submit"
        :class="['button', { '-disabled': isDisabledAction('search') }]"
        :loading="isLoadings.search"
      >
        検索
      </v-btn>
    </v-form>
    <div class="actions">
      <v-btn
        class="button"
        variant="outlined"
        color="primary"
        :disabled="isDisabledAction('fetchByToday')"
        :loading="isLoadings.fetchByToday"
        @click="searchBookings(BookingActions.fetchByToday)"
      >
        今日の予約
      </v-btn>
      <v-btn
        class="button"
        variant="outlined"
        color="primary"
        :disabled="isDisabledAction('fetchByCanceledStatus')"
        :loading="isLoadings.fetchByCanceledStatus"
        @click="searchBookings(BookingActions.fetchByCanceledStatus)"
      >
        今日以降のキャンセル予約
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.bookings-search {
  display: flex;
  justify-content: space-between;
  column-gap: 15px;
  > .form {
    display: flex;
    column-gap: 10px;
    flex: 1;
    max-width: 72%;
    @include xl {
      max-width: 70%;
    }
  }
  > .form > .input {
    &.-id {
      flex: 16;
      @include xl {
        flex: 12;
      }
    }
    &.-name {
      flex: 16;
    }
    &.-status {
      flex: 15;
    }
  }
  > .form > .input > :deep(.v-input__details),
  > .form > .dates > .date > :deep(.v-input__details) {
    white-space: nowrap;
  }
  > .form > .dates {
    display: flex;
    flex: 32;
    column-gap: 5px;

    @include xl {
      flex: 30;
    }
  }
  > .form > .dates > .date {
    &.-start-date {
      width: calc(50% + 17px);
    }
    &.-start-date > :deep(.v-input__append) {
      margin-inline-start: 5px;
    }
    &.-end-date {
      width: 50%;
    }
  }
  > .form > .button.-disabled {
    pointer-events: none;
  }
  > .actions > .button:first-child {
    margin-right: 10px;
  }
}
</style>
