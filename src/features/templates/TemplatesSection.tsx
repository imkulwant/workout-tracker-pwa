import { Link, useNavigate } from 'react-router'
import { Button } from '../../ui/Button'
import { startFromTemplate } from './startTemplate'
import { useTemplates } from './useTemplates'

/** How many templates Today lists before sending you to the full list. */
const SHOWN = 4

/** Templates on Today, most recently used first, each with a Start button. */
export function TemplatesSection() {
  const navigate = useNavigate()
  const data = useTemplates()
  if (!data || data.uses.length === 0) return null
  const { uses, hasActiveWorkout } = data

  return (
    <section
      aria-labelledby="templates-heading"
      className="flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="templates-heading" className="text-sm text-muted">
          Start from a template
        </h2>
        {uses.length > SHOWN && (
          <Link to="/templates" className="text-sm font-semibold text-accent">
            All templates
          </Link>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {uses.slice(0, SHOWN).map(({ template }) => (
          <li
            key={template.id}
            className="flex items-center justify-between gap-2 rounded-card bg-surface p-3"
          >
            <span className="min-w-0 truncate font-semibold">
              {template.name}
            </span>
            {!hasActiveWorkout && (
              <Button
                variant="secondary"
                aria-label={`Start ${template.name}`}
                onClick={() =>
                  void startFromTemplate(template.id, (p) => void navigate(p))
                }
              >
                Start
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
