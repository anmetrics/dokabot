<script setup lang="ts">
import { VNodeRef } from 'vue'
import { ServiceSearchParams } from '~/store/booking'
const headers = [
  {
    title: '備品名',
    key: 'name',
    align: 'start'
  },
  {
    title: '最大利用可能数',
    key: 'stockAvailable',
    align: 'start'
  },
  {
    title: '利用数',
    key: 'usageCount',
    align: 'start',
    sortable: false
  }
]
const bookingServiceTypes = [
  { value: '', label: 'すべての科目' },
  ...serviceTypes.valueLabelList
]
const bookingServiceCategories = [
  { value: '', label: 'すべてのカテゴリ' },
  ...serviceCategories.valueLabelList
]
type FilterParams = {
  isUsed?: boolean;
  notUsed?: boolean;
};
const bookingStore = useBookingFormStore()
const snackbarStore = useSnackbarStore()
const {
  booking,
  summaryBookingDetail,
  matchedServices,
  bookingServices,
  services: allServices
} = storeToRefs(bookingStore)
const serviceFormRef = ref<VNodeRef | null>(null)
const usageCounts = ref<{ [key: number]: number }>(
  bookingServices.value.reduce((usageCounts, bookingService) => {
    return {
      ...usageCounts,
      [bookingService.serviceId]: bookingService.usageCount
    }
  }, {})
)
const initSearchParams = {
  customerId: booking.value.customerId,
  endDatetime: `${summaryBookingDetail.value.date} ${summaryBookingDetail.value.endTime}`,
  startDatetime: `${summaryBookingDetail.value.date} ${summaryBookingDetail.value.startTime}`,
  serviceType: '',
  currentBookingDetailId: summaryBookingDetail.value.id || '',
  itemType: ''
}
const searchParams = ref<ServiceSearchParams>(initSearchParams)
const unwatchSearchParams = watchEffect(async () => {
  await bookingStore.getServices(searchParams.value)
})
const filterParams = ref<FilterParams>({})
const filteredServices = computed(() => {
  if (
    (filterParams.value.isUsed && filterParams.value.notUsed) ||
    (!filterParams.value.isUsed && !filterParams.value.notUsed)
  ) {
    return matchedServices.value
  }
  const usedServiceIds = Object.keys(usageCounts.value).map(serviceId =>
    Number(serviceId)
  )
  return filterParams.value.isUsed
    ? matchedServices.value.filter(service =>
      usedServiceIds.includes(service.id)
    )
    : matchedServices.value.filter(
      service => !usedServiceIds.includes(service.id)
    )
})
function saveBookingService () {
  const bookingServices = Object.keys(usageCounts.value)
    .map((key: string) => {
      const serviceId = Number(key)
      return {
        serviceId,
        usageCount: Number(usageCounts.value[serviceId]),
        price: allServices.value.find(({ id }) => serviceId === id)!.unitPrice
      }
    })
    .filter(service => service.usageCount && service.usageCount > 0)
  bookingStore.fillBookingServices(bookingServices)
}
async function fillBookingServices () {
  await nextTick()
  const { valid } = !serviceFormRef.value
    ? { valid: true }
    : await serviceFormRef.value.validate()
  if (valid) {
    saveBookingService()
    snackbarStore.showSnackbar({
      message: '備品を追加しました。',
      type: SnackbarTypes.success
    })
    closeDialog()
  }
}
function clearServiceDialog () {
  unwatchSearchParams()
  usageCounts.value = {}
  filterParams.value = {}
  searchParams.value = {}
}
const dialogStore = useDialogStore()
function closeDialog () {
  dialogStore.closeDialog()
  clearServiceDialog()
}
</script>

<template>
  <div class="search-services">
    <h2 class="title">
      備品利用状況
    </h2>
    <p class="date">
      {{ formatDayJp(summaryBookingDetail.date!, { includeDayOfWeek: false }) }}
      {{ summaryBookingDetail.startTime }} ~ {{ summaryBookingDetail.endTime }}
    </p>
    <div class="filter-area">
      <v-select
        v-model="searchParams.serviceType"
        class="select"
        :items="bookingServiceTypes"
        label="商品科目"
        variant="outlined"
        item-title="label"
        item-value="value"
        hide-details
      />
      <v-select
        v-model="searchParams.itemType"
        class="select -category"
        :items="bookingServiceCategories"
        label="商品カテゴリ"
        variant="outlined"
        item-title="label"
        item-value="value"
        hide-details
      />
      <v-checkbox
        v-model="filterParams.isUsed"
        class="checkbox"
        label="利用数入力済"
        inline
      />
      <v-checkbox
        v-model="filterParams.notUsed"
        class="checkbox"
        label="利用数未入力"
        inline
      />
    </div>
    <div class="content-wrapper">
      <template v-if="filteredServices.length">
        <v-form ref="serviceFormRef" class="form">
          <v-data-table
            class="table"
            :headers="headers"
            :items="filteredServices"
            :items-per-page="filteredServices.length"
          >
            <template #[`item.usageCount`]="{ item }">
              <div class="usage-count">
                <v-text-field
                  v-model="usageCounts[item.raw.id]"
                  :max="item.raw.hasStockManagement && item.raw.stockAvailable"
                  min="0"
                  :rules="[
                    item.raw.hasStockManagement &&
                      bookingRules.max(item.raw.stockAvailable),
                    bookingRules.min(0),
                  ]"
                  type="number"
                  hide-details
                />
              </div>
            </template>
            <template #[`item.stockAvailable`]="{ item }">
              {{
                !item.raw.hasStockManagement
                  ? "無制限"
                  : item.raw.stockAvailable
              }}
            </template>
            <template #bottom />
          </v-data-table>
        </v-form>
      </template>
      <template v-else>
        <doka-empty-data message="当てはまる検索結果がありません" />
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
      <v-btn class="button" @click="fillBookingServices">
        備品を登録
      </v-btn>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-services {
  min-width: 550px;
  > .title {
    margin-bottom: 16px;
  }
  > .date {
    padding: 10px;
    margin-bottom: 20px;
    background-color: rgb(var(--v-theme-background));
  }
  > .footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    &:deep(.v-btn__content) {
      font-weight: normal;
    }
  }
  > .footer > .button {
    margin-top: 20px;
  }
}
.content-wrapper {
  > .form > .table {
    max-height: calc(100vh - 330px);
    overflow-y: scroll;
  }
  > .form:deep(.usage-count) {
    height: 40px;
    display: flex;
    align-items: center;
  }
}
.filter-area {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  > .checkbox {
    flex: 0 1 120px;
  }
  > .select {
    flex: 0 1 150px;
  }
}
</style>
