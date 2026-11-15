import { useLiveQuery } from 'dexie-react-hooks'
import { useSyncExternalStore } from 'react'
import { getActiveWorkout } from '../../data/repositories/workouts'
import { updates } from '../../platform/updates'
import { Button } from '../../ui/Button'

const subscribe = (onChange: () => void) => updates.subscribe(onChange)

/**
 * Offers a waiting new version. It is shown only while no workout is in
 * progress, and the switch happens only when it is tapped, because it reloads
 * the app. The workout check is made again at the tap, so a workout started a
 * moment ago can never be reloaded under you.
 */
export function UpdateBanner() {
  const ready = useSyncExternalStore(subscribe, updates.isReady)
  // `null` means no workout in progress. `undefined` means still loading.
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null)

  if (!ready || active !== null) return null

  async function update() {
    if (await getActiveWorkout()) return
    updates.apply()
  }

  return (
    <section
      aria-label="Update"
      className="flex flex-col gap-2 rounded-card border border-accent bg-surface p-4"
    >
      <p className="font-semibold">A new version is ready</p>
      <p className="text-sm text-muted">
        Updating reloads the app. Your workouts are kept.
      </p>
      <Button onClick={() => void update()}>Update</Button>
    </section>
  )
}
