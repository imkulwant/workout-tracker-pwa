import { useNavigate } from 'react-router'

/**
 * Goes back one screen. When the screen was opened directly, with nothing to
 * go back to, it goes to `fallback` instead, replacing the current entry.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()

  return () => {
    const state = window.history.state as { idx?: number } | null
    if ((state?.idx ?? 0) > 0) void navigate(-1)
    else void navigate(fallback, { replace: true })
  }
}
