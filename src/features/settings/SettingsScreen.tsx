import { Screen } from '../../ui/Screen'
import { BackupSection } from './BackupSection'
import { StorageStatus } from './StorageStatus'
import { WorkoutSettings } from './WorkoutSettings'

export function SettingsScreen() {
  return (
    <Screen title="Settings" back="/">
      <BackupSection />
      <WorkoutSettings />
      <StorageStatus />
    </Screen>
  )
}
