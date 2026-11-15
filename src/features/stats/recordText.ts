import { formatVolumeKg, formatWeightKg } from '../../domain/format'
import { roundE1rmKg } from '../../domain/metrics'
import type { RecordKind } from '../../domain/records'

/** A record value as shown: weights to 2 decimals, e1RM to 0.5 kg, volume to whole kg. */
export function formatRecordValue(kind: RecordKind, value: number): string {
  switch (kind) {
    case 'heaviest':
      return `${formatWeightKg(value)} kg`
    case 'e1rm':
      return `${formatWeightKg(roundE1rmKg(value))} kg`
    case 'setVolume':
      return `${formatVolumeKg(value)} kg`
    case 'mostReps':
      return `${value} ${value === 1 ? 'rep' : 'reps'}`
  }
}
