import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export const formatToClientTimezone = (
  date: string | Date | null | undefined,
  format = 'YYYY-MM-DD HH:mm:ss'
): string | undefined => {
  if (!date) {
    return
  }

  // Lấy timezone máy client
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Convert từ UTC về giờ client
  return dayjs.utc(date).tz(timezone).format(format)
}
