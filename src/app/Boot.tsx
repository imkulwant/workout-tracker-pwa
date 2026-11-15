import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { bootstrap, finishRestore } from './bootstrap'
import { RestoreScreen } from './RestoreScreen'

type BootState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'restore' }
  | { status: 'error'; message: string }

/** Runs `bootstrap` once, and renders the app only after it has finished. */
export function Boot({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BootState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    bootstrap().then(
      ({ needsRestore }) => {
        if (!cancelled) setState({ status: needsRestore ? 'restore' : 'ready' })
      },
      (error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setState({ status: 'error', message })
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (state.status === 'loading') return null

  if (state.status === 'error') {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          title="Can't open your data"
          description={`Storage is unavailable (${state.message}). Nothing can be saved until this is fixed.`}
          action={
            <Button onClick={() => window.location.reload()}>Try again</Button>
          }
        />
      </div>
    )
  }

  if (state.status === 'restore') {
    return (
      <RestoreScreen
        onDone={() =>
          void finishRestore().then(() => setState({ status: 'ready' }))
        }
      />
    )
  }

  return <>{children}</>
}
