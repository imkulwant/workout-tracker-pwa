import { ModalShell, type ModalProps } from './ModalShell'

/** A panel that slides up from the bottom edge, for pickers and details. */
export function Sheet(props: ModalProps) {
  return (
    <ModalShell
      {...props}
      dialogClassName="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-card border-0 bg-surface p-0 text-text backdrop:bg-black/60"
      panelClassName="screen-enter max-h-[85dvh] overflow-y-auto px-4 pt-5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
    />
  )
}
