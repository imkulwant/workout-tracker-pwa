import Dexie from 'dexie'
import { expect, it } from 'vitest'

it('round-trips a record through Dexie on fake-indexeddb', async () => {
  const db = new Dexie('smoke-test')
  db.version(1).stores({ items: 'id' })

  await db.table('items').put({ id: 'a', n: 1 })
  expect(await db.table('items').get('a')).toEqual({ id: 'a', n: 1 })

  db.close()
  await Dexie.delete('smoke-test')
})
