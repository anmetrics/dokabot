<script lang="ts" setup>
import { toTypedSchema } from '@vee-validate/zod'
import { RoomChargeCreateSchema } from '~/store/room-charge'

const route = useRoute()
const roomId = Number(route.params.roomId)
const { fetchRoom } = useRoomEditStore()
const { closeDialog } = useDialogStore()
const roomChargeCreateStore = useRoomChargeCreateStore()
const { isLoading } = storeToRefs(roomChargeCreateStore)

const { handleSubmit } = useForm({
  validationSchema: toTypedSchema(RoomChargeCreateSchema)
})
const fieldSettings: any = {
  roomId: { initialValue: roomId },
  basicPrice: { initialValue: '' },
  allDayPrice: { initialValue: '' },
  extensionPrice: { initialValue: '' },
  subtotalType: { initialValue: subtotalTypes.consumptionTax.value },
  startDate: { initialValue: '', validateOnValueUpdate: true }
}
const roomCharge = generateModel(fieldSettings)

const createRoomCharge = handleSubmit(async (roomCharge) => {
  await roomChargeCreateStore.createRoomCharge(roomCharge)
  await fetchRoom(roomId)
  closeDialog()
})
</script>

<template>
  <div class="dialog-room-charge-create">
    <h3 class="title">
      料金の変更予約
    </h3>
    <v-form class="form">
      <div class="field">
        <v-text-field
          v-model="roomCharge.basicPrice.value.value"
          class="input"
          :hide-details="false"
          :error-messages="roomCharge.basicPrice.errorMessage.value"
          @blur="roomCharge.basicPrice.validate"
        >
          <template #prepend>
            <strong class="label">
              2時間迄
              <doka-required-label />
            </strong>
          </template>
          <template #append>
            <span class="unit">円/1時間（税抜）</span>
          </template>
        </v-text-field>
      </div>
      <div class="field">
        <v-text-field
          v-model="roomCharge.extensionPrice.value.value"
          class="input"
          :hide-details="false"
          :error-messages="roomCharge.extensionPrice.errorMessage.value"
          @blur="roomCharge.extensionPrice.validate"
        >
          <template #prepend>
            <strong class="label">
              2時間超
              <doka-required-label />
            </strong>
          </template>
          <template #append>
            <span class="unit">円/1時間（税抜）</span>
          </template>
        </v-text-field>
      </div>
      <div class="field -all-day-price">
        <v-text-field
          v-model="roomCharge.allDayPrice.value.value"
          class="input"
          :hide-details="false"
          :error-messages="roomCharge.allDayPrice.errorMessage.value"
          @blur="roomCharge.allDayPrice.validate"
        >
          <template #prepend>
            <strong class="label">
              全日料金
              <doka-required-label />
            </strong>
          </template>
          <template #append>
            <span class="unit">円（税抜）</span>
          </template>
        </v-text-field>
      </div>
      <div class="field -sub-total-type">
        <v-radio-group
          v-model="roomCharge.subtotalType.value.value"
          inline
          density="comfortable"
          class="input -radio-group"
        >
          <template #prepend>
            <strong class="label">
              小計区分
              <doka-required-label />
            </strong>
          </template>
          <v-radio
            v-for="(option, index) in subtotalTypes.valueLabelList"
            :key="`subtotal-type-${index}`"
            class="radio"
            :label="option.label"
            :value="option.value"
            :hide-details="false"
          />
        </v-radio-group>
      </div>
      <div class="field -start-date">
        <strong class="label">
          変更開始日
          <doka-required-label />
        </strong>
        <doka-date-picker
          v-model="roomCharge.startDate.value.value"
          class="input -date"
          :hide-details="false"
          :error-messages="roomCharge.startDate.errorMessage.value"
        >
          <template #prepend>
            <label class="label">予約を取った日が</label>
          </template>
          <template #append>
            <span class="unit">から有効</span>
          </template>
        </doka-date-picker>
      </div>
    </v-form>
    <div class="actions">
      <v-btn
        variant="plain"
        size="large"
        color="text-placeholder"
        class="button -close"
        @click="closeDialog"
      >
        閉じる
      </v-btn>
      <v-btn
        size="large"
        class="button -submit"
        :loading="isLoading"
        @click="createRoomCharge"
      >
        料金の変更を予約
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dialog-room-charge-create {
  min-width: 500px;
  > .title {
    font-size: 16px;
    line-height: 1;
  }
  > .form {
    margin-top: 20px;
    margin-bottom: 5px;
  }
  > .form > .field {
    &:not(:last-child, .-all-day-price, .-sub-total-type) {
      margin-bottom: 5px;
    }
    &.-sub-total-type {
      margin-bottom: 15px;
    }
    &.-start-date {
      display: flex;
    }
    &.-start-date > .label {
      width: 150px;
      line-height: 30px;
    }
  }
  > .form > .field > .input {
    &.-radio-group > :deep(.v-input__prepend) {
      width: 134px;
    }
    &:not(.-radio-group) {
      grid-template-columns: 150px 120px max-content;
    }
    &:not(.-radio-group) > :deep(.v-input__details) {
      width: max-content;
    }
    &.-date {
      grid-template-columns: 115px 140px max-content;
    }
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
