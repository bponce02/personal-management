import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { Button, Separator, Tabs, Typography } from '@heroui/react'
import { Calendar, CheckSquare, List, ListChecks, Settings } from 'lucide-react'
import { auth } from '../lib/auth'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (typeof window === 'undefined') return
    if (!auth.isAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: AuthenticatedLayout,
})

const ROUTES = {
  tasks: '/tasks',
  lists: '/lists',
  calendar: '/calendar',
} as const

type TabKey = keyof typeof ROUTES

// Primary navigation, rendered in two places (desktop header / mobile bottom
// bar). Both instances stay in sync because the selected tab is derived from
// the current route and selecting one navigates.
function PrimaryTabs() {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (l) => l.pathname })
  const selected: TabKey | undefined = pathname.startsWith('/lists')
    ? 'lists'
    : pathname.startsWith('/calendar')
      ? 'calendar'
      : pathname.startsWith('/tasks')
        ? 'tasks'
        : undefined

  return (
    <Tabs
      selectedKey={selected}
      onSelectionChange={(key) => navigate({ to: ROUTES[key as TabKey] })}
    >
      <Tabs.ListContainer>
        <Tabs.List
          aria-label="Primary navigation"
          className="*:h-8 *:px-4 *:w-fit"
        >
          <Tabs.Tab id="tasks">
            <ListChecks className="size-4 mr-1" />
            Tasks
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="lists">
            <List className="size-4 mr-1" />
            Lists
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="calendar">
            <Calendar className="size-4 mr-1" />
            Calendar
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}

function AuthenticatedLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 py-4">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center gap-2">
            <CheckSquare className="size-5" />
            <Typography weight="semibold">Personal Tasks</Typography>
          </div>

          <div className="hidden md:block">
            <PrimaryTabs />
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onPress={() => navigate({ to: '/settings' })}>
              <Settings />
            </Button>
          </div>
        </div>
      </header>
      <Separator />

      <main className="flex-1 px-4 pb-28 md:pb-6">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile: fixed, centered, floating above all content */}
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 md:hidden">
        <PrimaryTabs />
      </div>
    </div>
  )
}
