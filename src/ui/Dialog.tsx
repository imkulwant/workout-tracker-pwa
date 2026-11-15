import { ModalShell, type ModalProps } from './ModalShell'

/** A centred box for confirmations, such as deleting a workout. */
export function Dialog(props: ModalProps) {
  return (
    <ModalShell
      {...props}
      dialogClassName="m-auto w-[min(92vw,22rem)] rounded-card border border-border bg-surface p-0 text-text backdrop:bg-black/60"
      panelClassName="screen-enter p-5"
    />
  )
}
