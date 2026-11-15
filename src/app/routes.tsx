import { Link, Route, Routes } from 'react-router'
import { ExerciseDetailScreen } from '../features/exercises/ExerciseDetailScreen'
import {
  EditExerciseScreen,
  NewExerciseScreen,
} from '../features/exercises/ExerciseFormScreen'
import { LibraryScreen } from '../features/exercises/LibraryScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { ActiveWorkoutScreen } from '../features/workout/ActiveWorkoutScreen'
import { EmptyState } from '../ui/EmptyState'
import { Screen } from '../ui/Screen'
import { AppShell, FullScreen } from './AppShell'
import { PlaceholderScreen } from './PlaceholderScreen'

function NotFoundScreen() {
  return (
    <Screen title="Not found" back="/">
      <EmptyState
        title="There is nothing here"
        description="This address does not match a screen."
        action={
          <Link className="font-semibold text-accent" to="/">
            Go to Today
          </Link>
        }
      />
    </Screen>
  )
}

// The route table from docs/PLAN.md "Screens and interactions". Screens that
// later phases build are placeholders until then.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomeScreen />} />
        <Route path="history" element={<PlaceholderScreen title="History" />} />
        <Route
          path="history/:id"
          element={<PlaceholderScreen title="Workout" back="/history" />}
        />
        <Route path="stats" element={<PlaceholderScreen title="Stats" />} />
        <Route path="exercises" element={<LibraryScreen />} />
        <Route path="exercises/new" element={<NewExerciseScreen />} />
        <Route path="exercises/:id" element={<ExerciseDetailScreen />} />
        <Route path="exercises/:id/edit" element={<EditExerciseScreen />} />
        <Route
          path="templates"
          element={<PlaceholderScreen title="Templates" back="/" />}
        />
        <Route
          path="templates/:id"
          element={<PlaceholderScreen title="Template" back="/templates" />}
        />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="*" element={<NotFoundScreen />} />
      </Route>
      <Route
        path="workout"
        element={
          <FullScreen>
            <ActiveWorkoutScreen />
          </FullScreen>
        }
      />
    </Routes>
  )
}
