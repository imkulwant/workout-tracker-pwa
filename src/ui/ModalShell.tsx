import { useEffect, useId, useRef, type ReactNode } from 'react'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

interface ModalShellProps extends ModalProps {
  dialogClassName: string
  panelClassName: string
}

/**
 * The shared base of Sheet and Dialog. It is a native <dialog>, so the
 * browser supplies the focus trap, Escape to close and top-layer stacking.
 * The panel has the padding, so a click that lands on the dialog element
 * itself is a click on the backdrop.
 */
export function ModalShell({
  open,
  onClose,
  title,
  children,
  dialogClassName,
  panelClassName,
}: ModalShellProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal focuses the first control, which can be a search box. On a
      // phone that raises the keyboard over the list. Focus the title instead:
      // it is read out by screen readers and does not open a keyboard.
      titleRef.current?.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={dialogClassName}
    >
      {open && (
        <div className={panelClassName}>
          <h2
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="mb-3 text-lg font-semibold outline-none"
          >
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  )
}
