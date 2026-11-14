import type { EpochMs, LocalDate } from './types'

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

function format(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

// Calendar arithmetic runs on UTC midnights of the date parts, so a 23 or 25
// hour daylight-saving day can never skip or repeat a date.
function toUtcMs(date: LocalDate): number {
  const match = LOCAL_DATE.exec(date)
  if (!match) throw new Error(`Invalid local date: ${date}`)
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ]
  const ms = Date.UTC(year, month - 1, day)
  if (format(...fromUtcMs(ms)) !== date) {
    throw new Error(`Invalid local date: ${date}`)
  }
  return ms
}

function fromUtcMs(ms: number): [number, number, number] {
  const d = new Date(ms)
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
}

/** The calendar date on the device's clock at the given instant. */
export function toLocalDate(epochMs: EpochMs): LocalDate {
  const d = new Date(epochMs)
  return format(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function isLocalDate(value: string): value is LocalDate {
  try {
    toUtcMs(value)
    return true
  } catch {
    return false
  }
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return format(...fromUtcMs(toUtcMs(date) + days * DAY_MS))
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS)
}

/** Monday is 0 and Sunday is 6. */
export function weekdayIndex(date: LocalDate): number {
  return (new Date(toUtcMs(date)).getUTCDay() + 6) % 7
}

/** The Monday of the week containing `date`. */
export function startOfWeek(date: LocalDate): LocalDate {
  return addDays(date, -weekdayIndex(date))
}

/** Every date from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function eachDate(from: LocalDate, to: LocalDate): LocalDate[] {
  const count = daysBetween(from, to) + 1
  return Array.from({ length: Math.max(count, 0) }, (_, i) => addDays(from, i))
}

/** The Mondays of every week that overlaps `from` to `to`, inclusive. */
export function eachWeekStart(from: LocalDate, to: LocalDate): LocalDate[] {
  const last = startOfWeek(to)
  const weeks: LocalDate[] = []
  for (let week = startOfWeek(from); week <= last; week = addDays(week, 7)) {
    weeks.push(week)
  }
  return weeks
}
