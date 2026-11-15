import { EmptyState } from '../ui/EmptyState'
import { Screen } from '../ui/Screen'

/** Stands in for a screen that a later phase builds. */
export function PlaceholderScreen({
  title,
  back,
}: {
  title: string
  back?: string
}) {
  return (
    <Screen title={title} back={back}>
      <EmptyState
        title="Coming soon"
        description={`${title} is not built yet.`}
      />
    </Screen>
  )
}
