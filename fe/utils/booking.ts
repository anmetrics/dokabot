import type { VChip } from 'vuetify/components/VChip'
import { BookingCreateBookingDetailForm } from '~/store/booking'

const runtimeConfig = useRuntimeConfig()
const roomSetId = Number(runtimeConfig.public.ROOM_SET_ID)
const roomInSetIds = runtimeConfig.public.ROOM_IN_SET_IDS.split(',').map((roomId: string) =>
  Number(roomId)
)

export function checkBelongToRoomSet (roomId: number) {
  return [...roomInSetIds, roomSetId].includes(Number(roomId))
}

export function isRoomSetId (roomId: number) {
  return Number(roomId) === roomSetId
}

export function checkOverlapRoomTime (
  bookingDetails: BookingCreateBookingDetailForm[],
  bookingDetail: BookingCreateBookingDetailForm
) {
  if (bookingDetail.status === bookingStatuses.waitingCancel.value) { return false }

  const startDateTime = new Date(`${bookingDetail.date} ${bookingDetail.startTime}`)
  const endDateTime = new Date(`${bookingDetail.date} ${bookingDetail.endTime}`)

  return bookingDetails.some(({ startTime, endTime, date, roomId, status }) => {
    if (
      [
        bookingStatuses.waitingCancel.value,
        bookingStatuses.canceled.value
      ].includes(status)
    ) {
      return false
    }

    const bookingStartTime = new Date(`${bookingDetail.date} ${startTime}`)
    const bookingEndTime = new Date(`${bookingDetail.date} ${endTime}`)

    return (
      ((checkBelongToRoomSet(bookingDetail.roomId!) && isRoomSetId(roomId!)) ||
        (checkBelongToRoomSet(roomId!) && isRoomSetId(bookingDetail.roomId!)) ||
        bookingDetail.roomId === roomId) &&
      bookingDetail.date === date &&
      !(startDateTime >= bookingEndTime || endDateTime <= bookingStartTime)
    )
  })
}

export function getBookingStatusAttrs (status: number) {
  const {
    official: { value: official },
    temporary: { value: temporary },
    waitingCancel: { value: waitingCancel },
    checkIn: { value: checkIn },
    withholdPayment: { value: withholdPayment },
    completePayment: { value: completePayment },
    canceled: { value: canceled }
  } = bookingStatuses

  const attrs: {
    text: string
    color: string
    variant?: string
    border?: string
    class?: string
  } = {
    text: bookingStatuses.labelOf(status),
    color: 'primary'
  }
  switch (status) {
    case official:
      attrs.color = 'primary-lighten'
      break
    case temporary:
      attrs.color = 'error'
      break
    case waitingCancel:
      attrs.color = 'text-placeholder'
      attrs.variant = 'outlined'
      attrs.border = 'dashed'
      break
    case checkIn:
      attrs.color = 'in-warning'
      break
    case withholdPayment:
      attrs.color = 'success-darken'
      attrs.variant = 'outlined'
      attrs.border = 'dashed'
      break
    case completePayment:
      attrs.color = 'success-darken'
      break
    case canceled:
      attrs.color = 'text-placeholder'
      break
  }
  return attrs as Partial<VChip>
}
