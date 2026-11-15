import { useLiveQuery } from 'dexie-react-hooks'
import { useParams, useSearchParams } from 'react-router'
import { getExercise } from '../../data/repositories/exercises'
import { EmptyState } from '../../ui/EmptyState'
import { Screen } from '../../ui/Screen'
import { ExerciseForm } from './ExerciseForm'
import { blankValues, valuesFromExercise } from './formValues'

/** `/exercises/new`. `?name=` pre-fills the name, from a search with no hits. */
export function NewExerciseScreen() {
  const [params] = useSearchParams()

  return (
    <Screen title="New exercise" back="/exercises">
      <ExerciseForm
        initial={blankValues(params.get('name') ?? '')}
        backTo="/exercises"
      />
    </Screen>
  )
}

/** `/exercises/:id/edit`. */
export function EditExerciseScreen() {
  const { id = '' } = useParams()
  // `null` means there is no such exercise. `undefined` means still loading.
  const exercise = useLiveQuery(
    async () => (await getExercise(id)) ?? null,
    [id],
  )
  const detail = `/exercises/${id}`

  if (exercise === undefined) {
    return <Screen title="Edit exercise" back="/exercises" />
  }
  if (exercise === null) {
    return (
      <Screen title="Edit exercise" back="/exercises">
        <EmptyState
          title="Exercise not found"
          description="It may have been deleted."
        />
      </Screen>
    )
  }

  return (
    <Screen title="Edit exercise" back={detail}>
      <ExerciseForm
        key={exercise.id}
        initial={valuesFromExercise(exercise)}
        exerciseId={exercise.id}
        backTo={detail}
      />
    </Screen>
  )
}
