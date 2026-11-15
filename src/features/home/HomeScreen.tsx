import { Link } from 'react-router'
import { Screen } from '../../ui/Screen'

const ROW =
  'tap-target flex items-center rounded-control bg-surface-2 px-4 font-semibold active:bg-border'

/** The Today tab. Only the shortcuts exist so far. */
export function HomeScreen() {
  return (
    <Screen title="Today">
      <nav aria-label="Shortcuts" className="flex flex-col gap-2">
        <Link className={ROW} to="/workout">
          Start workout
        </Link>
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
