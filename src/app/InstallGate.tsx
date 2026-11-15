import type { ReactNode } from 'react'
import { isStandalone } from '../platform/standalone'

/**
 * Development only: `?browser` lets the app run in a desktop browser tab.
 * `import.meta.env.DEV` is false in production builds, so the branch is
 * removed there and nothing can bypass the gate.
 */
const devBypass = (): boolean =>
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has('browser')

/**
 * Shows the app only when it runs from the Home Screen. A Safari tab does not
 * share storage with the installed app, so anything logged in a tab would
 * never appear there. In a tab this renders a guide instead, and the app
 * behind it never starts.
 */
export function InstallGate({ children }: { children: ReactNode }) {
  if (isStandalone() || devBypass()) return <>{children}</>
  return <InstallGuide />
}

function ShareIcon() {
  return (
    <svg
      className="inline-block align-text-bottom text-accent"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Share"
      role="img"
    >
      <path d="M12 3v12M8 7l4-4 4 4M6 12H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}

function InstallGuide() {
  return (
    <main className="pt-safe pb-safe px-safe h-full overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-10">
        <img
          src="/icons/icon-192.png"
          width="72"
          height="72"
          alt=""
          className="rounded-2xl"
        />
        <h1 className="text-3xl font-bold">Install Gym Tracker</h1>
        <p className="text-muted">
          This app keeps your workouts on this iPhone. Add it to the Home Screen
          first: anything you enter in a Safari tab is stored separately and
          would not appear in the installed app, so logging is turned off here.
        </p>
        <ol className="flex flex-col gap-4">
          <li className="rounded-card bg-surface p-4">
            <span className="font-semibold">1.</span> Tap the Share button{' '}
            <ShareIcon /> in Safari&rsquo;s toolbar.
          </li>
          <li className="rounded-card bg-surface p-4">
            <span className="font-semibold">2.</span> Scroll down and tap{' '}
            <strong>Add to Home Screen</strong>.
          </li>
          <li className="rounded-card bg-surface p-4">
            <span className="font-semibold">3.</span> Keep{' '}
            <strong>Open as Web App</strong> switched on, then tap{' '}
            <strong>Add</strong>.
          </li>
          <li className="rounded-card bg-surface p-4">
            <span className="font-semibold">4.</span> Open <strong>Gym</strong>{' '}
            from your Home Screen.
          </li>
        </ol>
      </div>
    </main>
  )
}
