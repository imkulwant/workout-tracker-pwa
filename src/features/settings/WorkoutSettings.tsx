import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../../data/repositories/settings'
import { wakeLock } from '../../platform/wakeLock'
import { Switch } from '../../ui/Switch'

/** The settings that shape a workout in progress. */
export function WorkoutSettings() {
  const keepAwake = useLiveQuery(() => getSetting('wakeLockEnabled'))
  const restSound = useLiveQuery(() => getSetting('restSoundEnabled'))
  if (keepAwake === undefined || restSound === undefined) return null

  return (
    <section
      aria-labelledby="workout-settings-heading"
      className="flex flex-col rounded-card bg-surface p-4"
    >
      <h2 id="workout-settings-heading" className="text-sm text-muted">
        During a workout
      </h2>
      <Switch
        label="Keep screen on"
        description={
          wakeLock.supported
            ? 'Stops the screen from sleeping while a workout is open.'
            : 'This browser cannot keep the screen on.'
        }
        checked={keepAwake}
        disabled={!wakeLock.supported}
        onChange={(value) => void setSetting('wakeLockEnabled', value)}
      />
      <Switch
        label="Rest sound"
        description="A short beep when a rest ends. Plays only while the app is open."
        checked={restSound}
        onChange={(value) => void setSetting('restSoundEnabled', value)}
      />
    </section>
  )
}
