import { weekdayIndex } from './dates'
import { roundWeightKg } from './numbers'
import type { LocalDate } from './types'

/** A weight to at most two decimals, without trailing zeros: 82.5, 80, 20.13. Null shows as nothing. */
export function formatWeightKg(weightKg: number | null): string {
  if (weightKg === null) return ''
  return String(roundWeightKg(weightKg))
}

/**
 * A past set for the "previous" column: `80 × 5`, or `12 reps` when there was
 * no weight, or `–` when nothing was recorded.
 */
export function formatPreviousSet(set: {
  weightKg: number | null
  reps: number | null
}): string {
  if (set.reps === null) {
    return set.weightKg === null ? '–' : `${formatWeightKg(set.weightKg)} × –`
  }
  return set.weightKg === null
    ? `${set.reps} reps`
    : `${formatWeightKg(set.weightKg)} × ${set.reps}`
}

/** Volume as whole kilograms with thousands separators: 12,346. */
export function formatVolumeKg(volumeKg: number): string {
  return Math.round(volumeKg).toLocaleString('en-US')
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** A running clock: 0:59, 1:01, 1:02:05. Used for elapsed time and rest timers. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${hours}:${pad2(minutes)}:${pad2(seconds)}`
    : `${minutes}:${pad2(seconds)}`
}

/** A length of time for a summary: 42 min, 1 h 05 min. Seconds are dropped. */
export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours} h ${pad2(minutes)} min` : `${minutes} min`
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** A day without the year: "Mon 9 Nov". Spelled out here so it never depends on the device's locale. */
export function formatDay(date: LocalDate): string {
  const [, month, day] = date.split('-').map(Number) as [number, number, number]
  return `${WEEKDAYS[weekdayIndex(date)]} ${day} ${MONTHS[month - 1]}`
}

/** A day with its year: "9 Nov 2026". */
export function formatDayWithYear(date: LocalDate): string {
  const [year, month, day] = date.split('-').map(Number) as [
    number,
    number,
    number,
  ]
  return `${day} ${MONTHS[month - 1]} ${year}`
}

/** A size in bytes, as KB, MB or GB with one decimal: 1.5 MB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}
