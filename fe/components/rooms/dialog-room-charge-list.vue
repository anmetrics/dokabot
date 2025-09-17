<script lang="ts" setup>
const headers = [
  { title: '料金の有効期間', key: 'validityPeriod', width: '45%' },
  { title: '料金', key: 'price' },
  { title: '', key: 'actions', sortable: false, align: 'end', width: 100 }
]
const route = useRoute()
const roomId = Number(route.params.roomId)
const { closeDialog } = useDialogStore()
const roomChargeDeleteStore = useRoomChargeDeleteStore()
const { isLoading } = storeToRefs(roomChargeDeleteStore)
const roomChargeStore = useRoomChargeStore()
const { roomCharges, itemsPerPage } = storeToRefs(roomChargeStore)

async function deleteRoomCharge (roomChargeId: number) {
  await roomChargeDeleteStore.deleteRoomCharge(roomChargeId)
  await roomChargeStore.fetchRoomCharges(roomId)
  if (!roomCharges.value?.length) {
    closeDialog()
  }
}
</script>

<template>
  <div class="dialog-room-charge-list">
    <h3 class="title">
      料金の変更予約を確認
    </h3>
    <v-data-table
      class="table-room-charges"
      :headers="headers"
      :items="roomCharges"
      :items-per-page="itemsPerPage"
    >
      <template #[`item.validityPeriod`]="{ item }">
        {{ formatDateTime(new Date(item.raw.startDate), 'yyyy年M月d日') }} 〜
        {{
          item.raw.endDate
            ? formatDateTime(new Date(item.raw.endDate), 'yyyy年M月d日')
            : '&nbsp;-'
        }}
      </template>
      <template #[`item.price`]="{ item }">
        <ul class="prices">
          <li class="price">
            <label class="label"> 2時間迄 </label>
            {{ formatPrice(item.raw.basicPrice) }}円/1時間（税抜）
          </li>
          <li class="price">
            <label class="label"> 2時間超 </label>
            {{ formatPrice(item.raw.extensionPrice) }}円/1時間（税抜）
          </li>
          <li class="price">
            <label class="label"> 全日料金 </label>
            {{ formatPrice(item.raw.allDayPrice) }}円（税抜）
          </li>
          <li class="price">
            <label class="label"> 小計区分 </label>
            {{ subtotalTypes.labelOf(item.raw.subtotalType) }}
          </li>
        </ul>
      </template>
      <template #[`item.actions`]="{ item }">
        <v-btn
          variant="plain"
          color="error"
          :disabled="isLoading"
          @click="deleteRoomCharge(item.raw.id)"
        >
          削除
        </v-btn>
      </template>
      <template #bottom />
    </v-data-table>
    <v-btn
      variant="plain"
      color="text-placeholder"
      class="button -close"
      @click="closeDialog"
    >
      閉じる
    </v-btn>
  </div>
</template>

<style scoped lang="scss">
.dialog-room-charge-list {
  min-width: 580px;
  > .title {
    margin-bottom: 20px;
    font-size: 16px;
    line-height: 1;
  }
  > .button {
    display: block;
    margin: 0 auto;
    font-weight: 400;
  }
}
.table-room-charges {
  max-height: calc(100vh - 410px);
  margin-top: 20px;
  margin-bottom: 20px;
  > :deep(.v-table__wrapper) {
    padding-bottom: 0;
    border-radius: unset;
  }
  > :deep(.v-table__wrapper) > table {
    > thead > tr > th {
      height: 40px;
    }
    > thead > tr > th,
    > tbody > tr > td {
      padding: 0;
    }
    > tbody > tr > td > .prices {
      padding: 15px 0;
    }
    > tbody > tr > td > .prices > .price {
      display: flex;
      align-items: center;
    }
    > tbody > tr > td > .prices > .price > .label {
      display: inline-block;
      min-width: 65px;
      color: rgb(var(--v-theme-text-placeholder));
    }
  }
}
</style>
