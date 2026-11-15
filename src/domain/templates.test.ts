import { describe, expect, it } from 'vitest'
import {
  itemsFromWorkout,
  moveItem,
  readTemplateItem,
  sortByLastUsed,
} from './templates'
import type { SetType, Template } from './types'

const row = (id: string, exerciseId: string, position: number) => ({
  id,
  exerciseId,
  position,
})
const set = (
  workoutExerciseId: string,
  position: number,
  reps: number | null,
  type: SetType = 'working',
  done = true,
) => ({
  workoutExerciseId,
  position,
  reps,
  type,
  completedAt: done ? 1 : null,
})

describe('itemsFromWorkout', () => {
  it('makes one item per exercise, in order, counting completed sets', () => {
    const items = itemsFromWorkout(
      [row('r2', 'row', 1), row('r1', 'bench', 0)],
      [
        set('r1', 0, 8, 'warmup'),
        set('r1', 1, 5),
        set('r1', 2, 5),
        set('r1', 3, 4, 'working', false),
        set('r2', 0, 10),
      ],
    )
    expect(items).toEqual([
      // The warm-up counts as a set done, but its reps are not the target.
      { exerciseId: 'bench', targetSets: 3, targetReps: 5, restSec: null },
      { exerciseId: 'row', targetSets: 1, targetReps: 10, restSec: null },
    ])
  })

  it('leaves out an exercise with no completed set', () => {
    expect(
      itemsFromWorkout(
        [row('r1', 'bench', 0), row('r2', 'row', 1)],
        [set('r1', 0, 5, 'working', false), set('r2', 0, 8)],
      ).map((i) => i.exerciseId),
    ).toEqual(['row'])
  })

  it('has no target reps when only warm-ups were done, or reps are missing', () => {
    expect(
      itemsFromWorkout([row('r1', 'bench', 0)], [set('r1', 0, 8, 'warmup')])[0]!
        .targetReps,
    ).toBeNull()
    expect(
      itemsFromWorkout([row('r1', 'bench', 0)], [set('r1', 0, null)])[0]!
        .targetReps,
    ).toBeNull()
  })

  it('is empty for a workout with nothing done', () => {
    expect(itemsFromWorkout([row('r1', 'bench', 0)], [])).toEqual([])
    expect(itemsFromWorkout([], [])).toEqual([])
  })
})

describe('sortByLastUsed', () => {
  const template = (id: string, name: string, updatedAt: number) =>
    ({ id, name, updatedAt }) as Template

  it('puts the most recently used first, then unused by last edit, then name', () => {
    const result = sortByLastUsed(
      [
        template('a', 'Alpha', 10),
        template('b', 'Beta', 50),
        template('c', 'Gamma', 50),
        template('d', 'Delta', 30),
        template('e', 'Epsilon', 99),
      ],
      new Map([
        ['d', 500],
        ['a', 900],
      ]),
    )
    expect(result.map((r) => r.template.id)).toEqual(['a', 'd', 'e', 'b', 'c'])
    expect(result.map((r) => r.lastUsedAt)).toEqual([
      900,
      500,
      null,
      null,
      null,
    ])
  })

  it('handles no templates', () => {
    expect(sortByLastUsed([], new Map())).toEqual([])
  })
})

describe('moveItem', () => {
  it('swaps with a neighbour', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })

  it('stays put at the ends and returns a copy', () => {
    const items = ['a', 'b']
    expect(moveItem(items, 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(items, 1, 1)).toEqual(['a', 'b'])
    expect(moveItem(items, 0, -1)).not.toBe(items)
  })
})

describe('readTemplateItem', () => {
  const read = (sets: string, reps = '', rest = '') =>
    readTemplateItem({ exerciseId: 'bench', sets, reps, rest })

  it('reads sets, and reps and rest when given', () => {
    expect(read('3', '8', '90')).toEqual({
      ok: true,
      item: { exerciseId: 'bench', targetSets: 3, targetReps: 8, restSec: 90 },
    })
    expect(read(' 4 ')).toEqual({
      ok: true,
      item: {
        exerciseId: 'bench',
        targetSets: 4,
        targetReps: null,
        restSec: null,
      },
    })
  })

  it('allows a rest of 0 and the reps limits', () => {
    expect(read('1', '1', '0')).toMatchObject({ ok: true })
    expect(read('1', '999')).toMatchObject({ ok: true })
  })

  it.each([
    ['', '', '', 'Sets must be a whole number of at least 1.'],
    ['0', '', '', 'Sets must be a whole number of at least 1.'],
    ['2.5', '', '', 'Sets must be a whole number of at least 1.'],
    ['-1', '', '', 'Sets must be a whole number of at least 1.'],
    ['3', '0', '', 'Reps must be a whole number from 1 to 999.'],
    ['3', '1000', '', 'Reps must be a whole number from 1 to 999.'],
    ['3', '8,5', '', 'Reps must be a whole number from 1 to 999.'],
    ['3', '8', '1.5', 'Rest must be a whole number of seconds.'],
    ['3', '8', 'x', 'Rest must be a whole number of seconds.'],
  ])('refuses sets %j reps %j rest %j', (sets, reps, rest, error) => {
    expect(read(sets, reps, rest)).toEqual({ ok: false, error })
  })
})
