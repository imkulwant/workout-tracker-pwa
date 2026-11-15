import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

/** How long an Undo toast stays up, per the plan. */
export const UNDO_TOAST_MS = 5000

export interface ToastOptions {
  message: string
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}

interface ToastApi {
  /** Shows a toast, replacing any toast that is already up. */
  show: (toast: ToastOptions) => void
  dismiss: () => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current)
    setToast(null)
  }, [])

  const show = useCallback((options: ToastOptions) => {
    window.clearTimeout(timer.current)
    setToast(options)
    timer.current = window.setTimeout(
      () => setToast(null),
      options.durationMs ?? UNDO_TOAST_MS,
    )
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+4.5rem)] z-50 flex justify-center px-4"
      >
        {toast && (
          <div className="screen-enter pointer-events-auto flex items-center gap-2 rounded-control border border-border bg-surface-2 py-1 pr-1 pl-4 shadow-lg">
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="tap-target rounded-control px-3 font-semibold text-accent active:bg-surface"
                onClick={() => {
                  toast.onAction?.()
                  dismiss()
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext>
  )
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast must be used inside a ToastProvider')
  return api
}
