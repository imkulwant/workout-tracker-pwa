import type { Entity, Id } from '../../domain/types'

/** A write that would break one of the plan's data invariants. */
export class InvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvariantError'
  }
}

export const newId = (): Id => crypto.randomUUID()

export function isLive(row: { deletedAt: number | null }): boolean {
  return row.deletedAt === null
}

/** The row, or undefined when it is missing or soft-deleted. */
export function liveOrUndefined<T extends { deletedAt: number | null }>(
  row: T | undefined,
): T | undefined {
  return row && isLive(row) ? row : undefined
}

export function requireLive<T extends { deletedAt: number | null }>(
  row: T | undefined,
  what: string,
): T {
  if (!row || !isLive(row)) throw new InvariantError(`${what} not found`)
  return row
}

export function tombstone<T extends Entity>(row: T, now: number): T {
  return { ...row, deletedAt: now, updatedAt: now }
}

/**
 * Renumbers rows to be contiguous from 0, keeping their current order.
 * Returns only the rows whose position changed.
 */
export function repack<T extends Entity & { position: number }>(
  rows: readonly T[],
  now: number,
): T[] {
  return [...rows]
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt)
    .flatMap((row, i) =>
      row.position === i ? [] : [{ ...row, position: i, updatedAt: now }],
    )
}
