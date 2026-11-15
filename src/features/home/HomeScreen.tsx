import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router'
import {
  getActiveWorkout,
  startWorkout,
} from '../../data/repositories/workouts'
import { Button } from '../../ui/Button'
import { Screen } from '../../ui/Screen'

const ROW =
  'tap-target flex items-center rounded-control bg-surface-2 px-4 font-semibold active:bg-border'

/** The Today tab: start or resume a workout, and the shortcuts. */
export function HomeScreen() {
  const navigate = useNavigate()
  // `null` means no workout in progress. `undefined` means still loading.
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null)

  async function start() {
    await startWorkout()
    void navigate('/workout')
  }

  return (
    <Screen title="Today">
      {active === null && (
        <Button onClick={() => void start()}>Start workout</Button>
      )}
      {active && (
        <Link
          to="/workout"
          className="tap-target flex items-center justify-center rounded-control bg-accent px-4 font-semibold text-on-accent active:bg-accent-strong"
        >
          Resume workout
        </Link>
      )}

      <nav aria-label="Shortcuts" className="flex flex-col gap-2">
        <Link className={ROW} to="/templates">
          Templates
        </Link>
        <Link className={ROW} to="/settings">
          Settings
        </Link>
      </nav>
    </Screen>
  )
}
