import { Screen } from '../../ui/Screen'
import { StorageStatus } from './StorageStatus'
import { WorkoutSettings } from './WorkoutSettings'

export function SettingsScreen() {
  return (
    <Screen title="Settings" back="/">
      <WorkoutSettings />
      <StorageStatus />
    </Screen>
  )
}
