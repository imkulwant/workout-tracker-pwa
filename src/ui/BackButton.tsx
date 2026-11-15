import { useGoBack } from './useGoBack'

/**
 * A visible back control. Standalone mode has no browser toolbar, so every
 * pushed screen needs one. When the screen was opened directly, with nothing
 * to go back to, it goes to `fallback` instead.
 */
export function BackButton({ fallback }: { fallback: string }) {
  const goBack = useGoBack(fallback)

  return (
    <button
      type="button"
      aria-label="Back"
      className="tap-target -ml-2 flex items-center gap-1 rounded-control px-2 text-accent active:bg-surface-2"
      onClick={goBack}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Back
    </button>
  )
}
