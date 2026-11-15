export interface StandaloneEnv {
  matchMedia?: (query: string) => { matches: boolean }
  /** Older iOS reports Home Screen mode here instead of through matchMedia. */
  navigator?: { standalone?: boolean }
}

/**
 * True when the app runs from the Home Screen icon. iOS has no install event,
 * so this is the only way to tell an installed app from a Safari tab, which
 * does not share storage with it.
 */
export function isStandalone(
  // The cast is needed because lib.dom's Navigator has no `standalone` field.
  env: StandaloneEnv = globalThis as unknown as StandaloneEnv,
): boolean {
  return (
    env.matchMedia?.('(display-mode: standalone)').matches === true ||
    env.navigator?.standalone === true
  )
}
