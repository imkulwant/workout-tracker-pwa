import { useState } from 'react'
import type { Exercise } from '../../domain/types'
import { Button } from '../../ui/Button'
import { Screen } from '../../ui/Screen'
import { ExercisePicker } from '../exercises/ExercisePicker'

/**
 * SCAFFOLDING until Phase 4 builds the real workout logger. It only gives the
 * exercise picker somewhere to open, so the picker is exercised end to end.
 * Nothing chosen here is saved.
 */
export function WorkoutScreen() {
  const [picking, setPicking] = useState(false)
  const [chosen, setChosen] = useState<Exercise[]>([])

  return (
    <Screen title="Workout" back="/">
      <p className="text-muted">
        Workout logging is not built yet. You can try the exercise picker.
      </p>
      <Button onClick={() => setPicking(true)}>Add exercise</Button>

      {chosen.length > 0 && (
        <ul aria-label="Chosen exercises" className="flex flex-col gap-2">
          {chosen.map((exercise, index) => (
            <li
              key={`${exercise.id}-${index}`}
              className="rounded-control bg-surface px-4 py-3 font-semibold"
            >
              {exercise.name}
            </li>
          ))}
        </ul>
      )}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onConfirm={(exercises) => {
          setChosen((current) => [...current, ...exercises])
          setPicking(false)
        }}
      />
    </Screen>
  )
}
