import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router'
import { getSetting } from '../../data/repositories/settings'
import {
  countCompletedWorkouts,
  getActiveWorkout,
  startWorkout,
} from '../../data/repositories/workouts'
import { backupReminder } from '../../domain/backupReminder'
import { Button } from '../../ui/Button'
import { Screen } from '../../ui/Screen'
import { TemplatesSection } from '../templates/TemplatesSection'

const ROW =
  'tap-target flex items-center rounded-control bg-surface-2 px-4 font-semibold active:bg-border'

/** The Today tab: start or resume a workout, and the shortcuts. */
export function HomeScreen() {
  const navigate = useNavigate()
  // `null` means no workout in progress. `undefined` means still loading.
  const active = useLiveQuery(async () => (await getActiveWorkout()) ?? null)

  const reminder = useLiveQuery(async () =>
    backupReminder({
      completedWorkouts: await countCompletedWorkouts(),
      lastBackupAt: await getSetting('lastBackupAt'),
      now: Date.now(),
    }),
  )

  async function start() {
    await startWorkout()
    void navigate('/workout')
  }

  return (
    <Screen title="Today">
      {reminder?.overdue && (
        <Link
          to="/settings"
          className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4 active:bg-surface-2"
        >
          <span className="font-semibold">Back up your workouts</span>
          <span className="text-sm text-muted">
            {reminder.daysSince === null
              ? 'You have never saved a backup. Your workouts exist only on this phone.'
              : `Your last backup was ${reminder.daysSince} days ago.`}
          </span>
        </Link>
      )}
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

      <TemplatesSection />

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
