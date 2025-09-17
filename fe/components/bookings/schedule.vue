<script lang="ts" setup>
import { getHours } from 'date-fns'
// import omit from 'lodash/fp/omit'
import {
  RoomBookingDetail,
  ServiceBookingDetail,
  RoomSchedule,
  ServiceSchedule,
  BookingServiceParam,
  BookingList
} from '~/store/booking'

const bookingFormStore = useBookingFormStore()
const bookingScheduleStore = useBookingScheduleStore()
const {
  roomSchedules,
  serviceSchedules,
  date: selectedDate,
  noOfWaitingBooking,
  isHoliday,
  isLoading
} = storeToRefs(bookingScheduleStore)
const {
  isFillBookingProcessing,
  summaryBookingDetail,
  isClearBookingProcessing
  // summaryBookingDetail,
  // booking
} = storeToRefs(bookingFormStore)
const bookingDetailStore = useBookingDetailStore()

const dialogStore = useDialogStore()

const initDate = bookingDetailStore.bookingDetailIdForShowSchedule
  ? new Date(selectedDate.value)
  : new Date()
const scheduleStartTime = ref(formatDateTime(initDate, 'yyyy-MM-dd 07:00'))
const scheduleEndTime = ref(formatDateTime(initDate, 'yyyy-MM-dd 23:00'))
bookingScheduleStore.fetchSchedules()

const tabConfig = generateConstants({
  room: { value: 1, label: '会議室' },
  service: { value: 2, label: '備品' }
})
const serviceTypeOptions: Array<{ label: string; value: number }> = [
  { label: 'すべてのカテゴリ', value: -1 },
  ...serviceCategories.valueLabelList
]
const currentTab = ref(1)
const colorSettings = {
  ternary: 'rgb(var(--v-theme-on-primary))',
  quartenary: 'rgb(var(--v-theme-on-primary))',
  primary: 'rgb(var(--v-theme-on-primary))',
  text: 'rgb(var(--v-theme-text))'
}
const currentServiceType = ref(-1)
const noServicePerPage = 15
const currentServicePage = ref(1)
const totalServicePage = ref(1)
function openDayCreateDialog () {
  dialogStore.showDialog(resolveComponent('bookings-dialog-closed-day'))
}
const fillBookingDetailToForm = async (
  bookingDetail: RoomBookingDetail | ServiceBookingDetail,
  event: Event
) => {
  event.stopPropagation()
  const bookingInfo = {
    id: bookingDetail.bookingId,
    createdStaffId: bookingDetail.createdStaffId,
    updatedStaffId: bookingDetail.updatedStaffId,
    customerId: bookingDetail.customerId,
    customerName: bookingDetail.customerName,
    customerTel: bookingDetail.customerTel,
    customerFax: bookingDetail.customerFax,
    customerMail: bookingDetail.customerMail,
    customerRepName: bookingDetail.customerRepName
  }
  const toBeFilledBookingDetail = {
    title: bookingDetail.title,
    id: bookingDetail.id,
    roomId: bookingDetail.roomId,
    date: formatDateTime(new Date(bookingDetail.startDatetime), 'yyyy-MM-dd'),
    startTime: formatDateTime(new Date(bookingDetail.startDatetime), 'HH:mm'),
    endTime: formatDateTime(new Date(bookingDetail.endDatetime), 'HH:mm'),
    layoutType: bookingDetail.layoutType,
    guestCount: bookingDetail.guestCount,
    status: bookingDetail.status,
    isCocktailStyle: bookingDetail.isCocktailStyle,
    scheduledReplyDate: bookingDetail.scheduledReplyDate
      ? formatDateTime(new Date(bookingDetail.scheduledReplyDate), 'yyyy-MM-dd')
      : bookingDetail.scheduledReplyDate,
    extraTableCount: bookingDetail.extraTableCount,
    extraChairCount: bookingDetail.extraChairCount,
    layoutLocation: bookingDetail.layoutLocation,
    cancelType: bookingDetail.cancelType,
    cancellationFeeDays: bookingDetail.cancellationFeeDays,
    note: bookingDetail.note,
    memo: bookingDetail.memo,
    createdDatetime: new Date(bookingDetail.createdDatetime!),
    updatedDatetime: new Date(bookingDetail.updatedDatetime!)
  }
  const servicesInfo = serviceSchedules.value.reduce(
    (
      bookingServices: BookingServiceParam[],
      serviceShedule: ServiceSchedule
    ) => {
      const filteredBookingServices: ServiceBookingDetail[] =
        serviceShedule.bookingDetails.filter(
          (serviceBookingDetail: ServiceBookingDetail) =>
            serviceBookingDetail.id === bookingDetail.id
        )
      const formattedBookingServices: BookingServiceParam[] =
        filteredBookingServices.map(
          ({
            serviceId,
            servicePrice,
            serviceUsageCount
          }: ServiceBookingDetail) => ({
            serviceId,
            usageCount: serviceUsageCount,
            price: servicePrice
          })
        )
      return [...bookingServices, ...formattedBookingServices]
    },
    [] as BookingServiceParam[]
  )
  isFillBookingProcessing.value = true
  bookingFormStore.fillBooking(bookingInfo)
  bookingFormStore.fillBookingServices(servicesInfo)
  bookingFormStore.fillSummaryBookingDetail({ ...toBeFilledBookingDetail })
  bookingFormStore.fillModifiedBookingDetail({ ...toBeFilledBookingDetail })

  const relatedBookingDetails = await bookingScheduleStore.getBookingDetails({
    bookingId: bookingDetail.bookingId
  })

  bookingFormStore.fillBookingDetails(
    relatedBookingDetails
      .filter(
        (currentBookingDetail: BookingList) =>
          +currentBookingDetail.bookingDetailId !== +bookingDetail.id
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
          endTime: formatDateTime(new Date(bookingDetail.endDatetime), 'HH:mm'),
          layoutType: bookingDetail.layoutType,
          guestCount: bookingDetail.guestCount,
          status: bookingDetail.status,
          isCocktailStyle: bookingDetail.isCocktailStyle,
          cancelType: bookingDetail.cancelType,
          scheduledReplyDate: bookingDetail.scheduledReplyDate
            ? formatDateTime(
              new Date(bookingDetail.scheduledReplyDate),
              'yyyy-MM-dd'
            )
            : bookingDetail.scheduledReplyDate
        }
      })
  )

  await nextTick()
  isFillBookingProcessing.value = false
}

async function jumpToToday () {
  selectedDate.value = formatDateTime(new Date(), 'yyyy-MM-dd')
  await bookingScheduleStore.fetchSchedules()
  bookingFormStore.clearBookingData()
}

function handleTabClick (tabValue: number) {
  if (tabValue !== currentTab.value) {
    currentTab.value = tabValue
    bookingFormStore.clearBookingData()
  }
}

function fixTooltipPosition (element: any) {
  const targetElement = element.target
  const {
    bottom: distanceFromTop,
    top,
    height
  } = targetElement.getBoundingClientRect()
  const currentViewHeight = window.innerHeight
  setTimeout(() => {
    const tooltipElement: HTMLElement | null =
      document.querySelector('.g-gantt-tooltip')
    if (tooltipElement?.style) {
      if (currentViewHeight - distanceFromTop < tooltipElement.clientHeight) {
        tooltipElement.style.top = `${top - tooltipElement.clientHeight - 2}px`
      } else {
        tooltipElement.style.top = `${top + height + 2}px`
      }
    }
  }, 110)
}

function onPrevPage () {
  if (currentServicePage.value === 1) {
    return
  }
  currentServicePage.value = currentServicePage.value - 1
}

type ClickEmptyBarEvent = Event & {
  target: EventTarget & { parentElement: Element };
  clientX: number;
};

async function handleClickEmptyBar (
  event: ClickEmptyBarEvent,
  roomSchedule: RoomSchedule | ServiceSchedule
) {
  const {
    target: { parentElement },
    clientX
  } = event
  const parentBounds = parentElement.getBoundingClientRect()
  const x = clientX - parentBounds.left
  if (parentElement.className.includes('schedule-row') && x >= 0) {
    const startHour = parseInt(`${x / (parentBounds.width / 16) + 7}`)
    // const inputedSummaryBookingDetail = { ...summaryBookingDetail.value }
    // const inputedBooking = { ...booking.value }
    isClearBookingProcessing.value = true
    bookingFormStore.clearBookingData()
    await nextTick()
    isClearBookingProcessing.value = false
    bookingFormStore.fillSummaryBookingDetail({
      // ...(inputedBooking.id ? {} : omit(['id', 'bookingId', 'endTime'], inputedSummaryBookingDetail)),
      roomId: roomSchedule.id,
      date: selectedDate.value,
      startTime: formatHour(startHour)
    })
    // bookingFormStore.fillBooking({ ...(inputedBooking.id ? {} : omit(['id'], inputedBooking)) })
  }
}

function formatHour (hour: number) {
  return hour >= 10 ? `${hour}:00` : `0${hour}:00`
}

function onNextPage () {
  if (currentServicePage.value === totalServicePage.value) {
    return
  }
  currentServicePage.value = currentServicePage.value + 1
}

const paginatedServiceSchedules = computed(() => {
  let filteredServices = filteredByTypeServiceSchedules.value
  filteredServices = filteredServices.slice(
    (currentServicePage.value - 1) * noServicePerPage,
    noServicePerPage * currentServicePage.value
  )
  return filteredServices
})

const shouldShowPaginationIcon = computed(() => {
  return (
    currentTab.value === tabConfig.service.value && totalServicePage.value !== 1
  )
})

const filteredByTypeServiceSchedules = computed(() => {
  let filteredServices = serviceSchedules.value
  if (currentServiceType.value !== -1) {
    filteredServices = filteredServices.filter((service) => {
      const itemType =
        currentServiceType.value === serviceCategories.notSet.value
          ? null
          : currentServiceType.value

      return service.itemType === itemType
    })
  }
  return filteredServices
})

const isSelectedHoliday = computed(() => {
  return !isLoading.value && isJPHoliday(selectedDate.value)
})

watch(
  [filteredByTypeServiceSchedules, currentServiceType, selectedDate],
  ([newSchedules]) => {
    currentServicePage.value = 1
    totalServicePage.value =
      Math.ceil(newSchedules.length / noServicePerPage) || 1
  }
)

watch(selectedDate, async (newSelectedDate) => {
  scheduleStartTime.value = formatDateTime(
    new Date(newSelectedDate),
    'yyyy-MM-dd 07:00'
  )
  scheduleEndTime.value = formatDateTime(
    new Date(newSelectedDate),
    'yyyy-MM-dd 23:00'
  )
  bookingFormStore.clearBookingData()
  await bookingScheduleStore.fetchSchedules()
})

function formatUsedServices (services: { name: string; count: number }[]) {
  const servicesLength = services.length

  return services
    .map(({ name, count }, index) => {
      const postfix = index < servicesLength - 1 ? '、' : ''
      return `<span class="service">${name}：${count}${postfix}</span>`
    })
    .join('')
}

onUnmounted(() => {
  selectedDate.value = formatDateTime(new Date(), 'yyyy-MM-dd')
  bookingFormStore.clearBookingData()
})
</script>
<template>
  <div class="booking-actions">
    <div class="tabs">
      <v-btn
        class="button -room"
        size="small"
        :class="{ '-inactive': currentTab === tabConfig.service.value }"
        :variant="currentTab === tabConfig.room.value ? undefined : 'outlined'"
        @click="handleTabClick(tabConfig.room.value)"
      >
        {{ tabConfig.room.label }}
      </v-btn>
      <v-btn
        class="button -service"
        size="small"
        :class="{ '-inactive': currentTab === tabConfig.room.value }"
        :variant="
          currentTab === tabConfig.service.value ? undefined : 'outlined'
        "
        @click="handleTabClick(tabConfig.service.value)"
      >
        {{ tabConfig.service.label }}
      </v-btn>
      <v-select
        v-if="currentTab === tabConfig.service.value"
        v-model="currentServiceType"
        class="select -type"
        item-title="label"
        item-value="value"
        hide-details
        placeholder="科目"
        :items="serviceTypeOptions"
      />
    </div>
    <div class="others">
      <div class="dates">
        <doka-datePicker
          v-model="selectedDate"
          class="viewingday"
          type="date"
          variant="outlined"
          hide-details
        />
        <v-btn
          class="button -today"
          variant="outlined"
          color="primary"
          @click="jumpToToday"
        >
          今日
        </v-btn>
        <v-btn
          class="button -add-closed-day"
          variant="plain"
          prepend-icon="mdi-calendar-remove"
          @click="openDayCreateDialog"
        >
          休業日登録
        </v-btn>
      </div>
      <div class="cancels">
        <span class="waitingbooking">キャンセル待ち：{{ noOfWaitingBooking }}件</span>
        <v-divider class="divider" vertical />
        <v-btn
          class="button -open-waiting-cancel-bookings"
          variant="plain"
          :to="`/bookings?status=${
            bookingStatuses.canceled.value
          }&startDate=${formatDateTime(new Date(), 'yyyy-MM-dd')}`"
        >
          キャンセル一覧を見る
        </v-btn>
      </div>
    </div>
  </div>
  <div
    :class="[
      'booking-schedule',
      { '-closed': isHoliday, '-jp-holiday': isSelectedHoliday },
    ]"
  >
    <g-gantt-chart
      class="chart"
      :color-scheme="colorSettings"
      :chart-start="scheduleStartTime"
      :chart-end="scheduleEndTime"
      precision="hour"
      push-on-overlap
      :row-height="40"
      :highlighted-units="[60, 60, 100]"
      grid
      bar-start="scheduledStartTime"
      bar-end="scheduledEndTime"
      @click-bar="fillBookingDetailToForm($event.bar, $event.e)"
      @mouseenter-bar="fixTooltipPosition($event.e)"
    >
      <template #timeunit="{ date }">
        <span
          class="hour"
          :class="getHours(date) < 10 ? '-onedigit' : '-twodigit'"
        >{{ getHours(date) }}</span>
      </template>
      <template #bar-tooltip="{ bar: detailBooking }">
        <div class="schedule-tooltip">
          <p class="customername">
            {{
              detailBooking.customerName || detailBooking.customer.name || "---"
            }}
          </p>
          <p class="title">
            {{ detailBooking.title || "---" }}
          </p>
          <p class="time">
            {{
              formatDateTime(
                new Date(detailBooking.startDatetime),
                "MM月dd日 HH:mm"
              )
            }}〜{{
              formatDateTime(new Date(detailBooking.endDatetime), "HH:mm")
            }}
          </p>
          <p class="note">
            <!-- eslint-disable-next-line no-irregular-whitespace -->
            利用人数：{{ detailBooking.guestCount || "--" }}名　レイアウト：{{
              layoutTypes.labelOf(detailBooking.layoutType) || "-"
            }}
          </p>
          <p class="extra">
            <!-- eslint-disable-next-line no-irregular-whitespace -->
            机：{{ detailBooking.extraTableCount || "--" }}個　椅子：{{
              detailBooking.extraChairCount || "--"
            }}個
          </p>
          <!-- eslint-disable vue/no-v-html -->
          <p
            v-if="detailBooking.usedServices.length"
            class="usedservices"
            v-html="formatUsedServices(detailBooking.usedServices)"
          />
        </div>
      </template>
      <g-gantt-row
        v-for="(roomSchedule, index) in currentTab === tabConfig.room.value
          ? roomSchedules
          : paginatedServiceSchedules"
        :key="index"
        class="schedule-row"
        :bars="roomSchedule.bookingDetails"
        @click="handleClickEmptyBar($event, roomSchedule)"
      >
        <template #label>
          <div class="stickycontent">
            <div class="roomname">
              {{ roomSchedule.name }}
            </div>
            <div v-if="currentTab === tabConfig.service.value" class="id">
              管理番号：{{ roomSchedule.id }}
            </div>
          </div>
        </template>
        <template #bar-label="{ bar: bookingDetail }">
          <div
            class="booking-info -confirmed"
            :class="{ '-active': summaryBookingDetail.id === bookingDetail.id }"
          >
            <template
              v-if="
                bookingDetail.status !== bookingScheduleStatuses.blocked.value
              "
            >
              <p class="customername">
                {{
                  bookingDetail.customerName ||
                    bookingDetail.customer.name ||
                    "---"
                }}
              </p>
              <template v-if="currentTab === tabConfig.room.value">
                <p
                  v-if="
                    bookingDetail.status !==
                      bookingScheduleStatuses.temporary.value
                  "
                  class="note"
                >
                  <!-- eslint-disable-next-line no-irregular-whitespace -->
                  {{ bookingDetail.guestCount || "--" }}名　{{
                    layoutTypes.labelOf(bookingDetail.layoutType) || "-"
                  }}　机:{{ bookingDetail.extraTableCount || "--" }}　椅子:{{
                    bookingDetail.extraChairCount || "--"
                  }}
                </p>
                <p
                  v-else-if="
                    bookingDetail.status ===
                      bookingScheduleStatuses.temporary.value
                  "
                  class="replydate"
                >
                  {{ bookingDetail.formattedScheduledReplyDate }}
                </p>
              </template>
              <template v-if="currentTab === tabConfig.service.value">
                <p class="roomname">
                  {{ bookingDetail.roomName || "---" }}
                </p>
              </template>
            </template>
            <template v-else>
              <p class="blockedtext">
                予約不可
              </p>
            </template>
          </div>
        </template>
      </g-gantt-row>
    </g-gantt-chart>
  </div>
  <div class="booking-schedule-footer">
    <div class="pagination">
      <VIcon
        v-show="shouldShowPaginationIcon"
        class="icon"
        :class="{ '-disabled': currentServicePage === 1 }"
        icon="mdi-chevron-up"
        @click="onPrevPage()"
      />
      <VIcon
        v-show="shouldShowPaginationIcon"
        class="icon"
        :class="{ '-disabled': currentServicePage === totalServicePage }"
        icon="mdi-chevron-down"
        @click="onNextPage()"
      />
    </div>
    <VSpacer class="spacer" />
  </div>
</template>
<style lang="scss" scoped>
$labelWith: 116px;
$offsetFromLabelToSchedule: 10px;
$actionsHeight: 42px;
$shadowProperty: 4px 3px 8px -2px rgba(0, 0, 0, 0.1);
$rowHeight: 40px;
$footerHeight: 26px;
.booking-actions {
  background-color: rgb(var(--v-theme-on-primary));
  margin: 15px 20px 0;
  border-radius: 5px;
  display: flex;
  height: $actionsHeight;
  position: relative;
  > .tabs {
    width: $labelWith;
    position: absolute;
    border-top-left-radius: 5px;
    height: $actionsHeight + 30px;
    background-color: #ffffff;
    z-index: 5;
    box-shadow: $shadowProperty;
    padding: 8px 8px;
  }
  > .tabs > .button {
    font-size: 11px;
    padding: 0;
    &.-room {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
    &.-service {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
    &.-inactive {
      border-color: rgb(var(--v-theme-border));
    }
  }
  > .tabs > .select {
    margin-top: 5px;
  }
  > .others {
    margin-left: $labelWith + $offsetFromLabelToSchedule;
    margin-right: 10px;
    width: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }
  > .others > .dates {
    display: flex;
    align-items: center;
  }
  > .others > .dates > .viewingday {
    width: 130px;
  }
  > .others > .dates > .button.-today {
    margin-left: 15px;
    font-weight: 400;
  }
  > .others > .dates > .button.-add-closed-day {
    margin-left: 25px;
  }
  > .others > .cancels {
    display: flex;
    align-items: center;
  }
  > .others > .cancels > .waitingbooking {
    color: rgb(var(--v-theme-text-placeholder));
  }
  > .others > .cancels > .divider {
    margin-left: 10px;
    color: rgb(var(--v-theme-border));
    opacity: 1;
    height: 1rem;
    align-self: center;
  }
  > .others > .cancels > .button {
    padding: 0 10px;
  }
}
.booking-schedule::-webkit-scrollbar {
  display: none;
}
.booking-schedule {
  overflow-x: scroll;
  margin: 0 20px;
  padding-right: 10px;
  border-radius: 5px;
  background-color: white;
  &.-closed > :deep(.chart) > .g-gantt-rows-container::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 10;
    background-color: rgba(var(--v-theme-background-disabled), 0.6);
    cursor: not-allowed;
  }
  &.-jp-holiday:not(.-closed)
    > :deep(.chart)
    > .g-gantt-rows-container::before {
    content: "";
    position: absolute;
    inset: 0;
    background-color: rgba(var(--v-theme-background-jp-holiday), 0.65);
  }
  > .chart {
    margin-left: $labelWith + $offsetFromLabelToSchedule;
    overflow-x: visible;
    width: unset !important;
  }
  > .chart > :deep(.g-timeaxis) {
    box-shadow: none;
    height: 30px !important;
    min-height: 30px !important;
  }
  > .chart > :deep(.g-timeaxis) > .g-timeunits-container:first-child {
    display: none;
  }
  > .chart > :deep(.g-timeaxis) > .g-timeunits-container {
    height: 100%;
  }
  > .chart > :deep(.g-timeaxis) > .g-timeunits-container > .g-timeunit > .hour {
    color: rgb(var(--v-theme-text-placeholder));
    font-size: 11px;
    &.-onedigit {
      margin-left: -3px;
    }
    &.-twodigit {
      margin-left: -5px;
    }
  }
  > .chart
    > :deep(.g-timeaxis)
    > .g-timeunits-container
    > .g-timeunit
    > .g-timeaxis-hour-pin {
    display: none;
  }
}
.booking-schedule-footer {
  background-color: #ffffff;
  display: flex;
  margin: 0 20px;
  border-bottom-right-radius: 5px;
  border-bottom-left-radius: 5px;
  > .pagination {
    width: $labelWith;
    height: $footerHeight;
    display: flex;
    padding: 3px 5px;
    justify-content: flex-end;
    border-bottom-left-radius: 5px;
    box-shadow: 4px -3px 8px -2px rgba(0, 0, 0, 0.1);
  }
  > .spacer {
    margin-left: $offsetFromLabelToSchedule;
  }
  > .spacer,
  > .pagination {
    border-top: 1px solid #ebebea;
  }
  > .pagination > .icon {
    color: rgb(var(--v-theme-primary));
    &.-disabled {
      color: rgb(var(--v-theme-text-placeholder));
    }
  }
}
.schedule-row {
  > :deep(.g-gantt-row-bars-container) {
    border-top: none;
  }
  > :deep(.g-gantt-row-label) {
    position: absolute;
    width: calc(100% + $labelWith + $offsetFromLabelToSchedule) !important;
    background-color: transparent !important;
    box-shadow: none;
    left: -$labelWith - $offsetFromLabelToSchedule;
    border-radius: 0;
    height: $rowHeight;
    font-size: 11px;
    z-index: auto;
    padding: 0;
  }
  > :deep(.g-gantt-row-label) > .stickycontent {
    position: sticky;
    padding: 0 8px;
    left: 0;
    width: $labelWith;
    box-shadow: none;
    align-items: center;
    box-shadow: $shadowProperty;
    height: $rowHeight;
    z-index: 5;
    display: flex;
    background-color: rgb(var(--v-theme-on-primary)) !important;
    border-top: 1px solid #ebebea;
    justify-content: center;
    flex-direction: column;
  }
  > :deep(.g-gantt-row-label) > .stickycontent > .roomname,
  > :deep(.g-gantt-row-label) > .stickycontent > .id {
    align-self: start;
  }
  > :deep(.g-gantt-row-label) > .stickycontent > .id {
    color: rgb(var(--v-theme-text-placeholder));
    font-weight: 400;
    font-size: 10px;
  }
  :deep(.g-gantt-bar-label) {
    justify-content: flex-start;
    padding: 6px 8px;
  }
  :deep(.g-gantt-bar) {
    // TODO padding of bookings. Default 0.8 height and 0.1 padding
    height: $rowHeight * 0.9 + 1 !important;
    top: $rowHeight * 0.05 !important;
    cursor: pointer;
    &:has(> .g-gantt-bar-label > .booking-info.-active) {
      background-color: rgb(var(--v-theme-success-lighten)) !important;
      border-color: rgb(var(--v-theme-success)) !important;
    }
  }
}
.booking-info {
  line-height: 11px;
  font-size: 11px;
  width: 100%;
  > .customername {
    font-weight: 600;
  }
  > .title {
    margin-top: 1px;
  }
  > .replydate,
  > .roomname,
  > .note {
    opacity: 0.5;
    margin-top: 2px;
  }
  > .customername,
  > .title,
  > .replydate,
  > .blockedtext,
  > .roomname,
  > .note {
    text-overflow: ellipsis;
    overflow: hidden;
  }
  > .blockedtext {
    font-weight: 700;
    text-align: center;
  }
  &.-confirmed,
  &.-tentative {
    text-align: left;
  }
}
.schedule-tooltip {
  margin: 20px 25px;
  max-width: 250px;
  > .customername {
    font-size: 16px;
    font-weight: 700;
  }
  > .title {
    margin-top: 4px;
  }
  > .time {
    margin-top: 8px;
  }
  > .note {
    margin-top: 12px;
  }
  > .extra {
    margin-top: 6px;
  }
  > .note,
  > .usedservices {
    display: flex;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  > .usedservices > :deep(.service) {
    white-space: nowrap;
  }
}
</style>
<style lang="scss">
.g-gantt-tooltip {
  background-color: white;
  color: rgb(var(--v-theme-text));
  font-size: 1rem;
  padding: 0 5px;
  border-radius: 4px;
  box-shadow: 0px 1px 10px rgba(0, 0, 0, 0.1),
    0px 1px 16px 1px rgba(0, 0, 0, 0.06);
}
.g-gantt-tooltip:before {
  display: none;
}
.g-gantt-tooltip-color-dot {
  display: none;
}
</style>
