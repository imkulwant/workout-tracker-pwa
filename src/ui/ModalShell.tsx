import { useEffect, useId, useRef, type ReactNode } from 'react'

// Safari does not focus a button when it is tapped, so `activeElement` is the
// page itself. The last thing tapped stands in for it.
let lastTapped: Element | null = null
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (event) => {
      if (event.target instanceof Element) {
        lastTapped = event.target.closest('button, a, [role="button"]')
      }
    },
    true,
  )
}

/** The element that opened a modal: the focused one, or else the one just tapped. */
function currentOpener(): Element | null {
  const focused = document.activeElement
  return focused && focused !== document.body ? focused : lastTapped
}

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
  // What had focus when the modal opened, so it can have focus back on closing.
  const opener = useRef<Element | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      opener.current = currentOpener()
      dialog.showModal()
      // showModal focuses the first control, which can be a search box. On a
      // phone that raises the keyboard over the list. Focus the title instead:
      // it is read out by screen readers and does not open a keyboard.
      titleRef.current?.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  function handleClose() {
    const previous = opener.current
    opener.current = null
    // WebKit does not always return focus itself. A text field is skipped,
    // because focusing it would raise the keyboard.
    if (
      previous instanceof HTMLElement &&
      previous.isConnected &&
      !previous.matches('input, textarea, select')
    ) {
      previous.focus({ preventScroll: true })
    }
    onClose()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={handleClose}
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
