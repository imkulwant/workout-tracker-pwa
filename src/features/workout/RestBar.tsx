import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import {
  clearSetting,
  getSetting,
  setSetting,
} from '../../data/repositories/settings'
import { formatClock } from '../../domain/format'
import {
  adjustRestTimer,
  isRestFinished,
  remainingSeconds,
} from '../../domain/rest'
import { playRestTone } from '../../platform/sound'
import { Button } from '../../ui/Button'
import { useNow } from '../../ui/useNow'

const STEP_SEC = 15
// A timer that ended while the app was hidden is cleared without a tone.
const TONE_WINDOW_MS = 3000

/**
 * The rest countdown, shown while `activeRestTimer` is set. The time left is
 * worked out from the stored end, never counted down, so it stays right after
 * the app was in the background or reloaded.
 */
export function RestBar() {
  const timer = useLiveQuery(
    async () => (await getSetting('activeRestTimer')) ?? null,
  )
  const soundOn = useLiveQuery(() => getSetting('restSoundEnabled'))
  const now = useNow(250)

  const finished = timer ? isRestFinished(timer, now) : false
  const endsAt = timer?.endsAt
  useEffect(() => {
    if (endsAt === undefined || !finished) return
    const late = Date.now() - endsAt
    if (
      soundOn !== false &&
      document.visibilityState === 'visible' &&
      late < TONE_WINDOW_MS
    ) {
      playRestTone()
    }
    void clearSetting('activeRestTimer')
    // `soundOn` is read once, at the moment the rest ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, endsAt])

  if (!timer || finished) return null

  const adjust = (deltaSec: number) =>
    void setSetting(
      'activeRestTimer',
      adjustRestTimer(timer, deltaSec, Date.now()),
    )

  return (
    <section
      aria-label="Rest timer"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 pt-2"
    >
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          aria-label={`Shorten rest by ${STEP_SEC} seconds`}
          onClick={() => adjust(-STEP_SEC)}
        >
          −{STEP_SEC} s
        </Button>
        <span
          role="timer"
          aria-label="Rest remaining"
          className="flex-1 text-center text-2xl font-bold tabular-nums"
        >
          {formatClock(remainingSeconds(timer, now) * 1000)}
        </span>
        <Button
          variant="secondary"
          aria-label={`Add ${STEP_SEC} seconds to rest`}
          onClick={() => adjust(STEP_SEC)}
        >
          +{STEP_SEC} s
        </Button>
        <Button
          variant="ghost"
          onClick={() => void clearSetting('activeRestTimer')}
        >
          Skip
        </Button>
      </div>
      <p className="pb-2 pt-1 text-center text-xs text-muted">
        Alerts do not fire while the app is in the background.
      </p>
    </section>
  )
}
