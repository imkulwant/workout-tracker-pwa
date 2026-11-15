import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const TABS = [
  {
    to: '/',
    label: 'Today',
    end: true,
    icon: (
      <path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    ),
  },
  {
    to: '/history',
    label: 'History',
    end: false,
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    to: '/stats',
    label: 'Stats',
    end: false,
    icon: <path d="M5 21V11M12 21V4M19 21v-7" />,
  },
  {
    to: '/exercises',
    label: 'Exercises',
    end: false,
    icon: <path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" />,
  },
]

export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="pb-safe px-safe flex border-t border-border bg-surface"
    >
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `tap-target flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
              isActive ? 'text-accent' : 'text-muted'
            }`
          }
        >
          <Icon>{tab.icon}</Icon>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  )
}
