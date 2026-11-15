export interface SwitchProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/** An on/off setting. The whole row is the tap target. */
export function Switch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="tap-target flex w-full items-center gap-3 py-2 text-left disabled:opacity-40"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{label}</span>
        {description && (
          <span className="text-sm text-muted">{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors ${
          checked ? 'bg-accent' : 'bg-surface-2'
        }`}
      >
        <span
          className={`size-6 rounded-full bg-text transition-transform ${
            checked ? 'translate-x-6' : ''
          }`}
        />
      </span>
    </button>
  )
}
