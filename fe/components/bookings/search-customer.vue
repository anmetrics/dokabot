<script setup lang="ts">
import { VNodeRef } from 'vue'
import { CustomeSearchParams } from '~/store/booking'
const headers = [
  { title: '', key: 'actions', align: 'start', sortable: false, width: '60' },
  { title: '顧客名', key: 'name', align: 'start' },
  { title: '電話番号', key: 'tel', align: 'start' }
]
const bookingStore = useBookingFormStore()
const snackbarStore = useSnackbarStore()
const { matchedCustomers, totalMatchedCustomers, booking } =
  storeToRefs(bookingStore)
const initCustomeSearchrParams: CustomeSearchParams = {
  page: 1,
  limit: 10
}
const isLoadingCustomer = ref<boolean>(false)
const isFirstLoadedCustomer = ref<boolean>(false)
const customeSearchrParams = ref<CustomeSearchParams>(initCustomeSearchrParams)
const currentSearchParams = ref<CustomeSearchParams>(initCustomeSearchrParams)
const selectedCustomerId = ref<number | null>(null)
const formRef = ref<VNodeRef | null>(null)

async function handleSearchCustomer () {
  currentSearchParams.value = { ...customeSearchrParams.value }
  await searchCustomers(true)
}

async function searchCustomers (resetPage?: boolean) {
  if (resetPage) {
    const { valid } = await formRef.value.validate()
    if (!valid) {
      return
    }
    isLoadingCustomer.value = true
    customeSearchrParams.value.page = 1
  }
  const searchParams = {
    ...currentSearchParams.value,
    page: customeSearchrParams.value.page
  }

  await bookingStore.getCustomers(searchParams)
  selectedCustomerId.value = null
  isLoadingCustomer.value = false
}
function fillBookingCustomer () {
  const customer = matchedCustomers.value.find(
    customer => customer.id === selectedCustomerId.value
  )
  booking.value.customerId = selectedCustomerId.value!
  bookingStore.fillBookingCustomer(customer!)
  snackbarStore.showSnackbar({
    message: '顧客情報を設定しました',
    type: SnackbarTypes.success
  })
  closeDialog()
}
function selectCustomer (_: Event, payload: any) {
  const { item } = payload
  selectedCustomerId.value = item.raw.id
}
const dialogStore = useDialogStore()
function closeDialog () {
  dialogStore.closeDialog()
  customeSearchrParams.value = initCustomeSearchrParams
}
onMounted(async () => {
  isLoadingCustomer.value = true
  await searchCustomers()
  isFirstLoadedCustomer.value = true
})
</script>

<template>
  <div class="search-wrapper">
    <div class="header">
      <h2 class="title">
        顧客検索
      </h2>
      <nuxt-link class="link" to="/customers/create" @click="closeDialog">
        顧客を新しく登録する
        <v-icon icon="mdi-chevron-right" />
      </nuxt-link>
    </div>
    <v-form ref="formRef" class="searcharea">
      <v-text-field
        v-model="customeSearchrParams.customerName"
        class="input"
        label="会社名"
        hide-details
      />
      <v-text-field
        v-model="customeSearchrParams.tel"
        :rules="[bookingRules.isDashNumber]"
        class="input -small"
        label="電話番号"
        hide-details
      />
      <v-btn
        height="30"
        :loading="isLoadingCustomer"
        @click="handleSearchCustomer"
      >
        検索
      </v-btn>
    </v-form>
    <div class="content">
      <template v-if="matchedCustomers.length">
        <div class="pagination">
          <doka-pagination
            v-model="customeSearchrParams.page"
            :items-per-page="customeSearchrParams.limit!"
            :total="totalMatchedCustomers"
            @prev="searchCustomers()"
            @next="searchCustomers()"
          />
        </div>
        <v-radio-group v-model="selectedCustomerId">
          <v-data-table
            :headers="headers"
            :items="matchedCustomers"
            :items-per-page="customeSearchrParams.limit"
            class="customer-table"
            @click:row="selectCustomer"
          >
            <template #[`item.name`]="{ item }">
              <p class="namekana">
                {{ item.raw.nameKana }}
              </p>
              <p class="name">
                {{ item.raw.name }}
              </p>
            </template>
            <template #[`item.actions`]="{ item }">
              <v-radio :value="item.raw.id" />
            </template>
            <template #bottom />
          </v-data-table>
        </v-radio-group>
      </template>
      <template v-else-if="isFirstLoadedCustomer">
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
      <v-btn
        :disabled="!selectedCustomerId"
        class="button"
        @click="fillBookingCustomer"
      >
        設定
      </v-btn>
    </div>
  </div>
</template>

<style scoped lang="scss">
.search-wrapper {
  min-width: 500px;
  > .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    > .title {
      padding: 0;
    }
    > .link {
      display: flex;
      align-items: center;
      font-weight: bold;
      color: rgb(var(--v-theme-primary));
    }
  }
  > .searcharea {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 15px 0;
    > .input {
      flex: 0 1 180px;
      &.-small {
        flex: 0 1 120px;
      }
    }
  }
  > .content > .nodata {
    width: 100%;
    text-align: center;
    margin-top: 2em;
  }
  > .content > .pagination {
    display: flex;
    justify-content: flex-end;
  }
  > .footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    &:deep(.v-btn__content) {
      font-weight: normal;
    }
  }
}
.customer-table {
  &:deep(.v-data-table__td):first-child {
    padding: 0;
  }
  &:deep(.v-data-table__td):nth-child(2) {
    padding-left: 0;
  }
  &:deep(.namekana) {
    font-size: 0.9em;
    color: rgb(var(--v-theme-text-placeholder));
  }
  &:deep(.v-data-table__tr):hover > .v-data-table__td {
    background-color: rgb(var(--v-theme-primary-light));
  }
}
</style>
