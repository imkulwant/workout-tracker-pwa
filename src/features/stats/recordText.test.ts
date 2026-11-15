import { describe, expect, it } from 'vitest'
import { formatRecordValue } from './recordText'

describe('formatRecordValue', () => {
  it('rounds each kind the way the plan says', () => {
    expect(formatRecordValue('heaviest', 82.5)).toBe('82.5 kg')
    expect(formatRecordValue('heaviest', 100)).toBe('100 kg')
    expect(formatRecordValue('e1rm', 116.6667)).toBe('116.5 kg')
    expect(formatRecordValue('e1rm', 117)).toBe('117 kg')
    expect(formatRecordValue('setVolume', 1234.4)).toBe('1,234 kg')
    expect(formatRecordValue('mostReps', 12)).toBe('12 reps')
    expect(formatRecordValue('mostReps', 1)).toBe('1 rep')
  })
})
