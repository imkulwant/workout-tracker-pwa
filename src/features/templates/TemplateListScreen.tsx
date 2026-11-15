import { Link, useNavigate } from 'react-router'
import { formatDay } from '../../domain/format'
import { toLocalDate } from '../../domain/dates'
import { Button } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Loading } from '../../ui/Loading'
import { Screen } from '../../ui/Screen'
import { startFromTemplate } from './startTemplate'
import { useTemplates } from './useTemplates'

/** `/templates`: every template, most recently used first. */
export function TemplateListScreen() {
  const navigate = useNavigate()
  const data = useTemplates()
  if (data === undefined) {
    return (
      <Screen title="Templates" back="/">
        <Loading />
      </Screen>
    )
  }
  const { uses, exercises, hasActiveWorkout } = data

  return (
    <Screen title="Templates" back="/">
      <Link
        to="/templates/new"
        className="tap-target flex items-center justify-center rounded-control bg-accent px-4 font-semibold text-on-accent active:bg-accent-strong"
      >
        New template
      </Link>

      {uses.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Make one here, or save a finished workout as a template."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {uses.map(({ template, lastUsedAt }) => (
            <li
              key={template.id}
              className="flex items-center gap-2 rounded-card bg-surface p-3"
            >
              <Link
                to={`/templates/${template.id}`}
                className="tap-target flex min-w-0 flex-1 flex-col"
              >
                <span className="truncate font-semibold">{template.name}</span>
                <span className="text-sm text-muted">
                  {template.items.length}{' '}
                  {template.items.length === 1 ? 'exercise' : 'exercises'}
                  {template.items.length > 0 &&
                    ` · ${template.items
                      .slice(0, 3)
                      .map(
                        (i) =>
                          exercises.get(i.exerciseId)?.name ??
                          'Deleted exercise',
                      )
                      .join(', ')}${template.items.length > 3 ? '…' : ''}`}
                </span>
                <span className="text-sm text-muted">
                  {lastUsedAt === null
                    ? 'Not used yet'
                    : `Last used ${formatDay(toLocalDate(lastUsedAt))}`}
                </span>
              </Link>
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
      )}
      {hasActiveWorkout && uses.length > 0 && (
        <p className="text-sm text-muted">
          Finish the workout in progress to start one from a template.
        </p>
      )}
    </Screen>
  )
}
