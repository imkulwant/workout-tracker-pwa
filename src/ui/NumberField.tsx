import { useId } from 'react'
import { parseDecimal } from '../domain/numbers'

export interface NumberFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Called on blur with the parsed number, or null when empty or invalid. */
  onCommit?: (value: number | null) => void
  /** `decimal` for weights, `numeric` for reps (no decimal key). */
  inputMode?: 'decimal' | 'numeric'
  unit?: string
  error?: string
}

/**
 * A text input with the right iOS keyboard. It is `type="text"` because
 * Swedish keyboards type a comma, which `type="number"` rejects. Only digits,
 * `.` and `,` can be typed.
 */
export function NumberField({
  label,
  value,
  onChange,
  onCommit,
  inputMode = 'decimal',
  unit,
  error,
}: NumberFieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          enterKeyHint="done"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) =>
            onChange(event.target.value.replace(/[^0-9.,]/g, ''))
          }
          onBlur={() => onCommit?.(parseDecimal(value))}
          className={`tap-target w-full rounded-control border bg-surface-2 px-3 text-text outline-none focus:border-accent ${
            error ? 'border-danger' : 'border-border'
          } ${unit ? 'pr-12' : ''}`}
        />
        {unit && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">
            {unit}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
