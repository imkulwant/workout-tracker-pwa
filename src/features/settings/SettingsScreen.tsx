import { Screen } from '../../ui/Screen'
import { StorageStatus } from './StorageStatus'

export function SettingsScreen() {
  return (
    <Screen title="Settings" back="/">
      <StorageStatus />
    </Screen>
  )
}
