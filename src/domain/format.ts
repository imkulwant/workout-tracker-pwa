import { roundWeightKg } from './numbers'

/** A weight to at most two decimals, without trailing zeros: 82.5, 80, 20.13. Null shows as nothing. */
export function formatWeightKg(weightKg: number | null): string {
  if (weightKg === null) return ''
  return String(roundWeightKg(weightKg))
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
