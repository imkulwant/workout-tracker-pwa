import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { listWorkoutSets } from '../data/repositories/sets'
import { getActiveWorkout } from '../data/repositories/workouts'
import { isStaleWorkout, lastCompletedAt } from '../domain/resume'
import type { Id } from '../domain/types'
import { discardWorkout, finishAtLastSet } from '../features/workout/actions'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'

interface Forgotten {
  id: Id
  /** Finishing is only offered when a set was completed to end it at. */
  canFinish: boolean
}

/**
 * Runs once when the app opens. A workout in progress takes the screen, so a
 * force-quit mid-set resumes where it stopped. If that workout was started
 * more than 12 hours ago it is probably forgotten, so ask what to do with it.
 */
export function LaunchGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)
  const [forgotten, setForgotten] = useState<Forgotten | null>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const workout = await getActiveWorkout()
      if (!workout || cancelled) return
      if (isStaleWorkout(workout, Date.now())) {
        const sets = await listWorkoutSets(workout.id)
        if (cancelled) return
        setForgotten({
          id: workout.id,
          canFinish: lastCompletedAt(sets) !== null,
        })
      }
      void navigate('/workout', { replace: true })
    }
    void check().then(() => {
      if (!cancelled) setChecked(true)
    })
    return () => {
      cancelled = true
    }
    // Only the first render is a launch. Later visits to other screens stay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The first paint waits, so Today never flashes before the workout.
  if (!checked) return null

  const settle = (action?: (id: Id) => Promise<unknown>) => {
    if (!forgotten) return
    const { id } = forgotten
    setForgotten(null)
    if (!action) return
    void action(id).then(() => navigate('/', { replace: true }))
  }

  return (
    <>
      {children}
      <Dialog
        open={forgotten !== null}
        onClose={() => settle()}
        title="Workout still open"
      >
        <p className="mb-4 text-muted">
          This workout started more than 12 hours ago. What would you like to do
          with it?
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => settle()}>Continue workout</Button>
          {forgotten?.canFinish && (
            <Button variant="secondary" onClick={() => settle(finishAtLastSet)}>
              Finish at last completed set
            </Button>
          )}
          <Button variant="danger" onClick={() => settle(discardWorkout)}>
            Discard workout
          </Button>
        </div>
      </Dialog>
    </>
  )
}
