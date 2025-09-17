<script lang="ts" setup>
const dialogStore = useDialogStore()
const holidayStore = useHolidayStore()
const { holidays, isLoading } = storeToRefs(holidayStore)
const selectedHoliday = ref<string>('')
await holidayStore.fetchHolidays()
const futureHolidays = ref([...holidays.value])
const rules = {
  isDuplicate: (value: string) =>
    !hasDuplicate(value) || 'すでに登録済みの休業日です。'
}
function closedDayCreateDialog () {
  dialogStore.closeDialog()
}
function addHoliday () {
  if (selectedHoliday.value && !hasDuplicate(selectedHoliday.value)) {
    futureHolidays.value = [
      { date: selectedHoliday.value },
      ...futureHolidays.value
    ]
    selectedHoliday.value = ''
  }
}
function hasDuplicate (date: string) {
  return !!futureHolidays.value.find(holiday => holiday.date === date)
}
function dropHoliday (date: string) {
  futureHolidays.value = [
    ...futureHolidays.value.filter(holiday => holiday.date !== date)
  ]
}
async function updateHolidays () {
  const acceptedHolidays = futureHolidays.value.filter(
    holiday => !holiday.id
  )
  if (acceptedHolidays.length) {
    await holidayStore.createHolidays(acceptedHolidays)
  }
  const deletedHolidayIds = holidays.value
    .filter((holiday) => {
      return futureHolidays.value.every(
        stagingHoliday => stagingHoliday.date !== holiday.date
      )
    })
    .map(({ id }) => Number(id))
  if (deletedHolidayIds.length) {
    await holidayStore.deleteHolidays(deletedHolidayIds)
  }
  await holidayStore.fetchHolidays()
  dialogStore.closeDialog()
}
</script>

<template>
  <div class="dialog-closeddays-create">
    <h3 class="title">
      休業日登録
    </h3>
    <div class="actions">
      <doka-date-picker
        v-model="selectedHoliday"
        class="input -date"
        placeholder="休業日"
        :label="selectedHoliday && '休業日'"
        :hide-details="false"
        :rules="[rules.isDuplicate]"
      />
      <v-btn
        class="button -add"
        variant="outlined"
        size="small"
        color="primary"
        @click="addHoliday"
      >
        追加
      </v-btn>
    </div>
    <div v-if="futureHolidays.length" class="list">
      <div v-for="holiday in futureHolidays" :key="holiday.id" class="row">
        <p class="date">
          {{ formatDayJp(holiday.date) }}
        </p>
        <v-btn
          class="drop"
          color="error"
          variant="plain"
          @click="dropHoliday(holiday.date)"
        >
          削除
        </v-btn>
      </div>
    </div>
    <p v-else class="notice">
      該当する情報が見つかりません
    </p>
    <div class="action">
      <v-btn
        class="button -close"
        variant="text"
        size="large"
        color="text-placeholder"
        @click="closedDayCreateDialog"
      >
        キャンセル
      </v-btn>
      <v-btn
        class="button"
        size="large"
        :loading="isLoading"
        @click="updateHolidays"
      >
        休業日を更新
      </v-btn>
    </div>
  </div>
</template>
<style lang="scss" scoped>
.dialog-closeddays-create {
  min-width: 440px;
  > .title {
    font-size: 16px;
  }
  > .actions {
    display: flex;
    align-items: flex-start;
    margin-top: 20px;
    width: 250px;
    gap: 12px;
  }
  > .actions > .input {
    &.-date {
      min-width: 180px;
    }
  }
  > .actions
    > .input
    > :deep(.v-input__control)
    > .v-field
    > .v-field__field
    > .v-field__input {
    padding: 0 8px;
  }
  > .actions
    > .input
    > :deep(.v-input__details)
    > .v-messages
    > .v-messages__message {
    font-size: 10px;
    line-height: 10px;
  }
  > .actions > .button.-add {
    margin-top: 1px;
    font-weight: 500;
  }
  > .list {
    margin-top: 5px;
    max-height: calc(100vh - 390px);
    overflow-y: auto;
  }
  > .list > .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 40px;
    padding: 0 4px;
    border: 1px solid rgb(var(--v-theme-border));
  }
  > .list > .row + .row {
    margin-top: 8px;
  }
  > .list > .row > .date {
    margin-left: 8px;
  }
  > .notice {
    text-align: center;
    margin: 30px 0;
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
</style>
