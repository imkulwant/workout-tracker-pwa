import { describe, expect, it } from 'vitest'
import { setLabels } from './setLabel'
import type { SetType } from './types'

const labels = (...types: SetType[]) =>
  setLabels(types.map((type) => ({ type })))

describe('setLabels', () => {
  it('numbers working sets from 1', () => {
    expect(labels('working', 'working', 'working')).toEqual(['1', '2', '3'])
  })

  it('shows W, D and F for the other types', () => {
    expect(labels('warmup', 'drop', 'failure')).toEqual(['W', 'D', 'F'])
  })

  it('does not let a warm-up shift the numbering', () => {
    expect(labels('warmup', 'working', 'working', 'drop', 'working')).toEqual([
      'W',
      '1',
      '2',
      'D',
      '3',
    ])
  })

  it('numbers by working sets even when they follow other types', () => {
    expect(labels('failure', 'warmup', 'working')).toEqual(['F', 'W', '1'])
  })

  it('returns nothing for no sets', () => {
    expect(labels()).toEqual([])
  })
})
