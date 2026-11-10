const date = /(?:(20\d{2})\s*[.\/년-]\s*)?(\d{1,2})\s*[.\/월-]\s*(\d{1,2})(?:\s*[.일])?(?:\s*\([월화수목금토일]\))?(?:\s+(\d{1,2})\s*:\s*(\d{2}))?/
const dateRange = new RegExp(`^${date.source}\\s*(?:~|～|–|—|-|부터)\\s*${date.source}\\s*(?:까지)?$`)
const alwaysOpen = /^상시(?:\s*(?:신청|접수|모집))?$|^연중\s*상시(?:\s*(?:신청|접수|모집))?$/

function koreanTime(year, month, day, hour, minute, endOfPeriod) {
  const dateOnly = hour === undefined
  const hours = Number(hour ?? (endOfPeriod ? 23 : 0))
  const minutes = Number(minute ?? (endOfPeriod ? 59 : 0))
  const local = new Date(Date.UTC(year, month - 1, day, hours, minutes))
  if (local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day || hours > 23 || minutes > 59) {
    return null
  }
  return local.getTime() - 9 * 60 * 60 * 1000 + (endOfPeriod ? (dateOnly ? 60_000 : 1) : 0)
}

export function parseSupportApplication(deadline, deadlineType) {
  const text = deadline.trim().replace(/^신청\s*(?:기간|기한)\s*[:：]\s*/, "")
  if (alwaysOpen.test(text) || (!text && alwaysOpen.test(deadlineType.trim()))) {
    return { always: true }
  }

  const range = text.match(dateRange)
  if (!range || !range[1]) return null

  const [, startYear, startMonth, startDay, startHour, startMinute, endYear, endMonth, endDay, endHour, endMinute] = range
  const startsAt = koreanTime(Number(startYear), Number(startMonth), Number(startDay), startHour, startMinute, false)
  const endsBefore = koreanTime(Number(endYear ?? startYear), Number(endMonth), Number(endDay), endHour, endMinute, true)
  return startsAt !== null && endsBefore !== null && startsAt < endsBefore ? { startsAt, endsBefore } : null
}

export function supportApplicationStatus(application, now) {
  if (!application) return "일정 확인 필요"
  if (application.always) return "상시"
  if (now < application.startsAt) return "접수 예정"
  return now < application.endsBefore ? "접수 중" : "마감"
}
