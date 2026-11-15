import { APP_VERSION } from '../../app/version'
import { Screen } from '../../ui/Screen'
import { UpdateBanner } from '../updates/UpdateBanner'
import { BackupSection } from './BackupSection'
import { StorageStatus } from './StorageStatus'
import { WorkoutSettings } from './WorkoutSettings'

export function SettingsScreen() {
  return (
    <Screen title="Settings" back="/">
      <UpdateBanner />
      <BackupSection />
      <WorkoutSettings />
      <StorageStatus />
      <section
        aria-labelledby="about-heading"
        className="flex flex-col gap-1 rounded-card bg-surface p-4"
      >
        <h2 id="about-heading" className="text-sm text-muted">
          About
        </h2>
        <p className="text-lg font-semibold">Workout Tracker</p>
        <p className="text-muted">Version {APP_VERSION}</p>
      </section>
    </Screen>
  )
}
